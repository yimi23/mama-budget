import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { cartRegionText } from '../lib/readers/text.ts';

test('the Zara bag: the region holds every item and the total, and little else', () => {
  const html = readFileSync(new URL('./fixtures/carts/zara_cart.html', import.meta.url), 'utf8');
  const doc = new JSDOM(html).window.document;
  const text = cartRegionText(doc)!;
  assert.ok(text, 'found a region');
  for (const item of ['CONTRAST TURN-UP STRAIGHT FIT JEANS', 'TRAVEL SUITCASE', 'HENLEY T-SHIRT']) assert.ok(text.includes(item), item);
  assert.match(text, /994\.60/);
  assert.ok(text.length <= 6000);
});

test('a page with no prices has no cart region', () => {
  assert.equal(cartRegionText(new JSDOM('<body><p>Weekly news. Nothing for sale.</p></body>').window.document), null);
});
