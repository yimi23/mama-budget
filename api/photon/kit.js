// Sender three: the Photon iMessage kit on this Mac (@photon-ai/imessage-kit 2.1.2, MIT). Sends through
// Messages.app by AppleScript and reads new texts from the Messages database. Needs a Mac signed into
// Messages, Full Disk Access for the terminal, and PHOTON_TO in api/.env. No signup, no cloud.
//
// Pinned at 2.1.2: 3.0 queries message.ck_chat_id, a column macOS 15 does not have, so it sends but
// never reads. 2.1.2 does both on macOS 15.7.
//
// notify() (api/notify/index.js) picks this sender when Spectrum has no credentials and available() is
// true. Everything here resolves null instead of throwing, and PHOTON_TO is the master switch: unset,
// she never texts anyone, whatever `to` a caller passes. PHOTON_DRY=1 rehearses: decided and logged,
// Messages never touched. docs/PHOTON.md has the Mac checklist.

const fs = require('node:fs');
const path = require('node:path');

const SEEN = path.join(__dirname, '..', '..', 'data', 'photon-seen.json');
let sdk = null;
let loadError = null;
let lastError = null;
let watching = false;

function dry() { return process.env.PHOTON_DRY === '1'; }
function configured() { return !!process.env.PHOTON_TO; }

function load() {
  if (sdk) return sdk;
  if (process.platform !== 'darwin') { loadError = 'not a Mac'; return null; }
  try {
    const { IMessageSDK } = require('@photon-ai/imessage-kit');
    sdk = new IMessageSDK({ watcher: { pollInterval: 2000 } });
    loadError = null;
    return sdk;
  } catch (e) { loadError = e.message; return null; }
}

/** Can this sender be used right now? True on a Mac with PHOTON_TO set and the kit loadable (or in dry run). */
function available() { return configured() && (dry() || !!load()); }

/** Send one text. { to, text } when Messages accepted the AppleScript (acceptance, not delivery), null otherwise. */
async function send(to, text) {
  if (!configured() || !to || !text) return null;
  if (dry()) { console.log(`[imessage] dry run, would text ${mask(to)}:\n${text}`); return { to, text, dry: true }; }
  const client = load();
  if (!client) return null;
  try { await client.send(to, String(text)); lastError = null; return { to, text }; }
  catch (e) { lastError = `send: ${e.message}`; console.log('[imessage] send failed:', e.message); return null; }
}

// "+1 (734) 555-0100" and "17345550100" are the same person. Emails compare lower case.
function norm(h) { h = String(h || '').trim().toLowerCase(); return h.includes('@') ? h : h.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); }
function allowed(sender) {
  const raw = process.env.PHOTON_ALLOW || process.env.PHOTON_TO || '';
  if (raw.trim() === '*') return true;
  return raw.split(',').map(norm).filter(Boolean).includes(norm(sender));
}
function readSeen() { try { return new Set(JSON.parse(fs.readFileSync(SEEN, 'utf8'))); } catch { return new Set(); } }
function writeSeen(set) { try { fs.writeFileSync(SEEN, JSON.stringify([...set].slice(-2000))); } catch {} }

/**
 * Listen for texts to this Mac and answer them. onIncoming(text, from) returns her reply (or nothing).
 * Direct messages only, never groups or reactions, only people on PHOTON_ALLOW (default: PHOTON_TO).
 * Deduped by message guid in data/photon-seen.json. A no-op when not available(), so wiring it
 * unconditionally is safe. In dry run it listens for real but logs the reply instead of sending it.
 */
function listen(onIncoming) {
  if (!configured() || watching) return false;
  const client = load();
  if (!client) return false;
  const seen = readSeen();
  watching = true;
  client.startWatching({
    onDirectMessage: async (m) => {
      if (m.isFromMe || m.isGroupChat || m.isReaction || !m.text || !m.text.trim()) return;
      const key = m.guid || m.id;
      if (seen.has(key)) return;
      seen.add(key); writeSeen(seen);
      if (!allowed(m.sender)) { console.log(`[imessage] ignored ${mask(m.sender)}: not on the list`); return; }
      console.log(`[imessage] from ${mask(m.sender)}: ${m.text}`);
      let reply;
      try { reply = await onIncoming(m.text, m.sender); } catch (e) { console.log('[imessage] onIncoming failed:', e.message); return; }
      if (reply) await send(m.sender, reply);
    },
    onError: (e) => { lastError = `watch: ${e.message}`; console.log('[imessage] watcher:', e.message); },
  }).catch((e) => { watching = false; lastError = `watch: ${e.message}`; console.log('[imessage] could not start watching:', e.message); });
  return true;
}

// Can she text and read right now? Never sends anything.
async function status() {
  const client = load();
  let db = false; let dbError = null;
  if (client) { try { await client.getMessages({ limit: 1 }); db = true; } catch (e) { dbError = e.message; } }
  return { configured: configured(), dry: dry(), kit: !!client, db, available: available(), listening: watching, to: configured() ? mask(process.env.PHOTON_TO) : null, loadError, dbError, lastError };
}

function mask(s) { s = String(s || ''); return s.includes('@') ? s.replace(/^(.).*(@.*)$/, '$1***$2') : s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : s; }

async function close() { if (sdk) { try { if (watching) sdk.stopWatching(); await sdk.close(); } catch {} sdk = null; watching = false; } }

module.exports = { send, listen, available, status, close, allowed, norm };
