// The house: one weekly envelope shared by two to four people. docs/research/HOUSE_AND_SUNDAY.md section A.
//
// One pot, one house. Join by a six-digit code read aloud. The member who opened the house sets the number; a change
// applies next Monday, never mid-week. Everyone sees the envelope, what is left and the week's count. A purchase shows
// to the others as amount, item and day, never the name. A kept moment is credited to the house. Leaving is one tap;
// a leaver's purchases stay as amounts. One member left turns the house back into a solo envelope.
//
// Money never moves. Each member keeps their own bank link; the house week is the sum of the members' want spending
// against the house envelope, computed on read.

const crypto = require('node:crypto');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS houses (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, opener_id TEXT NOT NULL, envelope INTEGER NOT NULL, next_envelope INTEGER, next_set_at INTEGER, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS house_members (house_id TEXT NOT NULL REFERENCES houses(id), user_id TEXT NOT NULL UNIQUE, joined_at INTEGER NOT NULL, left_at INTEGER, PRIMARY KEY (house_id, user_id));
`);

const MAX_MEMBERS = 4;
const now = () => Date.now();
const q = {
  byCode: db.prepare('SELECT * FROM houses WHERE code = ?'),
  byId: db.prepare('SELECT * FROM houses WHERE id = ?'),
  insert: db.prepare('INSERT INTO houses (id, code, opener_id, envelope, created_at) VALUES (?, ?, ?, ?, ?)'),
  setNext: db.prepare('UPDATE houses SET next_envelope = ?, next_set_at = ? WHERE id = ?'),
  applyNext: db.prepare('UPDATE houses SET envelope = next_envelope, next_envelope = NULL, next_set_at = NULL WHERE id = ? AND next_envelope IS NOT NULL'),
  memberOf: db.prepare('SELECT h.* , m.joined_at FROM house_members m JOIN houses h ON h.id = m.house_id WHERE m.user_id = ? AND m.left_at IS NULL'),
  members: db.prepare('SELECT user_id, joined_at FROM house_members WHERE house_id = ? AND left_at IS NULL ORDER BY joined_at'),
  join: db.prepare('INSERT INTO house_members (house_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET house_id = excluded.house_id, joined_at = excluded.joined_at, left_at = NULL'),
  leave: db.prepare('UPDATE house_members SET left_at = ? WHERE user_id = ? AND left_at IS NULL'),
};

/** Six digits, no leading zero, unique. */
function newCode() {
  for (let i = 0; i < 20; i++) { const c = String(crypto.randomInt(100000, 999999)); if (!q.byCode.get(c)) return c; }
  throw new Error('could not mint a house code');
}

/** The house this user is in, or null. */
function houseOf(userId) { return userId ? q.memberOf.get(userId) || null : null; }

/** Open a house with this envelope; the opener is its first member. A user already in a house leaves it first. */
function open(userId, envelope) {
  if (!userId) throw new Error('a device token is required');
  const amount = Math.max(25, Math.min(2000, Math.round(Number(envelope) || 0)));
  if (!amount) throw new Error('an envelope is required');
  leave(userId);
  const id = crypto.randomUUID(), code = newCode();
  q.insert.run(id, code, userId, amount, now());
  q.join.run(id, userId, now());
  return view(id, userId);
}

/** Join by code. Four members at most. */
function join(userId, code) {
  if (!userId) throw new Error('a device token is required');
  const h = q.byCode.get(String(code || '').replace(/\D/g, ''));
  if (!h) throw new Error('No house has that code.');
  const members = q.members.all(h.id);
  if (members.some((m) => m.user_id === userId)) return view(h.id, userId);
  if (members.length >= MAX_MEMBERS) throw new Error('That house is full. Four people at most.');
  q.join.run(h.id, userId, now());
  return view(h.id, userId);
}

/** Leave: one tap, any time. The leaver's past purchases stay in the house's closed weeks as amounts. */
function leave(userId) { if (userId) q.leave.run(now(), userId); return { ok: true }; }

/** The opener sets the number. It applies next Monday; the current week keeps its envelope. */
function setEnvelope(userId, amount) {
  const h = houseOf(userId);
  if (!h) throw new Error('You are not in a house.');
  if (h.opener_id !== userId) throw new Error('Only the one who opened the house sets the number.');
  const next = Math.max(25, Math.min(2000, Math.round(Number(amount) || 0)));
  q.setNext.run(next, now(), h.id);
  return view(h.id, userId);
}

/** Monday: a number set last week becomes the envelope on the first read of the new week. Idempotent. */
function weekStartMs(at) { const d = new Date(at); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d.getTime(); }
function applyPending(houseId, at = new Date()) {
  const h = q.byId.get(houseId);
  if (!h || h.next_envelope == null) return false;
  if ((h.next_set_at || 0) < weekStartMs(at)) { q.applyNext.run(houseId); return true; }
  return false;
}

/** What a member sees: the code, the count, the envelope and the pending one, who opened it (as "you" or not). */
function view(houseId, userId) {
  const h = q.byId.get(houseId);
  if (!h) return null;
  const members = q.members.all(h.id);
  return { id: h.id, code: h.code, envelope: h.envelope, nextEnvelope: h.next_envelope, members: members.length, opener: h.opener_id === userId, memberIds: members.map((m) => m.user_id) };
}

/**
 * The house week: every member's week (from their own ledger) summed against the house envelope. Purchases show as
 * amount, item and day, never the person. `weekFor(userId)` and `biggestFor(userId)` come from the ledger facade.
 */
function week(userId, { weekFor, shelfFor }) {
  const h = houseOf(userId);
  if (!h) return null;
  applyPending(h.id);
  const v = view(h.id, userId);
  const weeks = v.memberIds.map((id) => ({ id, w: weekFor(id) })).filter((x) => x.w);
  const spent = Math.round(weeks.reduce((s, x) => s + (x.w.spent || 0), 0));
  const kept = Math.round(weeks.reduce((s, x) => s + (x.w.kept || 0), 0));
  const left = Math.round(v.envelope - spent);
  const ratio = v.envelope ? spent / v.envelope : 0;
  const mine = weeks.find((x) => x.id === userId)?.w;
  // What the others see of each purchase: amount, item and day. The shelf gives put-backs; the week's top wants give
  // merchants and amounts. No member id leaves this function.
  const items = [];
  for (const x of weeks) for (const t of x.w.topWants || []) items.push({ amount: Math.round(t.amount), item: t.merchant });
  for (const x of weeks) for (const s of (shelfFor ? shelfFor(x.id) : []).slice(0, 5)) items.push({ amount: Math.round(s.amount), item: s.item, kept: true, day: s.date });
  return {
    house: { code: v.code, members: v.members, opener: v.opener, envelope: v.envelope, nextEnvelope: v.nextEnvelope },
    envelope: v.envelope, budget: v.envelope, spent, left, kept, ratio, mood: left < 0 ? 'down' : ratio >= 0.75 ? 'watching' : 'calm',
    daysLeft: mine ? mine.daysLeft : 0, bills: mine ? mine.bills : [], items: items.sort((a, b) => b.amount - a.amount).slice(0, 8),
    counts: { wants: weeks.reduce((s, x) => s + ((x.w.counts && x.w.counts.wants) || 0), 0) },
    mine: mine ? { spent: Math.round(mine.spent), kept: Math.round(mine.kept || 0) } : null,
  };
}

module.exports = { open, join, leave, setEnvelope, houseOf, view, week, applyPending, MAX_MEMBERS };
