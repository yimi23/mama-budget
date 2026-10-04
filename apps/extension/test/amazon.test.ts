// The saved page is a layout sample, not a list of expected items. Every check is derived from what the page
// itself says (Amazon's own subtotal and item count), so the same test holds for any cart saved in this layout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { locateRow, runAdapter } from '../lib/readers/adapter.ts';
import { amazon } from '../lib/readers/sites/amazon.ts';
import { parsePrice } from '@mama/shared/currency';

const html = readFileSync(new URL('./fixtures/carts/amazon_cart.html', import.meta.url), 'utf8');
const load = () => new JSDOM(html).window.document;

function amazonSays(doc: Document) {
  const label = doc.querySelector('#sc-subtotal-label-buybox')?.textContent ?? '';
  const count = Number(label.match(/\((\d+) items?\)/)?.[1]);
  const subtotal = parsePrice(doc.querySelector('#sc-subtotal-amount-buybox')?.textContent ?? '');
  return { count, subtotal };
}

test('reads exactly what Amazon will check out', () => {
  const doc = load();
  const read = runAdapter(amazon, doc)!;
  const says = amazonSays(doc);
  assert.ok(read.items.length > 0, 'found items');
  assert.equal(read.items.reduce((n, i) => n + i.qty, 0), says.count, 'item count matches Amazon');
  const sum = read.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  assert.ok(Math.abs(sum - says.subtotal!) < 0.01, `sum ${sum} vs Amazon subtotal ${says.subtotal}`);
  assert.equal(read.subtotal, says.subtotal);
  assert.equal(read.currency, 'USD');
  for (const i of read.items) {
    assert.ok(i.name && i.unitPrice > 0 && i.qty >= 1, JSON.stringify(i));
    // The title is one clean string: not doubled by the truncation markup, no screen reader hint.
    assert.doesNotMatch(i.name, /opens in a new tab/i);
    const half = i.name.length / 2;
    assert.notEqual(i.name.slice(0, half), i.name.slice(half), `doubled name: ${i.name}`);
  }
});

test('never reads Saved for later', () => {
  const doc = load();
  const saved = new Set([...doc.querySelectorAll('#sc-saved-cart .a-truncate-full')].map((e) => e.textContent!.trim()));
  assert.ok(saved.size > 0, 'fixture has saved items');
  for (const i of runAdapter(amazon, doc)!.items) assert.equal(saved.has(i.name), false, `${i.name} is saved for later`);
});

test('follows the cart as it changes', () => {
  const doc = load();
  const before = runAdapter(amazon, doc)!.items.length;
  doc.querySelector('#sc-active-cart div[data-itemtype="active"]:not([data-isselected="0"])')!.remove();
  assert.equal(runAdapter(amazon, doc)!.items.length, before - 1, 'removed row disappears');
  doc.querySelector('#sc-active-cart div[data-itemtype="active"][data-isselected="0"]')!.setAttribute('data-isselected', '1');
  assert.equal(runAdapter(amazon, doc)!.items.length, before, 'ticked row appears');
});

test('a page without the cart reads as null', () => {
  assert.equal(runAdapter(amazon, new JSDOM('<p>not a cart</p>').window.document), null);
});

test('the row mark finds the exact row for an item, re queried', () => {
  const doc = load();
  const first = runAdapter(amazon, doc)!.items[0]!;
  const row = locateRow(amazon, doc, first.name);
  assert.ok(row, 'found');
  assert.ok(row!.matches(amazon.row), 'it is a cart row');
  assert.equal(locateRow(amazon, doc, 'Not in this cart'), null);
});
