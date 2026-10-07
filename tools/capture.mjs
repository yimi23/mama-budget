// Capture a live store page into the corpus: the rendered DOM as HTML plus a sidecar with what the readers must find.
// Chrome for Testing (branded Chrome ignores --load-extension, and here we need a real browser for the page, not the
// extension). Usage:
//
//   CHROME=... node tools/capture.mjs <name> <url> [prep-js]
//   e.g.  node tools/capture.mjs allbirds-cart https://www.allbirds.com/ "$SHOPIFY_ADD_THEN_CART"
//
// Writes apps/extension/test/fixtures/pages/<name>.html and <name>.json ({ url, capturedAt, expect: null }). The
// expectation is filled by tools/corpus-expect.mjs after a human look; a page with expect null is not yet in the test.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [name, url, prep = '', waitSec = '6'] = process.argv.slice(2);
if (!name || !url) { console.log('usage: node tools/capture.mjs <name> <url> [prep-js] [wait-seconds]'); process.exit(1); }
const CHROME = process.env.CHROME;
if (!CHROME) { console.log('set CHROME to the Chrome for Testing binary'); process.exit(1); }
const dir = fileURLToPath(new URL('../apps/extension/test/fixtures/pages/', import.meta.url));
mkdirSync(dir, { recursive: true });
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TMPDIR || '/tmp'}/mb-capture-${port}`, '--no-first-run', '--disable-gpu', '--window-size=1280,1600',
  '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => { try { chrome.kill(); } catch {} };
process.on('exit', cleanup);
let ver; for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { result: { targetId } } = await send('Target.createTarget', { url });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
await sleep(Number(waitSec) * 1000);
const evalIn = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.exceptionDetails ? 'EXC ' + (r.result.exceptionDetails.exception?.description || '').slice(0, 200) : r.result?.result?.value; };
if (prep) { console.log('prep ->', String(await evalIn(prep)).slice(0, 160)); await sleep(Number(waitSec) * 1000); }
const finalUrl = await evalIn('location.href');
const title = await evalIn('document.title');
// Scripts and styles out, text and structure in: the readers never execute anything, and the file stays small.
const html = await evalIn(`(() => { const d = document.documentElement.cloneNode(true); for (const el of d.querySelectorAll('script:not([type="application/ld+json"]), style, link[rel="stylesheet"], noscript, iframe, svg, video, img[src^="data:"]')) el.remove(); for (const el of d.querySelectorAll('[style]')) el.removeAttribute('style'); return '<!doctype html>\\n' + d.outerHTML; })()`);
if (typeof html !== 'string' || html.length < 500) { console.log('capture failed:', String(html).slice(0, 200)); process.exit(1); }
writeFileSync(`${dir}${name}.html`, html);
writeFileSync(`${dir}${name}.json`, JSON.stringify({ url: finalUrl, title, capturedAt: new Date().toISOString(), bytes: html.length, expect: null }, null, 2) + '\n');
console.log(`saved ${name}: ${(html.length / 1024).toFixed(0)} KB, ${finalUrl}`);
process.exit(0);
