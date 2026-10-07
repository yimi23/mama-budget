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
const spaces = require('./spaces');
const fs = require('node:fs');
const path = require('node:path');

// Numbers that replied STOP. Persisted beside the database; nothing is sent to them until they reply START.
const STOPPED = path.join(__dirname, '..', '..', 'data', 'photon-stopped.json');
const digits = (n) => String(n || '').replace(/\D/g, '');
function stoppedSet() { try { return new Set(JSON.parse(fs.readFileSync(STOPPED, 'utf8'))); } catch { return new Set(); } }
function saveStopped(set) { fs.mkdirSync(path.dirname(STOPPED), { recursive: true }); fs.writeFileSync(STOPPED, JSON.stringify([...set])); }
function stopped(to) { const d = digits(to); return !!d && stoppedSet().has(d); }
function stopTexts(from) { const d = digits(from); if (!d) return false; const s = stoppedSet(); s.add(d); saveStopped(s); return true; }
function startTexts(from) { const d = digits(from); const s = stoppedSet(); const had = s.delete(d); if (had) saveStopped(s); return had; }

function senderName() {
  return photon.live() ? 'photon' : kit.available() ? 'imessage' : 'log';
}

// A watcher/statement notification passes no explicit `to` (there is one demo student, not a user
// table), so this resolves who that actually is: DEMO_PHONE (api/.env) if set, else whoever last
// texted the line (notify/spaces.js), else the legacy PHOTON_TO, else the placeholder "you" for a
// log-only transcript. "you"/PHOTON_TO were the old fallback and are why proactive texts never
// reached a real phone before -- Photon rejects a target it doesn't recognize.
function resolveDest(to) {
  return to || spaces.demoPhone() || process.env.PHOTON_TO || 'you';
}

async function notify(to, text, mood, opts = {}) {
  if (!text) return null;
  const dest = resolveDest(to);
  const sender = senderName();
  // STOP wins over everything, including prompted and important, except the one confirmation that STOP itself earns.
  const held = stopped(dest) && !opts.stopConfirm ? 'stopped' : gate.gate({ to: dest, prompted: !!opts.prompted, important: !!opts.important });
  if (held) {
    log.push({ to: dest, text, mood: mood || null, sender, sent: false, held, direction: 'out', at: Date.now() });
    return { sender, sent: false, held };
  }
  let sent = sender === 'photon' ? await photon.send(dest, text).catch(() => null)
    : sender === 'imessage' ? await kit.send(dest, text).catch(() => null)
    : null;
  // Spectrum refused (a daily send limit, an outage): the Mac kit carries the text if it can, from this Mac's own
  // number, rather than the text vanishing. Logged as the kit's, so the transcript says what happened.
  let via = sender;
  if (!sent && sender === 'photon' && kit.available()) {
    sent = await kit.send(dest, text).catch(() => null);
    if (sent) { via = 'imessage'; console.log('[photon] refused; the Mac kit carried the text to', String(dest).slice(-4)); }
  }
  if (sent) gate.record(dest, !!opts.prompted);
  log.push({ to: dest, text, mood: mood || null, sender: via, sent: !!sent, direction: 'out', at: Date.now() });
  return { sender: via, sent: !!sent };
}

/** Records the user's own text in the same transcript, before a reply is decided. */
function logIncoming(from, text) {
  log.push({ to: from || 'mama', text, mood: null, sender: 'log', sent: true, direction: 'in', at: Date.now() });
}

module.exports = { notify, logIncoming, senderName, getMessages: log.list, clearMessages: log.clear, stopped, stopTexts, startTexts };
