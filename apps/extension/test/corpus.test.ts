// The store corpus: real pages captured from live stores (tools/capture-batch.mjs), each with the read it must give
// (tools/corpus-expect.mjs, checked by a person). A reader change that breaks any of them fails here, offline.
//
// Product pages read through JSON-LD or an adapter; cart pages yield a text region that holds the subtotal; pricing
// grids never open the gate. Pages in GAPS are kept in the corpus as known misses and skipped until a reader learns them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readCart } from '../lib/readers/index.ts';
import { cartRegionText } from '../lib/readers/text.ts';
import { readSignals, cartSignalCount, liveCartSignalCount } from '../lib/detect.ts';
import { createRequire } from 'node:module';
const { comparingPlans } = createRequire(import.meta.url)('../../../api/lines/model.js') as { comparingPlans: (text: string, out: unknown) => boolean };

const DIR = new URL('./fixtures/pages/', import.meta.url);
const GAPS = new Set(['bookshop-product']); // structured data on the page is not a Product; the text reader needs the API

const pages = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ name: f.replace(/\.json$/, ''), meta: JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) }));
test('the corpus is real and labelled', () => {
  assert.ok(pages.length >= 15, `${pages.length} pages`);
  for (const p of pages) assert.ok(p.meta.expect, `${p.name} has no expectation yet: run tools/corpus-expect.mjs and check it`);
});

for (const { name, meta } of pages) {
  if (GAPS.has(name)) continue;
  const doc = () => new JSDOM(readFileSync(new URL(`${name}.html`, DIR), 'utf8'), { url: meta.url }).window.document;
  if (meta.kind === 'product') {
    test(`product: ${name} reads ${meta.expect.name} at ${meta.expect.unitPrice} ${meta.expect.currency}`, async () => {
      const r = await readCart(doc(), meta.url, async () => null);
      assert.ok(r && r.items.length, 'read');
      assert.equal(r!.via, meta.expect.via);
      assert.equal(r!.items[0]!.name, meta.expect.name);
      assert.equal(r!.items[0]!.unitPrice, meta.expect.unitPrice);
      assert.equal(r!.currency, meta.expect.currency);
    });
  } else if (meta.kind === 'cart') {
    test(`cart: ${name} yields a region with the subtotal ${meta.expect.subtotal}`, () => {
      const text = cartRegionText(doc()) || '';
      assert.ok(text.length > 0 && text.length <= 6000, `region ${text.length}`);
      if (meta.expect.subtotal) assert.ok(text.includes(meta.expect.subtotal), `subtotal ${meta.expect.subtotal} in region`);
    });
  } else if (meta.kind === 'pricing') {
    test(`pricing: ${name} is read as comparing plans, so nothing is judged`, () => {
      const d = doc();
      const open = cartSignalCount(readSignals(d, meta.url)) >= 2 || liveCartSignalCount(d, meta.url) >= 2;
      if (!open) return; // the gate stayed shut: nothing to guard
      const text = cartRegionText(d) || '';
      assert.ok(comparingPlans(text, { items: [{ name: 'plan', qty: 1, unitPrice: 1, period: 'month' }], subtotal: null, confidence: 0.9 }), 'the guard must read this as a plan grid');
    });
  }
}
