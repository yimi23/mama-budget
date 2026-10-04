// Layout sample, not expected items: every check is derived from Target's own subtotal and item count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { runAdapter } from '../lib/readers/adapter.ts';
import { target } from '../lib/readers/sites/target.ts';
import { parsePrice } from '@mama/shared/currency';

const html = readFileSync(new URL('./fixtures/carts/target_cart.html', import.meta.url), 'utf8');
const load = () => new JSDOM(html).window.document;
const SUB = '[data-test="cart-summary-subTotal"]';

function targetSays(doc: Document) {
  const box = doc.querySelector(SUB)!;
  const count = Number(box.textContent!.match(/\((\d+) items?\)/)?.[1]);
  const subtotal = parsePrice(box.querySelector(':scope > div:last-child')!.textContent!);
  return { count, subtotal };
}
const sum = (doc: Document) => runAdapter(target, doc)!.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

test('reads exactly what Target will check out', () => {
  const doc = load();
  const read = runAdapter(target, doc)!;
  const says = targetSays(doc);
  assert.ok(read.items.length > 0);
  assert.equal(read.items.reduce((n, i) => n + i.qty, 0), says.count, 'item count matches Target');
  assert.ok(Math.abs(sum(doc) - says.subtotal!) < 0.01, `sum ${sum(doc)} vs Target subtotal ${says.subtotal}`);
  assert.equal(read.subtotal, says.subtotal, 'subtotal is the amount, not the (N items) count');
  for (const i of read.items) assert.ok(i.name && !/\$/.test(i.name) && i.unitPrice > 0, JSON.stringify(i));
});

test('never reads Saved for later', () => {
  const doc = load();
  const before = runAdapter(target, doc)!.items.length;
  const row = doc.querySelector('[data-test="cartItem"]')!.cloneNode(true) as Element;
  row.querySelector('[data-test="cartItem-title"]')!.textContent = 'Saved thing';
  doc.querySelector('[data-test="sfl-cart-item-list"]')!.append(row);
  const names = runAdapter(target, doc)!.items.map((i) => i.name);
  assert.equal(names.length, before);
  assert.ok(!names.includes('Saved thing'));
});

function setQty(doc: Document, qty: number, rowPrice: (unit: number) => number) {
  const row = doc.querySelector('[data-test="cartItem"]')!;
  const unit = parsePrice(row.querySelector('[data-test="cartItem-price"]')!.textContent!)!;
  row.querySelector('[data-test="cartItem-qty-stepper"]')!.setAttribute('aria-label', `${qty} `);
  row.querySelectorAll('[data-test="cartItem-price"]').forEach((p) => (p.textContent = `$${rowPrice(unit).toFixed(2)}`));
  const subEl = doc.querySelector(`${SUB} > div:last-child p`)!;
  subEl.textContent = `$${(parsePrice(subEl.textContent!)! + unit * (qty - 1)).toFixed(2)}`;
  return unit;
}

test('quantity 2 with the row showing the line total', () => {
  const doc = load();
  const unit = setQty(doc, 2, (u) => u * 2);
  const first = runAdapter(target, doc)!.items[0]!;
  assert.deepEqual([first.qty, first.unitPrice], [2, unit]);
  assert.ok(Math.abs(sum(doc) - targetSays(doc).subtotal!) < 0.01);
});

test('quantity 2 with the row showing the unit price', () => {
  const doc = load();
  const unit = setQty(doc, 2, (u) => u);
  const first = runAdapter(target, doc)!.items[0]!;
  assert.deepEqual([first.qty, first.unitPrice], [2, unit]);
});
