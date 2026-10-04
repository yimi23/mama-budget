// Her memory of the conversation: history, promises, and which purchases she has already commented
// on. One file, one user (this demo has no login), survives a restart because it is a file, not a
// process global. notify/chat.js reads and writes this on every incoming text and every purchase it
// comments on. POST /reset (and npm run reseed) wipe it back to empty.

const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'mama-memory.json');
const MAX_HISTORY = 40;

function empty() {
  return { history: [], promises: [], commented: [] };
}

function read() {
  try {
    const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { history: m.history || [], promises: m.promises || [], commented: m.commented || [] };
  } catch {
    return empty();
  }
}

function write(m) {
  fs.writeFileSync(FILE, JSON.stringify(m, null, 2));
}

function reset() {
  write(empty());
}

function addHistory(m, from, text) {
  m.history.push({ from, text, at: Date.now() });
  if (m.history.length > MAX_HISTORY) m.history = m.history.slice(-MAX_HISTORY);
}

/** "no more doordash this week" -> stored as-is; broken starts false. */
function addPromise(m, text) {
  const rec = { text, broken: false, at: Date.now() };
  m.promises.push(rec);
  return rec;
}

function activePromises(m) {
  return m.promises.filter((p) => !p.broken);
}

// Generic "no more wants/spending/shopping" matches any want; otherwise the promise's subject
// (the words after "no more"/"not going to"/"not gonna") must show up in the item or merchant.
const GENERIC_WANT_WORDS = new Set(['want', 'wants', 'spending', 'shopping', 'extras', 'treats', 'treating myself']);
function subjectOf(promiseText) {
  let s = promiseText.toLowerCase().trim();
  s = s.replace(/^(i promise[, ]*)?(no more|not gonna get|not going to (buy|get)|stop(ping)? (buying|getting))\s+/i, '');
  s = s.replace(/\s+(this week|for now|anymore|again)\.?$/i, '').replace(/[.!]+$/, '');
  return s.trim();
}

/** First active promise a new want purchase breaks, or null. Pure: does not mark anything broken. */
function findBrokenPromise(m, itemName, merchant) {
  const hay = `${itemName || ''} ${merchant || ''}`.toLowerCase();
  for (const p of activePromises(m)) {
    const subject = subjectOf(p.text);
    if (!subject) continue;
    if (GENERIC_WANT_WORDS.has(subject) || hay.includes(subject)) return p;
  }
  return null;
}

function markBroken(m, promise, brokenBy) {
  promise.broken = true;
  promise.brokenBy = brokenBy;
  promise.brokenAt = Date.now();
}

function noteCommented(m, entry) {
  m.commented.push({ ...entry, at: Date.now() });
  if (m.commented.length > MAX_HISTORY) m.commented = m.commented.slice(-MAX_HISTORY);
}

module.exports = { read, write, reset, addHistory, addPromise, activePromises, findBrokenPromise, markBroken, noteCommented };
