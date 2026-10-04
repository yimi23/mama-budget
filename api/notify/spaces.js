// Remembers which Photon space (conversation) belongs to which phone number, so the bank watcher
// can text a user back without starting a new conversation every time. A file, not a process
// global, so it survives a restart the same way the rest of notify/* state does. Conversation
// content (the memory module) is separate -- this is just phone -> space id.
//
// Also remembers who the demo phone is. This is a one-student demo (no login, no user table), so
// there is nothing else to key a proactive text to: whoever last texted the line IS the demo
// student, under __lastSender. DEMO_PHONE in api/.env overrides that when set, for a fixed demo
// number instead of "whoever texted most recently".

const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'photon-spaces.json');
const LAST_SENDER_KEY = '__lastSender';

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function write(map) {
  fs.writeFileSync(FILE, JSON.stringify(map, null, 2));
}

function get(userId) {
  return read()[userId] || null;
}
function remember(userId, spaceId) {
  if (!userId || !spaceId) return;
  const map = read();
  if (map[userId] === spaceId) return;
  map[userId] = spaceId;
  write(map);
}

/** Call on every inbound text: that sender becomes the demo phone, until DEMO_PHONE overrides it. */
function rememberSender(userId) {
  if (!userId) return;
  const map = read();
  if (map[LAST_SENDER_KEY] === userId) return;
  map[LAST_SENDER_KEY] = userId;
  write(map);
}

/** DEMO_PHONE (api/.env) if set, else whoever last texted the line, else null (nowhere to send). */
function demoPhone() {
  return process.env.DEMO_PHONE || read()[LAST_SENDER_KEY] || null;
}

module.exports = { get, remember, rememberSender, demoPhone };
