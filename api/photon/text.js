// Mama texts you. Photon iMessage kit (@photon-ai/imessage-kit 2.1.2, MIT, macOS only). Pinned: 3.0 queries a
// Messages column (message.ck_chat_id) that macOS 15 does not have, so it can send but never read. 2.1.2 does both.
// It reads the Messages database on this Mac and sends through Messages.app by AppleScript, so the
// API has to run on a Mac that is signed into Messages (a spare Apple ID), awake, with Full Disk
// Access granted to the terminal. docs/PHOTON.md has the checklist.
//
// Contract, kept for every caller: resolves null when nothing was sent (no PHOTON_TO, kit missing,
// quiet hours, rate limited, send failed) and { to, line } when Messages accepted the send. A caller
// may only say "texted" on a non null result. Nothing here ever throws.
//
// House rules from docs/PLAN.md, applied here so no caller can forget them:
//   quiet 11pm to 7am for anything she starts herself (replies and taps still go through),
//   one unprompted text per contact every few minutes (AppleScript sends are slow),
//   one unprompted text a day on top of the Sunday statement (PHOTON_DAILY_CAP, 0 turns it off).

const fs = require('node:fs');
const path = require('node:path');
require('../env');

const STATE = path.join(__dirname, '..', '..', 'data', 'photon-state.json');
const GAP_MS = Number(process.env.PHOTON_GAP_MS || 3 * 60 * 1000);
const DAILY_CAP = process.env.PHOTON_DAILY_CAP == null ? 1 : Number(process.env.PHOTON_DAILY_CAP);

let sdk = null;
let lastError = null;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
function writeState(patch) {
  const s = { ...readState(), ...patch };
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); } catch {}
  return s;
}

function kit() {
  if (sdk) return sdk;
  try {
    const { IMessageSDK } = require('@photon-ai/imessage-kit');
    sdk = new IMessageSDK({ watcher: { pollInterval: 2000 } });
    return sdk;
  } catch (e) { lastError = `kit: ${e.message}`; return null; }
}

function quiet(now = new Date()) { const h = now.getHours(); return h >= 23 || h < 7; }
const dayKey = (now) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

// Why a text was held back, or null when it may go. Pure, so the rules are testable without a Mac.
function gate({ to, prompted, state = readState(), now = new Date() }) {
  if (prompted) return null;
  if (quiet(now)) return 'quiet';
  const sent = (state.sent || {})[to] || {};
  if (sent.at && now - new Date(sent.at) < GAP_MS) return 'gap';
  if (DAILY_CAP > 0 && sent.day === dayKey(now) && (sent.count || 0) >= DAILY_CAP) return 'daily';
  return null;
}

function recordSend(to, prompted, now = new Date()) {
  const s = readState();
  const sent = s.sent || {};
  const prev = sent[to] || {};
  const sameDay = prev.day === dayKey(now);
  sent[to] = { at: now.toISOString(), day: dayKey(now), count: prompted ? (sameDay ? prev.count || 0 : 0) : (sameDay ? (prev.count || 0) + 1 : 1) };
  writeState({ sent, lastSentAt: now.toISOString() });
}

/**
 * Send one text. Resolves { to, line } on an accepted send, null otherwise.
 * @param {string} line        what she says; newlines are fine
 * @param {object} [opts]
 * @param {string} [opts.to]   phone, email or chatId; defaults to PHOTON_TO
 * @param {boolean} [opts.prompted]  true when the person asked for this text (a reply, a tap). Skips quiet hours and the caps.
 * @param {Date} [opts.now]
 */
async function text(line, opts = {}) {
  // PHOTON_TO is the master switch. Unset, she never texts anyone, whatever `to` a caller passes.
  if (!process.env.PHOTON_TO || !line) return null;
  const to = opts.to || process.env.PHOTON_TO;
  const held = gate({ to, prompted: !!opts.prompted, now: opts.now });
  if (held) { lastError = null; return null; }
  // PHOTON_DRY=1 for rehearsals: everything is decided and recorded, Messages is never touched.
  if (process.env.PHOTON_DRY === '1') { console.log(`[photon] dry run, would text ${mask(to)}:\n${line}`); recordSend(to, !!opts.prompted, opts.now); return { to, line, dry: true }; }
  const client = kit();
  if (!client) return null;
  try {
    await client.send(to, String(line));
    lastError = null;
    recordSend(to, !!opts.prompted, opts.now);
    return { to, line };
  } catch (e) {
    lastError = `send: ${e.message}`;
    return null;
  }
}

// Can she text right now? Sending needs PHOTON_TO and the kit (AppleScript into Messages.app). Reading, which
// the two way pipe needs, also needs the kit's query to match this Mac's Messages database. Never sends anything.
async function status() {
  const configured = !!process.env.PHOTON_TO;
  const dry = process.env.PHOTON_DRY === '1';
  const client = kit();
  let db = false; let dbError = null;
  if (client) { try { await client.getMessages({ limit: 1 }); db = true; } catch (e) { dbError = e.message; } }
  const reason = !configured ? 'PHOTON_TO is not set' : !client ? lastError : lastError;
  return { configured, dry, kit: !!client, db, ready: configured && (!!client || dry), inbound: !!client && db, to: configured ? mask(process.env.PHOTON_TO) : null, quiet: quiet(), lastError, dbError, reason: configured && (client || dry) ? null : reason };
}

function mask(s) { s = String(s); return s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : s; }

async function close() { if (sdk) { try { await sdk.close(); } catch {} sdk = null; } }

module.exports = { text, status, gate, quiet, close, readState, writeState, STATE };
