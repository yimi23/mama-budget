// Rules v2: protect the obvious, ask once, remember, and let the envelope decide the volume.
// These pin the product rules in CLAUDE.md. v1 (rules.js) is frozen separately for the 50 case score.
const test = require('node:test');
const assert = require('node:assert');
const { judge, remember } = require('../judge/rules_v2');
const { lineFor, ackLine } = require('../lines/writer');

const week = { budget: 75, spent: 50 }; // the demo seed: $25 left

test('a protected need never opens anything, whatever the price', () => {
  const r = judge({ item: 'Iberia Jasmine Long Grain Fragrant Rice, 18 Pound', price: 25.18 }, week);
  assert.deepEqual([r.label, r.react], ['need', false]);
});

test('a new item over the line gets one neutral ask', () => {
  const r = judge({ item: 'AirPods Pro, 2nd gen', price: 179 }, week);
  assert.deepEqual([r.label, r.react, r.mood, r.key], ['ask', false, 'watching', 'airpods pro']);
});

test('a new item under the line is a quiet want, never an ask', () => {
  const r = judge({ item: 'Signet rings', price: 13.99 }, week);
  assert.deepEqual([r.label, r.react], ['want', false]);
});

test('an answer of need is remembered for good', () => {
  const memory = remember({}, { item: 'AirPods Pro, 2nd gen' }, 'need');
  const r = judge({ item: 'AirPods Pro, 2nd gen', price: 179 }, week, memory);
  assert.deepEqual([r.label, r.react], ['need', false]);
});

test('an admitted want that blows the week gets the Shocked card', () => {
  const memory = remember({}, { item: 'AirPods Pro, 2nd gen' }, 'want');
  const r = judge({ item: 'AirPods Pro, 2nd gen', price: 179 }, week, memory);
  assert.deepEqual([r.label, r.react, r.mood], ['want', true, 'shocked']);
  assert.ok(r.tags.includes('blown'));
});

test('an admitted want that fits the week is a nod, not a card', () => {
  const memory = remember({}, { item: 'Desk lamp' }, 'want');
  const r = judge({ item: 'Desk lamp', price: 20 }, week, memory);
  assert.deepEqual([r.label, r.react], ['want', false]);
  assert.ok(r.tags.includes('fits'));
});

test('her line keeps the product casing and starts with a capital', () => {
  const v = judge({ item: 'The Hard Thing About Hard Things', price: 27.42 }, week);
  const line = lineFor(v, { item: 'The Hard Thing About Hard Things', price: 27.42 }, week);
  assert.match(line, /^[A-Z]/);
  assert.ok(line.includes('The Hard Thing About Hard Things'), line);
  assert.doesNotMatch(line, /[-–—]/, 'no dashes in copy');
});

test('Mama adds the naira, except on a store already in naira', () => {
  const memory = remember({}, { item: 'AirPods Pro' }, 'want');
  const v = judge({ item: 'AirPods Pro', price: 179 }, week, memory);
  assert.match(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'USD' }, week), /naira/);
  assert.doesNotMatch(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'NGN' }, week), /naira/);
  assert.doesNotMatch(lineFor(v, { item: 'AirPods Pro', price: 179 }, week, 'nana'), /naira/);
});

test('every answer gets an acknowledgement; a declared need gets no comment on its price', () => {
  const need = judge({ item: 'Tamron lens', price: 1260 }, week, remember({}, { item: 'Tamron lens' }, 'need'));
  assert.equal(ackLine(need, { item: 'Tamron lens', price: 1260 }), 'Okay. I will remember.');
  assert.equal(ackLine(need, { item: 'Tamron lens', price: 1260 }, 'nana'), 'Okay. Noted.');
  const fits = judge({ item: 'Desk lamp', price: 20 }, week, remember({}, { item: 'Desk lamp' }, 'want'));
  assert.match(ackLine(fits, { item: 'Desk lamp', price: 20 }), /Carry on|fits/);
  const blown = judge({ item: 'AirPods Pro', price: 179 }, week, remember({}, { item: 'AirPods Pro' }, 'want'));
  assert.equal(ackLine(blown, { item: 'AirPods Pro', price: 179 }), null, 'a blown want gets the card, not a bubble');
  assert.equal(ackLine(judge({ item: 'Rice', price: 20 }, week), { item: 'Rice' }), null, 'protected needs were never asked');
});
