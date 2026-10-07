// The database: SQLite through better-sqlite3 (already a dependency), one file in data/, synchronous, no server to
// run. Enough for thousands of users on one box, and the shape moves to Postgres unchanged when that day comes.
//
// Tables:
//   users        one row per person; a device token (hashed) is how the extension proves who it is
//   settings     per user json: grandma, loudness, home, phone, envelope
//   bank_links   per user: the SimpleFIN access URL, encrypted at rest with the server key
//   bank_cache   per user: the last pull (accounts, rows) and when
//   budget_state per user json: closes, graces, jar, corrections, posted, putBacks
//   memory       per user json: items, reasons, sightings, history (notify/memory.js shape)

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

const DATA = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA, { recursive: true });
const db = new Database(process.env.MAMA_DB || path.join(DATA, 'mama.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, email TEXT, name TEXT);
  CREATE TABLE IF NOT EXISTS settings (user_id TEXT PRIMARY KEY REFERENCES users(id), json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS bank_links (user_id TEXT PRIMARY KEY REFERENCES users(id), access_enc TEXT NOT NULL, linked_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS bank_cache (user_id TEXT PRIMARY KEY REFERENCES users(id), json TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS budget_state (user_id TEXT PRIMARY KEY REFERENCES users(id), json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS memory (user_id TEXT PRIMARY KEY REFERENCES users(id), json TEXT NOT NULL, updated_at INTEGER NOT NULL);
`);

// The server key encrypts bank access URLs at rest. Generated once into data/server.key when MAMA_SERVER_KEY is unset.
function serverKey() {
  if (process.env.MAMA_SERVER_KEY) return crypto.createHash('sha256').update(process.env.MAMA_SERVER_KEY).digest();
  const p = path.join(DATA, 'server.key');
  if (!fs.existsSync(p)) fs.writeFileSync(p, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'hex');
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', serverKey(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}
function decrypt(blob) {
  const [iv, tag, enc] = String(blob).split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', serverKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const now = () => Date.now();

const q = {
  userByHash: db.prepare('SELECT * FROM users WHERE token_hash = ?'),
  insertUser: db.prepare('INSERT INTO users (id, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?)'),
  touch: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
  getJson: (table) => db.prepare(`SELECT json FROM ${table} WHERE user_id = ?`),
  putJson: (table) => db.prepare(`INSERT INTO ${table} (user_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`),
  getLink: db.prepare('SELECT access_enc FROM bank_links WHERE user_id = ?'),
  putLink: db.prepare('INSERT INTO bank_links (user_id, access_enc, linked_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET access_enc = excluded.access_enc, linked_at = excluded.linked_at'),
  delLink: db.prepare('DELETE FROM bank_links WHERE user_id = ?'),
  getCache: db.prepare('SELECT json, at FROM bank_cache WHERE user_id = ?'),
  putCache: db.prepare('INSERT INTO bank_cache (user_id, json, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, at = excluded.at'),
  delCache: db.prepare('DELETE FROM bank_cache WHERE user_id = ?'),
  // Every table keyed by user_id, including the ones other modules create (billing, house_members) when they exist.
  deleteUser: db.transaction((id) => { const have = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name)); for (const t of ['settings', 'bank_links', 'bank_cache', 'budget_state', 'memory', 'billing', 'house_members']) if (have.has(t)) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id); db.prepare('DELETE FROM users WHERE id = ?').run(id); }),
  count: db.prepare('SELECT COUNT(*) AS n FROM users'),
};
const jsonTables = { settings: { get: q.getJson('settings'), put: q.putJson('settings') }, budget_state: { get: q.getJson('budget_state'), put: q.putJson('budget_state') }, memory: { get: q.getJson('memory'), put: q.putJson('memory') } };

/** The user behind a device token; created on first sight. Null for an empty token. */
function userForToken(token) {
  const t = String(token || '').trim();
  if (t.length < 16) return null;
  const h = hashToken(t);
  let u = q.userByHash.get(h);
  if (!u) { const id = crypto.randomUUID(); q.insertUser.run(id, h, now(), now()); u = { id, token_hash: h, created_at: now(), last_seen: now() }; }
  else q.touch.run(now(), u.id);
  return { id: u.id, createdAt: u.created_at, email: u.email || null, name: u.name || null };
}

const getJson = (table, userId, fallback) => { const r = jsonTables[table].get.get(userId); if (!r) return fallback; try { return JSON.parse(r.json); } catch { return fallback; } };
const putJson = (table, userId, value) => { jsonTables[table].put.run(userId, JSON.stringify(value), now()); return value; };

module.exports = {
  db, userForToken, hashToken,
  settings: { get: (u, f = {}) => getJson('settings', u, f), put: (u, v) => putJson('settings', u, v) },
  budgetState: { get: (u, f) => getJson('budget_state', u, f), put: (u, v) => putJson('budget_state', u, v) },
  memory: { get: (u, f) => getJson('memory', u, f), put: (u, v) => putJson('memory', u, v) },
  bankLink: { get: (u) => { const r = q.getLink.get(u); return r ? decrypt(r.access_enc) : null; }, put: (u, access) => q.putLink.run(u, encrypt(access), now()), remove: (u) => q.delLink.run(u) },
  bankCache: { get: (u) => { const r = q.getCache.get(u); return r ? { ...JSON.parse(r.json), at: r.at } : null; }, put: (u, v) => q.putCache.run(u, JSON.stringify({ accounts: v.accounts, rows: v.rows }), v.at || now()), remove: (u) => q.delCache.run(u) },
  deleteUser: (u) => q.deleteUser(u),
  userCount: () => q.count.get().n,
  encrypt, decrypt,
};
