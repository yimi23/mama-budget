// notify(to, text, mood): sends through whichever sender is configured, swappable.
// Sender one, "log": default. Appends to an in-memory list, exposed at GET /messages.
// Sender two, "photon": used automatically once SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET (or
// the PHOTON_ prefixed fallback) are set in api/.env (see api/photon/spectrum.js for what that needs
// and why no Mac is required). Every send is logged regardless of sender, so GET /messages is always
// the full transcript, and a missing package or missing credentials never throws -- it falls back to
// log-only.

const log = require('./log');
const photon = require('../photon/spectrum');

function senderName() {
  return photon.credentials() ? 'photon' : 'log';
}

async function notify(to, text, mood) {
  if (!text) return null;
  const dest = to || process.env.PHOTON_TO || 'you';
  const sender = senderName();
  const sent = sender === 'photon' ? await photon.send(dest, text).catch(() => null) : null;
  log.push({ to: dest, text, mood: mood || null, sender, sent: !!sent, direction: 'out', at: Date.now() });
  return { sender, sent: !!sent };
}

/** Records the user's own text in the same transcript, before a reply is decided. */
function logIncoming(from, text) {
  log.push({ to: from || 'mama', text, mood: null, sender: 'log', sent: true, direction: 'in', at: Date.now() });
}

module.exports = { notify, logIncoming, getMessages: log.list, clearMessages: log.clear };
