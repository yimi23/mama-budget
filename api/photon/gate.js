// When is she allowed to text first? The house rules from docs/PLAN.md, in one place, applied by notify()
// for every sender (log, Spectrum, Mac kit) so no caller can forget them:
//   quiet 11pm to 7am for anything she starts herself (replies and taps are "prompted" and always go),
//   one unprompted text per person every few minutes (sends are slow and two in a row reads as nagging),
//   one unprompted text a day per person on top of the statements (PHOTON_DAILY_CAP, 0 turns it off).
// "important" is the text the plan asks for by name: the budget blowing, or a proud moment. It skips the
// daily cap (a soft "noted" text earlier in the day must never silence Gele down) but never quiet hours
// or the gap. Pure apart from the small state file, so the rules are tested without Messages.

const fs = require('node:fs');
const path = require('node:path');

const STATE = path.join(__dirname, '..', '..', 'data', 'photon-gate.json');
const GAP_MS = Number(process.env.PHOTON_GAP_MS || 3 * 60 * 1000);
const DAILY_CAP = process.env.PHOTON_DAILY_CAP == null ? 1 : Number(process.env.PHOTON_DAILY_CAP);

function readState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } }
function writeState(s) { try { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); } catch {} }
function reset() { writeState({}); }

// Quiet hours are opt in for the hackathon (Praise, Oct 4): PHOTON_QUIET=1 turns the 11pm to 7am hold back on.
function quiet(now = new Date()) { if (process.env.PHOTON_QUIET !== '1') return false; const h = now.getHours(); return h >= 23 || h < 7; }
const dayKey = (now) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

// Why a text is held back, or null when it may go.
function gate({ to, prompted, important, state = readState(), now = new Date() }) {
  if (prompted) return null;
  if (quiet(now)) return 'quiet';
  const sent = (state.sent || {})[to] || {};
  if (sent.at && now - new Date(sent.at) < GAP_MS) return 'gap';
  if (!important && DAILY_CAP > 0 && sent.day === dayKey(now) && (sent.count || 0) >= DAILY_CAP) return 'daily';
  return null;
}

// Call after a real send so the gap and the daily cap mean something. Prompted sends do not count.
function record(to, prompted, now = new Date()) {
  if (prompted) return;
  const s = readState();
  const sent = s.sent || {};
  const prev = sent[to] || {};
  const sameDay = prev.day === dayKey(now);
  sent[to] = { at: now.toISOString(), day: dayKey(now), count: sameDay ? (prev.count || 0) + 1 : 1 };
  writeState({ ...s, sent });
}

module.exports = { gate, record, quiet, reset, readState, STATE };
