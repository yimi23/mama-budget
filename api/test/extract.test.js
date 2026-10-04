const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verified } = require('../lines/model.js');

test('a fast read is kept only when its items add up to the subtotal', () => {
  const zara = { items: [{ unitPrice: 79.9, qty: 1 }, { unitPrice: 476, qty: 1 }, { unitPrice: 438.7, qty: 1 }], subtotal: 994.6, confidence: 0.95 };
  assert.equal(verified(zara), true);
  // Target: the fast model added a protection plan nobody put in the cart. 616.57 of items, plus 75 of plan, is not 616.57.
  const target = { items: [{ unitPrice: 599.99, qty: 1 }, { unitPrice: 9.99, qty: 1 }, { unitPrice: 6.59, qty: 1 }, { unitPrice: 75, qty: 1 }], subtotal: 616.57, confidence: 0.9 };
  assert.equal(verified(target), false);
});

test('no subtotal on the page: the fast read is kept only when it is sure, and never when empty', () => {
  assert.equal(verified({ items: [{ unitPrice: 20, qty: 1 }], subtotal: null, confidence: 0.9 }), true);
  assert.equal(verified({ items: [{ unitPrice: 20, qty: 1 }], subtotal: null, confidence: 0.6 }), false);
  assert.equal(verified({ items: [], subtotal: null, confidence: 0.99 }), false);
  assert.equal(verified(null), false);
});

const { pageFacts } = require('../lines/model.js');

test('the page states the subtotal and the count; the check uses those, not the model', () => {
  const walmart = 'Items (3) $1,270.39 Items (3), Previous subtotal of $1,270.39 Savings -$0.46 Subtotal $1,269.93 Estimated total $1,269.93';
  assert.deepEqual(pageFacts(walmart), { subtotal: 1269.93, count: 3 });
  const target = 'Save your items for later Subtotal (3 items) $616.57';
  assert.deepEqual(pageFacts(target), { subtotal: 616.57, count: 3 });
  // The fast model's invented subtotal of 691.57 does not save a read with a plan nobody chose.
  const read = { items: [{ unitPrice: 599.99, qty: 1 }, { unitPrice: 75, qty: 1 }, { unitPrice: 8.99, qty: 1 }, { unitPrice: 7.59, qty: 1 }], subtotal: 691.57, confidence: 0.9 };
  assert.equal(verified(read, pageFacts(target)), false);
  // One line called "Amazon Cart (4 items)" is not four items.
  assert.equal(verified({ items: [{ name: 'Amazon Cart (4 items)', unitPrice: 321.54, qty: 1 }], subtotal: 321.54, confidence: 0.9 }, pageFacts('Subtotal (4 items): $321.54')), false);
});
