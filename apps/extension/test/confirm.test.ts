import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmPlan } from '../lib/confirm.ts';
import { orderTotalFrom } from '../lib/detect.ts';
import type { CartRead } from '@mama/shared/types';

const key = (n: string) => n.trim().toLowerCase();
const read = (items: Array<[string, number, number?]>): CartRead => ({
  items: items.map(([name, unitPrice, qty = 1]) => ({ name, unitPrice, qty })), subtotal: null, currency: 'USD', source: 'text', via: 'model', confidence: 0.9,
} as unknown as CartRead);

test('the page states the order total: the ledger gets what was paid', () => {
  const text = 'Thank you! Order number: 112-4455667-8899000 Items: $299.00 Shipping: $0.00 Tax: $17.94 Order total: $316.94';
  assert.equal(orderTotalFrom(text), 316.94);
  assert.equal(orderTotalFrom('Thanks for your order. Total $45.10'), 45.1);
  assert.equal(orderTotalFrom('Shipment 1 total: $10.00 Shipment 2 total: $5.00 Grand total: $15.00'), 15);
  assert.equal(orderTotalFrom('Thanks for your order!'), null);
});

test('a cart that explains the total is charged line by line; tax and shipping sit on top', () => {
  const plan = confirmPlan(read([['Gaming chair', 299], ['Rice 20 lb', 24]]), 345.2, new Set(), 'amazon.com', key);
  assert.deepEqual(plan.map((c) => [c.name, c.price]), [['Gaming chair', 299], ['Rice 20 lb', 24]]);
});

test('a $1 promo line is not the purchase when the page says the order cost $316.94', () => {
  const plan = confirmPlan(read([['Amazon Grocery', 1]]), 316.94, new Set(), 'amazon.com', key);
  assert.deepEqual(plan, [{ name: 'Order from amazon.com', price: 316.94, key: null }]);
});

test('a placeholder read never becomes a charge on its own; with a total it becomes the order', () => {
  assert.deepEqual(confirmPlan(read([['Item in cart', 1]]), null, new Set(), 'amazon.com', key), []);
  assert.deepEqual(confirmPlan(read([['Item in cart', 1]]), 52, new Set(), 'amazon.com', key), [{ name: 'Order from amazon.com', price: 52, key: null }]);
  assert.deepEqual(confirmPlan(null, 52, new Set(), 'amazon.com', key), [{ name: 'Order from amazon.com', price: 52, key: null }]);
  assert.deepEqual(confirmPlan(null, null, new Set(), 'amazon.com', key), []);
});

test('what the card already posted this week is not posted twice', () => {
  const plan = confirmPlan(read([['AirPods Pro', 179], ['Case', 20]]), 215, new Set(['airpods pro']), 'amazon.com', key);
  assert.deepEqual(plan, [{ name: 'Order from amazon.com', price: 215, key: null }], 'the one unposted line does not explain a $215 total');
  const plan2 = confirmPlan(read([['AirPods Pro', 179], ['Case', 20]]), null, new Set(['airpods pro']), 'amazon.com', key);
  assert.deepEqual(plan2.map((c) => c.name), ['Case']);
});
