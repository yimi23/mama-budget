#!/usr/bin/env node
// The pipe. Runs on the Mac that is signed into Messages, next to the API. It watches for texts to the spare
// Apple ID and posts each one to POST /inbound; the API works out the reply and sends it back through the same
// kit. No judgement lives here. If this process dies the extension still works and the API still texts.
//
//   node apps/imessage/index.js              watch and forward
//   node apps/imessage/index.js --status     can she text right now (asks the API)
//   node apps/imessage/index.js --test [to]  send the weekly statement to PHOTON_TO (or `to`) through the API
//
// Env: API (default http://localhost:8787), PHOTON_ALLOW (comma list of handles she answers; default PHOTON_TO
// only; * answers anyone), PHOTON_TO (read from api/.env).

const fs = require('node:fs');
const path = require('node:path');
require('../../api/env');

const API = (process.env.API || 'http://localhost:8787').replace(/\/$/, '');
const SEEN = path.join(__dirname, '..', '..', 'data', 'photon-seen.json');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[pipe]', ...a);

function readSeen() { try { return new Set(JSON.parse(fs.readFileSync(SEEN, 'utf8'))); } catch { return new Set(); } }
function writeSeen(set) { try { fs.writeFileSync(SEEN, JSON.stringify([...set].slice(-2000))); } catch {} }

async function api(method, route, body) {
  const r = await fetch(`${API}${route}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${method} ${route} -> ${r.status}`);
  return j;
}

// "+1 (734) 555-0100" and "17345550100" are the same person. Emails compare lower case.
function norm(h) { h = String(h || '').trim().toLowerCase(); return h.includes('@') ? h : h.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); }
function allowed(participant) {
  const raw = process.env.PHOTON_ALLOW || process.env.PHOTON_TO || '';
  if (raw.trim() === '*') return true;
  const list = raw.split(',').map(norm).filter(Boolean);
  return list.length > 0 && list.includes(norm(participant));
}

async function main() {
  const [, , flag, arg] = process.argv;
  if (flag === '--status') { console.log(JSON.stringify(await api('GET', '/photon/health'), null, 2)); console.log(JSON.stringify(await api('GET', '/schedule'), null, 2)); return; }
  if (flag === '--test') {
    const out = await api('POST', '/schedule', { now: true, to: arg || undefined });
    console.log(out.ok ? `Sent to ${out.to}:\n${out.text}` : `Not sent: ${out.reason}\nWould have said:\n${out.text}`);
    return;
  }

  try { await api('GET', '/health'); } catch (e) { log(`API not answering at ${API} (${e.message}). Start it with npm run api. Retrying in the background.`); }
  const { IMessageSDK } = require('@photon-ai/imessage-kit');
  const sdk = new IMessageSDK({ watcher: { pollInterval: 2000 } });
  const seen = readSeen();
  const who = process.env.PHOTON_ALLOW?.trim() === '*' ? 'anyone' : (process.env.PHOTON_ALLOW || process.env.PHOTON_TO || 'nobody (set PHOTON_TO)');
  log(`watching Messages, answering ${who}, API ${API}`);

  await sdk.startWatching({
    onDirectMessage: async (m) => {
      if (m.isFromMe || m.isGroupChat || m.isReaction || !m.text || !m.text.trim()) return;
      const key = m.guid || m.id;
      if (seen.has(key)) return;
      seen.add(key); writeSeen(seen);
      if (!allowed(m.sender)) { log(`ignored ${m.sender}: not on the list`); return; }
      log(`from ${m.sender}: ${m.text}`);
      try {
        const out = await api('POST', '/inbound', { id: key, from: m.sender, text: m.text });
        log(`${out.texted ? 'replied' : 'reply NOT sent'} (${out.intent}${out.action ? `, ${out.action}` : ''}): ${out.reply.replace(/\n/g, ' / ')}`);
      } catch (e) { log(`inbound failed: ${e.message}`); }
    },
    onError: (e) => log(`watcher: ${e.message}`),
  });

  const stop = async () => { log('stopping'); try { sdk.stopWatching(); await sdk.close(); } catch {} process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

main().catch((e) => { console.error('[pipe]', e.message); process.exit(1); });
