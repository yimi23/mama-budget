// Fill each captured page's sidecar with what the readers must find, from what they find today, for a human to
// check before it becomes the test. Offline: no API, no model, no network. Product pages must read through JSON-LD
// or an adapter; cart pages must yield a text region holding the item and the subtotal; pricing grids must not open
// the gate at all.
//
//   node --experimental-strip-types tools/corpus-expect.mjs [name-filter]      (run from apps/extension)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readCart } from '../apps/extension/lib/readers/index.ts';
import { cartRegionText } from '../apps/extension/lib/readers/text.ts';
import { readSignals, cartSignalCount } from '../apps/extension/lib/detect.ts';
import { createRequire } from 'node:module';
const { comparingPlans } = createRequire(import.meta.url)('../api/lines/model.js');

const DIR = new URL('../apps/extension/test/fixtures/pages/', import.meta.url);
const filter = process.argv[2] || '';
const SUBTOTAL = /\b(?:subtotal|sub-total|order total|estimated total|cart total|basket total|total)\b(?:\s*\([^)]{0,30}\))?[^$£€₦\d]{0,40}((?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?)/i;

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x.includes(filter))) {
  const meta = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  const html = readFileSync(new URL(f.replace(/\.json$/, '.html'), DIR), 'utf8');
  const dom = new JSDOM(html, { url: meta.url });
  const doc = dom.window.document;
  let expect = null, note = '';
  if (meta.kind === 'pricing') {
    // The gate may open on a plan page (a trial start is a money moment); what must hold is that the API's guard
    // reads the page as comparing plans, so nothing is judged. That guard is text-only: two or more recurring
    // prices and nothing chosen.
    const n = cartSignalCount(readSignals(doc, meta.url));
    const text = cartRegionText(doc) || '';
    const silenced = comparingPlans(text, { items: [{ name: 'plan', qty: 1, unitPrice: 1, period: 'month' }], subtotal: null, confidence: 0.9 });
    expect = { gate: n >= 2 ? 'open' : 'closed', signals: n, silenced };
    note = n < 2 ? 'quiet (gate shut)' : silenced ? 'gate opens, guard silences (comparing plans)' : 'GATE OPENS AND THE GUARD WOULD NOT SILENCE: fix comparingPlans or the page is a real checkout';
  } else if (meta.kind === 'product') {
    const r = await readCart(doc, meta.url, async () => null).catch(() => null);
    expect = r && r.items.length ? { via: r.via, name: r.items[0].name, unitPrice: r.items[0].unitPrice, currency: r.currency } : { via: null };
    note = r && r.items.length ? `${r.via}: ${r.items[0].name} ${r.items[0].unitPrice} ${r.currency}` : 'NO READ: product page without JSON-LD or an adapter';
  } else {
    const text = cartRegionText(doc) || '';
    const sub = SUBTOTAL.exec(text)?.[1] || null;
    expect = { regionChars: text.length, subtotal: sub, sample: text.replace(/\s+/g, ' ').slice(0, 160) };
    note = `region ${text.length} chars, subtotal ${sub || 'NOT FOUND'}`;
  }
  writeFileSync(new URL(f, DIR), JSON.stringify({ ...meta, expect }, null, 2) + '\n');
  console.log(`${f.replace(/\.json$/, '').padEnd(24)} ${note}`);
}
