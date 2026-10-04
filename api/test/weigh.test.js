// Reader five: a text about a purchase is judged exactly like the cart. Model off here, so this is the deterministic
// floor: the price in the text is the reader, the rules decide, the lines come from the pool.

const test = require('node:test');
const assert = require('node:assert/strict');
const { weigh, fallbackItems, looksLikePurchase } = require('../notify/weigh');
const v2 = require('../judge/rules_v2');

const week = { budget: 75, spent: 50 }; // $25 left, like the seed
const fresh = () => ({ items: {}, pending: null, history: [], promises: [], commented: [] });

test('the price in the text is read without a model', () => {
  assert.deepEqual(fallbackItems('I want to buy AirPods Pro for $249'), [{ item: 'AirPods Pro', price: 249 }]);
  assert.deepEqual(fallbackItems('should i get the Instax Mini 99, $255?'), [{ item: 'Instax Mini 99', price: 255 }]);
  assert.deepEqual(fallbackItems('thinking about a kettle at 40 dollars'), [{ item: 'kettle', price: 40 }]);
  assert.deepEqual(fallbackItems('rice $24 and airpods $249'), [{ item: 'rice', price: 24 }, { item: 'airpods', price: 249 }]);
  assert.equal(looksLikePurchase('how much do I have left'), false);
  assert.equal(looksLikePurchase('can i get these'), true);
});

test('a text and the cart give the same verdict', async () => {
  const mem = fresh();
  const byText = await weigh({ text: 'I want to buy AirPods Pro for $249', mem, week });
  const byCart = v2.judge({ item: 'AirPods Pro', price: 249 }, week, {}, { loudness: 'mama' });
  assert.equal(byText.verdicts[0].label, byCart.label);
  assert.equal(byText.verdicts[0].react, byCart.react);
});

test('first sighting: one question with the price, then the answer is remembered', async () => {
  const mem = fresh();
  const ask = await weigh({ text: 'I want to buy AirPods Pro for $249', mem, week });
  assert.equal(ask.intent, 'weigh');
  assert.match(ask.reply, /AirPods Pro/);
  assert.match(ask.reply, /\$249/);
  assert.equal(mem.pending.kind, 'ask');

  const blown = await weigh({ text: 'I just want them', mem, week });
  assert.equal(blown.intent, 'answer');
  assert.equal(mem.items[v2.keyOf({ item: 'AirPods Pro' })], 'want');
  assert.equal(mem.pending, null);
  assert.match(blown.reply, /249/);
  assert.match(blown.reply, /\b(25|75)\b/); // what is left, or the week she set
  assert.equal(blown.mood, 'shocked');
  assert.ok(!/\byou are (stupid|wasteful|bad)\b/i.test(blown.reply));

  // Next time she does not ask again: the week decides straight away.
  const again = await weigh({ text: 'ok what about AirPods Pro for $249', mem, week });
  assert.equal(again.mood, 'shocked');
  assert.equal(again.verdicts[0].react, true);
});

test('an occasion plans it and a need is remembered; neither is ever scolded', async () => {
  const mem = fresh();
  await weigh({ text: 'should I buy a suit for $476', mem, week });
  const planned = await weigh({ text: 'graduation', mem, week });
  assert.equal(mem.items[v2.keyOf({ item: 'suit' })], 'planned');
  assert.match(planned.reply, /suit/i);
  assert.equal((await weigh({ text: 'buy a suit for $476', mem, week })).verdicts[0].react, false);

  const mem2 = fresh();
  await weigh({ text: 'thinking of a laptop charger for $60', mem: mem2, week });
  const need = await weigh({ text: 'mine broke and I have a lab due', mem: mem2, week });
  assert.equal(mem2.items[v2.keyOf({ item: 'laptop charger' })], 'need');
  assert.equal(need.react, 'like');
});

test('a want that fits the week is a thumbs up and what is left after', async () => {
  const mem = fresh();
  mem.items[v2.keyOf({ item: 'bubble tea' })] = 'want';
  const r = await weigh({ text: 'bubble tea $7', mem, week });
  assert.equal(r.react, 'like');
  assert.match(r.reply, /\$18/);
  assert.equal(r.mood, 'calm');
});

test('a need alone is a thumbs up and no words', async () => {
  const mem = fresh();
  const r = await weigh({ text: 'buying rice for $24', mem, week });
  assert.equal(r.react, 'like');
  assert.equal(r.reply, '');
  assert.equal(r.verdicts[0].label, 'need');
});

test('nothing to weigh hands the text back to the conversation; a photo she cannot read says so', async () => {
  const mem = fresh();
  assert.equal(await weigh({ text: 'sorry mama, no more doordash this week', mem, week }), null);
  const r = await weigh({ text: '', images: [{ data: 'AAAA', mediaType: 'image/png' }], mem, week });
  assert.match(r.reply, /tell me|what it is|price/i);
});

test('a stale question is dropped, never answered a day later', async () => {
  const mem = fresh();
  await weigh({ text: 'I want to buy AirPods Pro for $249', mem, week, now: 1000 });
  const r = await weigh({ text: 'I just want them', mem, week, now: 1000 + 31 * 60 * 1000 });
  assert.equal(r, null);
  assert.equal(mem.items[v2.keyOf({ item: 'AirPods Pro' })], undefined);
});
