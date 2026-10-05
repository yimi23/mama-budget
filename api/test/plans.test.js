const { test } = require('node:test');
const assert = require('node:assert/strict');
const { comparingPlans } = require('../lines/model.js');

const grid = 'Pricing Free $0 Starter $5 / month 30k credits Creator $22 / month 100k credits Pro $99 / month Scale $330 / month Compare plans';
const plan = (name, price) => ({ items: [{ name, qty: 1, unitPrice: price, period: 'month' }], subtotal: null, confidence: 0.9 });

test('a pricing grid with nothing chosen is comparing, not buying', () => {
  assert.equal(comparingPlans(grid, plan('Starter', 5)), true);
  assert.equal(comparingPlans(grid, plan('Creator', 22)), true);
});

test('a plan being paid for still reads: a subtotal, a pay control, or a current plan marker', () => {
  assert.equal(comparingPlans(grid + ' Order summary Creator $22 / month Subtotal $22 Pay now', { ...plan('Creator', 22), subtotal: 22 }), false);
  assert.equal(comparingPlans(grid + ' Pay now', plan('Creator', 22)), false);
  assert.equal(comparingPlans('Creator $22 / month Your plan renews on Nov 4 Current plan', plan('Creator', 22)), false);
});

test('a cart of goods is never a plan comparison, and one recurring price is a real plan page', () => {
  assert.equal(comparingPlans('Rice 20 lb $24 Dish soap $4 Subtotal $28', { items: [{ name: 'Rice', qty: 1, unitPrice: 24, period: 'once' }], subtotal: 28 }), false);
  assert.equal(comparingPlans('ChatGPT Plus $20 / month Upgrade to Plus', plan('ChatGPT Plus', 20)), false);
});
