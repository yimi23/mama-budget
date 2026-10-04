const { test } = require('node:test');
const assert = require('node:assert/strict');
const v2 = require('../judge/rules_v2.js');

test('an answer given under the short name holds under the long one, and the other way round', () => {
  const memory = { 'the let them theory': 'want' };
  const long = { item: 'The Let Them Theory: A Life-Changing Tool That Millions of People Can\'t Stop Talking About', price: 27.95, merchant: 'bookshop.org' };
  const v = v2.judge(long, { budget: 75, spent: 50 }, memory, { loudness: 'mama' });
  assert.notEqual(v.label, 'ask', 'already answered: she does not ask again');
  const short = v2.judge({ item: 'Womens Tree Runner', price: 100 }, { budget: 75, spent: 0 }, { 'womens tree runner natural white': 'need' }, { loudness: 'mama' });
  assert.equal(short.label, 'need');
});

test('short or one word keys never match by prefix', () => {
  assert.equal(v2.recall({ 'rice 20 lb': 'need' }, 'rice'), undefined);
  assert.equal(v2.recall({ 'airpods': 'want' }, 'airpods pro 2nd generation'), undefined);
  assert.equal(v2.recall({ 'airpods pro': 'want' }, 'airpods pro 2nd generation'), 'want');
});
