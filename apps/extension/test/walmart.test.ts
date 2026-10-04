// Layout sample, not expected items: checks come from Walmart's own subtotal on the page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { runAdapter } from '../lib/readers/adapter.ts';
import { walmart } from '../lib/readers/sites/walmart.ts';
import { firstPrice, parsePrice } from '@mama/shared/currency';

const html = readFileSync(new URL('./fixtures/carts/walmart_cart.html', import.meta.url), 'utf8');
const load = () => new JSDOM(html).window.document;
const pageSubtotal = (doc: Document) => parsePrice(firstPrice(doc.querySelector('aside')!.textContent!));

test('reads exactly what Walmart will check out', () => {
  const doc = load();
  const read = runAdapter(walmart, doc)!;
  assert.equal(read.items.length, doc.querySelectorAll('[data-testid="full-page-cart"] [data-testid="productName"]').length);
  const sum = read.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  assert.ok(Math.abs(sum - pageSubtotal(doc)!) < 0.01, `sum ${sum} vs Walmart subtotal ${pageSubtotal(doc)}`);
  assert.equal(read.subtotal, pageSubtotal(doc));
  for (const i of read.items) assert.ok(i.name && !/\$/.test(i.name) && i.unitPrice > 0 && i.qty >= 1, JSON.stringify(i));
});

test('"Add your essentials" tiles inside the cart are never items', () => {
  const doc = load();
  const suggested = [...doc.querySelectorAll('[data-testid="full-page-cart"] [data-automation-id="product-title"]')].map((e) => e.textContent!.trim());
  assert.ok(suggested.length > 0, 'fixture has suggestion tiles inside the cart');
  for (const i of runAdapter(walmart, doc)!.items) assert.ok(!suggested.includes(i.name), `${i.name} is a suggestion`);
});

test('tiles outside the cart are never items', () => {
  const doc = load();
  const before = runAdapter(walmart, doc)!.items.length;
  doc.body.insertAdjacentHTML('beforeend', '<ul><li><div data-testid="productName">Paper plates</div><span>$4.97</span><span data-testid="quantity-label">1</span></li></ul>');
  assert.equal(runAdapter(walmart, doc)!.items.length, before);
});

test('first price wins over was price and badges', () => {
  assert.equal(firstPrice('10K+ bought since yesterday Rollback Current price $2.50, Was $2.96'), '$2.50');
  assert.equal(firstPrice('Deal $1,260.65 3-Year Plan - $79.00'), '$1,260.65');
  assert.equal(firstPrice('₦ 25,000 was ₦ 30,000'), '₦ 25,000');
  assert.equal(firstPrice('no price here'), '');
});
