// She never says the same line twice in a row in one situation, and a pool of lines is actually used.

const test = require('node:test');
const assert = require('node:assert/strict');
const { pick, recent, reset, WINDOW_MAX } = require('../lines/pick');
const { textLine } = require('../lines/texts');
const writer = require('../lines/writer');

test('no repeat inside the window, every line of the pool gets its turn', () => {
  reset();
  const pool = ['a', 'b', 'c', 'd'];
  const seen = [];
  for (let i = 0; i < 40; i++) seen.push(pick('mama', 'calm', pool));
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `repeat at ${i}`);
  assert.equal(new Set(seen).size, 4);
  assert.ok(recent('mama', 'calm').length <= WINDOW_MAX);
  // Within any window of three consecutive picks from a pool of four, no line appears twice.
  for (let i = 3; i < seen.length; i++) assert.equal(new Set(seen.slice(i - 3, i)).size, 3, `window at ${i}`);
});

test('a pool of one is itself; an empty pool is silence, never a crash', () => {
  assert.equal(pick('nana', 'x', ['only']), 'only');
  assert.equal(pick('nana', 'x', []), '');
  assert.equal(pick('nana', 'x', undefined), '');
});

test('text lines and card lines draw from their pools, not from the item name', () => {
  reset();
  const texts = new Set();
  for (let i = 0; i < 12; i++) texts.add(textLine('saved', { amount: 20, who: 'mama' }));
  assert.ok(texts.size >= 2, 'both saved lines were used');
  const acks = new Set();
  const v = { label: 'want', tags: ['remembered', 'fits'] };
  for (let i = 0; i < 12; i++) acks.add(writer.ackLine(v, { item: 'Bubble tea', price: 7 }, 'mama'));
  assert.ok(acks.size >= 2, 'the same item gets different acks over time');
  reset();
});
