// Remembers which Photon space (conversation) belongs to which phone number, so the bank watcher
// can text a user back without starting a new conversation every time. A file, not a process
// global, so it survives a restart the same way the rest of notify/* state does. Conversation
// content (the memory module) is separate -- this is just phone -> space id.

const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'photon-spaces.json');

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

module.exports = { get, remember };
