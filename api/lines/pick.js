// Which line from a pool. Never the one she said last time in this situation, and not the few before it either:
// repetition is what makes a character sound like a machine. Random among what is left, so the same item does not
// always get the same line (the old pick was the item name's length modulo the pool, which is deterministic and
// therefore stale on the second visit). What she said is remembered in a small file, so a restart does not reset
// her to line one.

const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'said.json');
const WINDOW_MAX = 6;

let said = null;
function load() {
  if (said) return said;
  try { said = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { said = {}; }
  return said;
}
function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(said)); } catch { /* a read only disk changes nothing */ }
}

/**
 * One line from `pool` for the situation `who/key`, avoiding the most recent ones. `rng` is injectable for tests.
 * A pool of one is returned as is. Empty or missing pools return ''.
 */
function pick(who, key, pool, rng = Math.random) {
  if (!Array.isArray(pool) || !pool.length) return '';
  if (pool.length === 1) return pool[0];
  const s = load();
  const slot = `${who}/${key}`;
  const recent = Array.isArray(s[slot]) ? s[slot] : [];
  const window = Math.min(WINDOW_MAX, pool.length - 1);
  const avoid = new Set(recent.slice(-window));
  const fresh = pool.filter((l) => !avoid.has(l));
  const choice = (fresh.length ? fresh : pool)[Math.floor(rng() * (fresh.length ? fresh.length : pool.length))];
  s[slot] = [...recent.filter((l) => l !== choice), choice].slice(-WINDOW_MAX);
  save();
  return choice;
}

/** The last few lines said in a situation, newest last. */
function recent(who, key) {
  const s = load();
  return (s[`${who}/${key}`] || []).slice();
}

/** Forget everything (POST /reset, npm run reseed, tests). */
function reset() {
  said = {};
  save();
}

module.exports = { pick, recent, reset, WINDOW_MAX };
