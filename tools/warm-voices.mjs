// Render every fixed line in the pools, for every grandma, into the voice cache (api/.cache/tts), so her common
// sentences never cost ElevenLabs characters twice and play with no wait. Lines with placeholders ({item}, {left})
// are skipped: they are rendered the first time they are said and cached from then on.
//
//   node tools/warm-voices.mjs [grandma]      needs the API running on :8787 and ELEVENLABS_API_KEY in api/.env
//
// Prints what it rendered and what it skipped. Run once per voice change; it spends characters on first use only.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const writer = require('../api/lines/writer.js');
const texts = require('../api/lines/texts.js');
const { GRANDMAS } = require('../api/lines/character.js');

const only = process.argv[2];
const API = process.env.MAMA_API || 'http://localhost:8787';
const whos = Object.keys(GRANDMAS).filter((g) => !only || g === only);
const pools = (who) => {
  const out = new Set();
  for (const bank of [writer.BANK, texts.BANK]) {
    const b = bank && (bank[who] || bank[who.toUpperCase()]);
    if (!b) continue;
    for (const lines of Object.values(b)) for (const l of Array.isArray(lines) ? lines : []) if (typeof l === 'string' && !/[{}]/.test(l)) out.add(l);
  }
  return [...out];
};
let rendered = 0, cached = 0, failed = 0, skipped = 0;
for (const who of whos) {
  const lines = pools(who);
  console.log(`${who}: ${lines.length} fixed lines`);
  for (const text of lines) {
    const res = await fetch(`${API}/tts`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'chrome-extension://warm' }, body: JSON.stringify({ text, grandma: who, mood: 'calm' }) }).catch(() => null);
    if (!res) { failed++; continue; }
    if (res.status === 204) { skipped++; continue; }
    if (res.headers.get('x-tts-cache') === 'hit') cached++; else rendered++;
  }
}
console.log(`rendered ${rendered}, already cached ${cached}, no voice ${skipped}, failed ${failed}`);
