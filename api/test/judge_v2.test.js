// Rules v2: protect the obvious, ask once, remember, and let the envelope decide the volume.
// These pin the product rules in CLAUDE.md. v1 (rules.js) is frozen separately for the 50 case score.
const test = require('node:test');
const assert = require('node:assert');
const { judge, remember } = require('../judge/rules_v2');
const { lineFor, shopName, backHome, ackLine, buyLine, buyText, smallLines, watchLines } = require('../lines/writer');

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

test('the figure back home follows the person, not the grandma', () => {
  const memory = remember({}, { item: 'AirPods Pro' }, 'want');
  const v = judge({ item: 'AirPods Pro', price: 179 }, week, memory);
  assert.match(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'USD', home: 'NGN' }, week), /286,400 naira/);
  assert.match(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'USD', home: 'NGN' }, week, 'nana'), /naira/, 'a Nigerian with Nana still gets naira');
  assert.doesNotMatch(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'USD' }, week), /naira/, 'no home currency, no figure');
  assert.doesNotMatch(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'NGN', home: 'NGN' }, week), /naira/, 'store already in naira');
  assert.match(lineFor(v, { item: 'AirPods Pro', price: 179, currency: 'USD', home: 'GHS' }, week), /cedis/);
  assert.equal(backHome(100, { home: 'INR', currency: 'USD' }), ' That is 8,400 rupees.');
});

test('every answer gets an acknowledgement; a declared need gets no comment on its price', () => {
  const need = judge({ item: 'Tamron lens', price: 1260 }, week, remember({}, { item: 'Tamron lens' }, 'need'));
  const { MAMA, NANA } = require('../lines/writer');
  const m = ackLine(need, { item: 'Tamron lens', price: 1260 });
  assert.ok(MAMA.ackNeed.includes(m), `from the ackNeed pool: ${m}`);
  assert.doesNotMatch(m, /1260/, 'no comment on the price of a need');
  assert.ok(NANA.ackNeed.includes(ackLine(need, { item: 'Tamron lens', price: 1260 }, 'nana')));
  const fits = judge({ item: 'Desk lamp', price: 20 }, week, remember({}, { item: 'Desk lamp' }, 'want'));
  assert.match(ackLine(fits, { item: 'Desk lamp', price: 20 }), /Carry on|fits/);
  const blown = judge({ item: 'AirPods Pro', price: 179 }, week, remember({}, { item: 'AirPods Pro' }, 'want'));
  assert.equal(ackLine(blown, { item: 'AirPods Pro', price: 179 }), null, 'a blown want gets the card, not a bubble');
  assert.equal(ackLine(judge({ item: 'Rice', price: 20 }, week), { item: 'Rice' }), null, 'protected needs were never asked');
});

test('after a charge: Gele down past the envelope, a note inside it, numbers in the text', () => {
  const blown = { budget: 75, spent: 229, ratio: 229 / 75 };
  const inside = { budget: 75, spent: 70, ratio: 70 / 75 };
  const pods = { item: 'AirPods Pro', price: 179, currency: 'USD' };
  assert.match(buyLine(blown, { ...pods, home: 'NGN' }), /naira/);
  assert.doesNotMatch(buyLine(blown, { ...pods, currency: 'NGN', home: 'NGN' }), /naira/);
  assert.doesNotMatch(buyLine(blown, pods), /naira/);
  assert.doesNotMatch(buyLine(inside, { item: 'Desk lamp', price: 20 }), /naira/);
  assert.match(buyText(blown, pods), /\$179 on AirPods Pro\. \$229 of \$75 fun money gone this week\. \$0 left\./);
  assert.ok(smallLines().agreed && smallLines().proud && smallLines('nana').agreed);
  for (const l of [buyLine(blown, pods), buyLine(inside, pods), smallLines().agreed, smallLines().proud]) assert.doesNotMatch(l, /[-–—]/, 'no dashes in copy');
});

test('every loud line names the plan: the price, the item, and the week', () => {
  const memory = remember({}, { item: 'AirPods Pro' }, 'want');
  const v = judge({ item: 'AirPods Pro', price: 179 }, week, memory);
  const it = { item: 'AirPods Pro', price: 179, merchant: 'amazon.com', currency: 'USD' };
  for (const who of ['mama', 'nana']) {
    const line = lineFor(v, it, week, who);
    assert.match(line, /179/, `${who} names the price: ${line}`);
    assert.ok(/AirPods Pro|25|75/.test(line), `${who} names the item or the week: ${line}`);
    assert.doesNotMatch(line, /rice|came to/i, 'the pantry is not the point');
  }
  const small = judge({ item: 'Desk lamp', price: 40 }, week, remember({}, { item: 'Desk lamp' }, 'want'));
  const beatsLeft = lineFor(small, { item: 'Desk lamp', price: 40 }, week);
  assert.match(beatsLeft, /40/, `beats what is left names the price: ${beatsLeft}`);
  assert.match(beatsLeft, /\b25\b/, `beats what is left names what is left: ${beatsLeft}`);
  const beatsWeek = lineFor(v, it, week);
  assert.match(beatsWeek, /179/, `beats the whole week names the price: ${beatsWeek}`);
  assert.match(beatsWeek, /\b75\b/, `beats the whole week names the week: ${beatsWeek}`);
  const over = { budget: 75, spent: 229, ratio: 229 / 75 };
  assert.match(buyLine(over, it), /154/, 'past the week she names how far over');
  assert.equal(shopName('jumia.com.ng'), 'Jumia');
  assert.equal(shopName('Target'), 'Target');
});

test('loudness scales the ask line, never the math', () => {
  const lamp = (loudness) => judge({ item: 'Desk lamp', price: 30 }, week, {}, { loudness, now: new Date(2026, 9, 4, 12) });
  assert.equal(lamp('full').label, 'ask');
  assert.equal(lamp('mama').label, 'ask');
  assert.equal(lamp('gentle').label, 'want', 'Gentle Auntie asks from $40');
  assert.equal(judge({ item: 'Desk lamp', price: 30 }, week).label, 'ask', 'no tier given: the $15 line');
});

test('on a naira store she says the store price first, dollars after, and adds no naira line', () => {
  const memory = remember({}, { item: 'AirPods Pro' }, 'want');
  const v = judge({ item: 'AirPods Pro', price: 179 }, week, memory);
  const line = lineFor(v, { item: 'AirPods Pro', price: 179, storePrice: 286400, currency: 'NGN', home: 'NGN' }, week);
  assert.match(line, /₦286,400 \(179 dollars\)/);
  assert.doesNotMatch(line, /That is .* naira/);
  const usd = lineFor(v, { item: 'AirPods Pro', price: 179, storePrice: 179, currency: 'USD' }, week);
  assert.match(usd, /179 dollars/);
  assert.doesNotMatch(usd, /naira|₦/);
});

test('a watch carries what she says when that site opens', () => {
  const ws = watchLines([{ merchant: 'DoorDash', amount: 102, category: 'Food Delivery' }, { merchant: 'Bar', amount: 16, category: 'Bars' }]);
  assert.equal(ws[0].merchant, 'DoorDash');
  assert.equal(ws[0].here, 'DoorDash. I said I would say something. $102 here last month.');
  assert.match(watchLines([{ merchant: 'Target', amount: 40, category: 'Shopping' }], 'nana')[0].here, /^Target, hon\./);
  for (const w of ws) assert.doesNotMatch(w.here, /[—–-]/);
});

test('a reason that names an occasion makes a plan; a dressed up want does not', () => {
  const { occasionOf, isJustWant } = require('../judge/reasons');
  assert.equal(occasionOf('for my graduation next month'), 'graduation');
  assert.equal(occasionOf('Job interview on Friday'), 'interview');
  assert.equal(occasionOf('I just want it'), null);
  assert.equal(isJustWant('because I want it'), true);
  assert.equal(occasionOf(''), null);
  const memory = remember({}, { item: 'Checked wool suit' }, 'planned');
  const v = judge({ item: 'Checked wool suit', price: 476 }, week, memory);
  assert.deepEqual([v.label, v.react], ['need', false], 'planned is never scolded');
});

test('on a watched merchant she asks about anything over $5 and says why', () => {
  const r = judge({ item: 'Bubble tea', price: 12, merchant: 'doordash.com' }, week, {}, { watched: { merchant: 'DoorDash', amount: 102 } });
  assert.deepEqual([r.label, r.tags.includes('watched')], ['ask', true]);
  assert.equal(judge({ item: 'Bubble tea', price: 12, merchant: 'doordash.com' }, week).label, 'want', 'elsewhere $12 is a nod');
  const v = judge({ item: 'Bubble tea', price: 12 }, week, {}, { watched: { merchant: 'DoorDash', amount: 102 } });
  const line = lineFor(v, { item: 'Bubble tea', price: 12, merchant: 'doordash.com', watched: { merchant: 'DoorDash', amount: 102 } }, week);
  assert.match(line, /DoorDash/, `names the merchant she watches: ${line}`);
  assert.match(line, /102/, `names the habit: ${line}`);
});

test('necessity comes from context when known; the word list is only the fallback', () => {
  const bowl = { item: 'Chicken bowl', price: 12, merchant: 'doordash.com' };
  assert.equal(judge(bowl, week).label, 'need', 'no context: the list sees chicken');
  assert.equal(judge(bowl, week, {}, { necessity: false }).label, 'want', 'context says takeout: discretionary, a small want');
  assert.equal(judge({ item: 'Fancy tote', price: 40 }, week, {}, { necessity: true }).label, 'need', 'context can also protect');
  const r = judge(bowl, week, {}, { necessity: false, watched: { merchant: 'DoorDash', amount: 102 } });
  assert.equal(r.label, 'ask', 'on a watched merchant the small want becomes a question');
});
