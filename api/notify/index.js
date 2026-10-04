// notify(to, text, mood, opts): sends through whichever sender is configured, swappable.
// Sender one, "log": default. Appends to an in-memory list, exposed at GET /messages.
// Sender two, "photon": Photon's cloud (Spectrum), used once SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET
// (or the PHOTON_ prefixed fallback) are set in api/.env. No Mac needed (api/photon/spectrum.js).
// Sender three, "imessage": the Photon iMessage kit on this Mac, used when Spectrum has no credentials but
// PHOTON_TO is set and the API runs on a Mac signed into Messages. No signup needed (api/photon/kit.js).
// Every send is logged regardless of sender, so GET /messages is always the full transcript, and a missing
// package or missing credentials never throws -- it falls back to log-only.
//
// The gate (api/photon/gate.js) runs here for every sender: quiet hours, a gap and a daily cap on anything
// she starts herself. opts.prompted = true (a reply, a tap on "Text me what you saw", a statement) skips it.
// opts.important = true (Gele down, a proud moment) skips only the daily cap. A held text is still logged,
// with held: why, so GET /messages shows what she bit her tongue on.

const log = require('./log');
const photon = require('../photon/spectrum');
const kit = require('../photon/kit');
const gate = require('../photon/gate');

function senderName() {
  return photon.live() ? 'photon' : kit.available() ? 'imessage' : 'log';
}

async function notify(to, text, mood, opts = {}) {
  if (!text) return null;
  const dest = to || process.env.PHOTON_TO || 'you';
  const sender = senderName();
  const held = gate.gate({ to: dest, prompted: !!opts.prompted, important: !!opts.important });
  if (held) {
    log.push({ to: dest, text, mood: mood || null, sender, sent: false, held, direction: 'out', at: Date.now() });
    return { sender, sent: false, held };
  }
  const sent = sender === 'photon' ? await photon.send(dest, text).catch(() => null)
    : sender === 'imessage' ? await kit.send(dest, text).catch(() => null)
    : null;
  if (sent) gate.record(dest, !!opts.prompted);
  log.push({ to: dest, text, mood: mood || null, sender, sent: !!sent, direction: 'out', at: Date.now() });
  return { sender, sent: !!sent };
}

/** Records the user's own text in the same transcript, before a reply is decided. */
function logIncoming(from, text) {
  log.push({ to: from || 'mama', text, mood: null, sender: 'log', sent: true, direction: 'in', at: Date.now() });
}

module.exports = { notify, logIncoming, senderName, getMessages: log.list, clearMessages: log.clear };
