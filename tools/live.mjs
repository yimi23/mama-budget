// Live check: the built extension in a real Chrome against a real store, no login. Loads build/chrome-mv3 into
// Chrome for Testing (branded Google Chrome ignores --load-extension), seeds a grandma, opens the page, runs each step
// of page JS, and times when her words reach the screen. Prints every [mama] console line and the worker's session.
//
//   npm run build:ext
//   npx @puppeteer/browsers install chrome@stable --path ~/.cache/mb-chrome     (once)
//   CHROME="$(ls -d ~/.cache/mb-chrome/chrome/*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing)" \
//   node tools/live.mjs <url> <secs-between-steps> [step ...]
//
// A step is page JS, or the word "poll" (wait up to 20 s for her words and say how long after the click they came).
// Example, a Shopify product page: node tools/live.mjs https://www.allbirds.com/products/womens-tree-runners 0 "$CLICK" poll
// where CLICK finds and clicks the Add to cart button. Needs the API on localhost:8787.
import { spawn } from 'node:child_process';
const [url, secsArg, ...steps] = process.argv.slice(2); const secs = Number(secsArg || 10);
const port = 9400 + Math.floor(Math.random() * 400);
const dir = `${process.env.TMPDIR || '/tmp'}/mb-live-${port}`;
const bin = process.env.CHROME; if (!bin) { console.log('set CHROME to the Chrome for Testing binary (see the header)'); process.exit(1); }
const chrome = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', `--load-extension=${process.cwd()}/apps/extension/build/chrome-mv3`, '--window-size=1280,900', '--disable-gpu', '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 40; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') { const t = m.params.args.map((a) => a.value ?? a.description ?? '').join(' '); if (/mama|extract|judge|fetch|error|fail/i.test(t)) logs.push(`${((Date.now() - T0) / 1000).toFixed(1)}s [${m.params.type}] ${t.slice(0, 170)}`); }
  if (m.method === 'Runtime.exceptionThrown') logs.push(`${((Date.now() - T0) / 1000).toFixed(1)}s [exception] ` + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 220)); };
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const T0 = Date.now();
await sleep(4000); // let onInstalled's startOver finish before seeding
const tl = await send('Target.getTargets'); const sws = (tl.result.targetInfos || []).filter((t) => t.type === 'service_worker' && /chrome-extension/.test(t.url));
console.log('workers', sws.map((t) => t.url).join(' | ') || 'NONE');
let swS = null;
for (const t of sws) { const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }); const sid = a.result?.sessionId; if (!sid) continue; await send('Runtime.enable', {}, sid);
  const r = await send('Runtime.evaluate', { expression: "typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().name : 'n/a'", returnByValue: true }, sid);
  console.log('  ', t.url.slice(0, 60), '->', r.result?.result?.value); if (r.result?.result?.value === 'Mama Budget') swS = sid; }
if (!swS) { console.log('NO MAMA SERVICE WORKER'); chrome.kill(); process.exit(1); }
const swEval = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, swS); if (r.result?.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300); if (r.error) return 'ERR ' + JSON.stringify(r.error); return r.result?.result?.value ?? JSON.stringify(r.result?.result); };
console.log('seed   ', await swEval(`chrome.storage.local.set({ settings: { grandma: 'nana', loudness: 'mama', onboarded: true, envelope: 75, sounds: false, home: 'US' } }).then(() => chrome.storage.local.get('settings')).then((s) => JSON.stringify(s.settings))`));
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
const evalIn = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.result?.value ?? r.result?.exceptionDetails?.text; };
const host = () => evalIn(`(() => { const h = document.querySelector('mama-budget'); if (!h) return 'no host'; const sr = h.shadowRoot; return { badge: !!sr, text: sr ? [...sr.querySelectorAll('*')].filter(e=>e.tagName!=='STYLE').map(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3)?e.textContent:'').join(' ').replace(/\\s+/g,' ').trim().slice(0,300) : '' }; })()`);
await send('Page.navigate', { url }, sessionId);
{ const t0 = Date.now(); while (Date.now() - t0 < 15000 && !logs.some((l) => /\[mama\] gate/.test(l))) await sleep(200); console.log('content script in after', ((Date.now() - t0) / 1000).toFixed(1), 's'); await sleep(1500); }
let clickAt = null;
for (const js of steps) {
  if (js === 'poll') { const t0 = Date.now(); let got = null; while (Date.now() - t0 < 20000) { const h = await host(); if (h && typeof h === 'object' && h.badge && h.text.length > 20 && /\?|left|\$/.test(h.text)) { got = h; break; } await sleep(200); }
    console.log('poll   ', got ? `her words on screen ${((Date.now() - (clickAt ?? t0)) / 1000).toFixed(1)}s after the click` : 'nothing within 20s', '|', got ? got.text.replace(/^.*?\}\s*/, '').slice(0, 140) : JSON.stringify(await host()).slice(0, 80)); continue; }
  const r = await evalIn(js); if (/clicked/.test(String(r))) clickAt = Date.now(); console.log('step   ', String(r).slice(0, 160)); await sleep(secs * 1000); console.log('  url  ', await evalIn('location.href'));
}
if (!steps.length) { await sleep(secs * 1000); console.log('url    ', await evalIn('location.href')); console.log('host   ', JSON.stringify(await host())); }
console.log('session', await swEval(`chrome.storage.session.get(null).then((s) => JSON.stringify(s).slice(0, 400))`));
for (const l of logs.slice(0, 16)) console.log('  ', l);
chrome.kill(); process.exit(0);
