// Texting her about the ledger: what you bought, what is due, what is saved. Deterministic floor, model off.

const test = require('node:test');
const assert = require('node:assert/strict');
const { boughtLine, billsLine, savingsLine } = require('../notify/chat');
const { parse } = require('../notify/parse');

const week = { budget: 75, spent: 50, kept: 40 };
const view = {
  thisWeek: [
    { item: 'Food delivery', amount: 19, merchant: 'DoorDash', tag: 'want', date: '2026-10-01' },
    { item: 'Bubble tea', amount: 9, merchant: 'Boba shop', tag: 'want', date: '2026-09-30' },
    { item: 'Groceries', amount: 22, merchant: 'Kroger', tag: 'need', date: '2026-09-28' },
  ],
  month: { topWants: [{ merchant: 'DoorDash', amount: 102 }], bills: [{ nickname: 'Rent', payee: 'Landlord', amount: 650, daysUntil: 4 }], sentHome: 50 },
  savings: 640,
};

test('the questions parse without an amount and never collide with the commands', () => {
  assert.equal(parse('what did I buy this week').intent, 'bought');
  assert.deepEqual(parse('how much did i spend on doordash'), { intent: 'bought', about: 'doordash' });
  assert.equal(parse('what bills are coming').intent, 'bills');
  assert.equal(parse('when is rent due').intent, 'bills');
  assert.equal(parse('what is in my savings').intent, 'savings');
  assert.equal(parse('how much do I have left').intent, 'left');
  assert.deepEqual(parse('move 40 to savings'), { intent: 'save', amount: 40 });
  assert.deepEqual(parse('send 50 home'), { intent: 'home', amount: 50 });
});

test('what you bought: wants only, with where and when, then the week', () => {
  const l = boughtLine(view, null, week, 'mama');
  assert.match(l, /Food delivery \$19 \(DoorDash, Thu\)/);
  assert.match(l, /Bubble tea \$9/);
  assert.doesNotMatch(l, /Groceries/, 'needs are not listed as spending');
  assert.match(l, /\$50 on wants, \$25 left/);
});

test('spending at one merchant: this week and the month', () => {
  const l = boughtLine(view, 'doordash', week, 'mama');
  assert.match(l, /\$19 at DoorDash this week/);
  assert.match(l, /\$102 in the last 30 days/);
  assert.match(boughtLine(view, 'target', week, 'nana'), /Nothing at target/);
});

test('bills and savings read straight from the ledger', () => {
  assert.equal(billsLine(view, 'mama'), 'Rent, $650, due in 4 days. That is it this month.');
  assert.equal(savingsLine(view, week), '$640 in savings. $40 kept this week. $50 went home this month.');
  assert.match(billsLine({ month: { bills: [] } }, 'nana'), /Nothing due/);
});

test('one word picks the grandma for the thread; garbage picks nobody', () => {
  assert.deepEqual(parse('abuela'), { intent: 'grandma', who: 'abuela' });
  assert.deepEqual(parse('po po'), { intent: 'grandma', who: 'wong' });
  assert.deepEqual(parse('switch to nana'), { intent: 'grandma', who: 'nana' });
  assert.deepEqual(parse('Mama!'), { intent: 'grandma', who: 'mama' });
  assert.notEqual(parse('abuelas are the best').intent, 'grandma');
  const { GRANDMAS } = require('../lines/character');
  assert.deepEqual(Object.keys(GRANDMAS), ['mama', 'nana', 'abuela', 'wong']);
});
