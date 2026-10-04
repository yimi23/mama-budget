// Sender one: an in-memory list of what she would have texted. Always recorded, whether or not
// another sender actually delivered it, so GET /messages works the same with or without Photon
// credentials, and /messages/incoming can test the whole conversation without real iMessage.

const MAX = 200;
let messages = [];

function push(entry) {
  messages.push(entry);
  if (messages.length > MAX) messages = messages.slice(-MAX);
}
function list() {
  return messages;
}
function clear() {
  messages = [];
}

module.exports = { push, list, clear };
