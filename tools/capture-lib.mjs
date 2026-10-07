// One Chrome for Testing per batch, many pages. `withBrowser(async (b) => ...)` gives open(url), evalIn(js), click(sel),
// save(name) which writes the rendered DOM (scripts, styles, media stripped; JSON-LD kept) and a sidecar.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PAGES_DIR = fileURLToPath(new URL('../apps/extension/test/fixtures/pages/', import.meta.url));

export async function withBrowser(fn) {
  const CHROME = process.env.CHROME;
  if (!CHROME) throw new Error('set CHROME to the Chrome for Testing binary');
  mkdirSync(PAGES_DIR, { recursive: true });
  const port = 9800 + Math.floor(Math.random() * 150);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TMPDIR || '/tmp'}/mb-capture-${port}`, '--no-first-run', '--disable-gpu', '--window-size=1280,1600', '--lang=en-US',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { try { chrome.kill(); } catch { /* gone */ } };
  process.on('exit', cleanup);
  try {
    let ver; for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
    const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
    let targetId = null, sessionId = null;
    const b = {
      async open(url, waitMs = 5000) {
        if (targetId) await send('Target.closeTarget', { targetId });
        ({ result: { targetId } } = await send('Target.createTarget', { url }));
        ({ result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true }));
        await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
        await sleep(waitMs);
      },
      async evalIn(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.exceptionDetails ? 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text || '').slice(0, 200) : r.result?.result?.value; },
      async click(sel) {
        const box = await b.evalIn(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        if (!box) return false;
        for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
        return true;
      },
      async save(name, meta = {}) {
        const url = await b.evalIn('location.href'), title = await b.evalIn('document.title');
        const html = await b.evalIn(`(() => { const d = document.documentElement.cloneNode(true); for (const el of d.querySelectorAll('script:not([type="application/ld+json"]), style, link[rel="stylesheet"], noscript, iframe, svg, video, img[src^="data:"], source, picture > source')) el.remove(); for (const el of d.querySelectorAll('[style]')) el.removeAttribute('style'); return '<!doctype html>\\n' + d.outerHTML; })()`);
        if (typeof html !== 'string' || html.length < 500) return { ok: false, reason: String(html).slice(0, 120), url };
        writeFileSync(`${PAGES_DIR}${name}.html`, html);
        writeFileSync(`${PAGES_DIR}${name}.json`, JSON.stringify({ url, title, capturedAt: new Date().toISOString(), bytes: html.length, expect: null, ...meta }, null, 2) + '\n');
        return { ok: true, url, title, kb: Math.round(html.length / 1024) };
      },
      sleep,
    };
    return await fn(b);
  } finally { cleanup(); }
}

/** Shopify: pick the first in-stock product, add one to the cart, go to /cart. Returns what it added or an error. */
export const SHOPIFY_ADD = `(async () => { try { const j = await (await fetch('/products.json?limit=12')).json(); const p = j.products.find(p => p.variants.some(v => v.available)) || j.products[0]; if (!p) return 'no products'; const v = p.variants.find(v => v.available) || p.variants[0]; const r = await fetch('/cart/add.js', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] }) }); return r.status + ' ' + p.title + ' ' + v.price + ' /products/' + p.handle; } catch (e) { return 'ERR ' + e.message; } })()`;
