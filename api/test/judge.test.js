const test = require('node:test');
const assert = require('node:assert');
const { judge, merchantOnly } = require('../judge/rules');
const baseline = require('../../data/baseline.json');

const month = { budget: 300, spent: 210 };

test('rule 01: a need never reacts', () => {
  const r = judge({ item: '20 lb bag of rice', price: 24, merchant: 'Target', context: 'Monthly staple, pantry empty' }, month);
  assert.equal(r.label, 'need');
  assert.equal(r.react, false);
});

test('money sent home is never waste', () => {
  const r = judge({ item: 'Money sent home to family', price: 50, merchant: 'Remitly', context: 'Monthly, parents' }, month);
  assert.equal(r.label, 'need');
  assert.equal(r.react, false);
  assert.ok(r.tags.includes('family'));
});

test('AirPods at Target set her off', () => {
  const r = judge({ item: 'AirPods Pro', price: 179, merchant: 'Target', context: 'Has working wired earbuds' }, month);
  assert.equal(r.label, 'want');
  assert.equal(r.react, true);
  assert.equal(r.mood, 'down'); // 210 + 179 blows a 300 budget
});

test('same store, different answer', () => {
  const rice = judge({ item: '20 lb bag of rice', price: 24, merchant: 'Target' }, month);
  const pods = judge({ item: 'AirPods Pro', price: 179, merchant: 'Target' }, month);
  assert.notEqual(rice.label, pods.label);
  assert.equal(merchantOnly('General Merchandise', baseline), merchantOnly('General Merchandise', baseline));
});

test('a mixed receipt gets a question, not a scolding', () => {
  const r = judge({ item: 'Toilet paper and a $40 video game, one receipt', price: 52, merchant: 'Walmart' }, month);
  assert.equal(r.label, 'ask');
  assert.equal(r.react, false);
});

test('context turns a want into a question', () => {
  const r = judge({ item: 'Uber, 2 miles', price: 22, merchant: 'Uber', context: '11pm, alone' }, month);
  assert.equal(r.label, 'ask');
  assert.equal(r.react, false);
});

test('a small want gets a nod, not a reaction', () => {
  const r = judge({ item: 'Bubble tea', price: 8, merchant: 'Boba shop', context: '' }, { budget: 300, spent: 50 });
  assert.equal(r.label, 'want');
  assert.equal(r.react, false);
});
