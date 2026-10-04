// Messages: what she understands when texted, when she is allowed to text first, and when the statements go.
// Nothing here touches Messages.app, Spectrum or the Nessie cache.
const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../notify/parse');
const { gate, quiet } = require('../photon/gate');
const { due, weeklyText, nextSunday7, nextMonthEnd7 } = require('../photon/schedule');
const { textLine } = require('../lines/texts');
const { weeklyStatement, whatsLeft } = require('../lines/writer');
const kit = require('../photon/kit');

const at = (iso) => new Date(iso);

test('she understands "how much do I have left" in a few shapes', () => {
  for (const t of ['how much do I have left', 'How much do i have left?', 'whats left', 'what is left', 'left?', 'how much left', 'wetin remain', 'balance'])
    assert.equal(parse(t).intent, 'left', t);
});

test('"move 40 to savings" and friends are a save with the amount', () => {
  assert.deepEqual(parse('move 40 to savings'), { intent: 'save', amount: 40 });
  assert.deepEqual(parse('Move $40 to savings please'), { intent: 'save', amount: 40 });
  assert.deepEqual(parse('save 25 dollars'), { intent: 'save', amount: 25 });
  assert.deepEqual(parse('put 10 away'), { intent: 'save', amount: 10 });
  assert.deepEqual(parse('save'), { intent: 'save', amount: null });
});

test('"send 50 home" is money to family with the amount', () => {
  assert.deepEqual(parse('send 50 home'), { intent: 'home', amount: 50 });
  assert.deepEqual(parse('Send $50 to mum'), { intent: 'home', amount: 50 });
  assert.deepEqual(parse('transfer 30 to family'), { intent: 'home', amount: 30 });
  assert.deepEqual(parse('send home'), { intent: 'home', amount: null });
});

test('greetings and thanks are recognised; the rest goes to the conversation', () => {
  assert.equal(parse('hi mama').intent, 'hello');
  assert.equal(parse('thank you').intent, 'thanks');
  assert.equal(parse('sorry mama, no more doordash this week').intent, 'other');
  assert.equal(parse('').intent, 'other');
});

test('the Messages lines name the amount and say nothing about the person', () => {
  const l = textLine('home', { amount: 50, who: 'mama' });
  assert.match(l, /\$50 sent home/);
  assert.doesNotMatch(l, /you always|stupid|wasteful/i);
  assert.match(textLine('tooMuch', { amount: 5000, left: 25, who: 'nana' }), /\$5000\?.*\$25 left/);
  assert.match(textLine('nothing', { who: 'mama' }), /send 50 home/);
});

test('quiet hours are 11pm to 7am', () => {
  assert.equal(quiet(at('2026-10-04T23:00:00')), true);
  assert.equal(quiet(at('2026-10-04T06:59:00')), true);
  assert.equal(quiet(at('2026-10-04T07:00:00')), false);
  assert.equal(quiet(at('2026-10-04T22:59:00')), false);
});

test('an unprompted text is held in quiet hours; a reply or a tap always goes', () => {
  const now = at('2026-10-04T23:30:00');
  assert.equal(gate({ to: '+1', prompted: false, state: {}, now }), 'quiet');
  assert.equal(gate({ to: '+1', prompted: true, state: {}, now }), null);
});

test('unprompted texts keep a gap per person and a daily cap', () => {
  const now = at('2026-10-04T12:00:00');
  const justSent = { sent: { '+1': { at: '2026-10-04T11:59:00', day: '2026-10-4', count: 1 } } };
  assert.equal(gate({ to: '+1', state: justSent, now }), 'gap');
  const earlier = { sent: { '+1': { at: '2026-10-04T08:00:00', day: '2026-10-4', count: 1 } } };
  assert.equal(gate({ to: '+1', state: earlier, now }), 'daily');
  const yesterday = { sent: { '+1': { at: '2026-10-03T08:00:00', day: '2026-10-3', count: 1 } } };
  assert.equal(gate({ to: '+1', state: yesterday, now }), null);
  assert.equal(gate({ to: '+2', state: earlier, now }), null, 'another person is not capped by the first');
});

test('the Mac kit answers only the people on the list, by normalised number', () => {
  const saved = { ALLOW: process.env.PHOTON_ALLOW, TO: process.env.PHOTON_TO };
  process.env.PHOTON_TO = '+1 (734) 555-0100'; delete process.env.PHOTON_ALLOW;
  assert.equal(kit.allowed('+17345550100'), true);
  assert.equal(kit.allowed('7345550100'), true);
  assert.equal(kit.allowed('+17345550199'), false);
  process.env.PHOTON_ALLOW = '*';
  assert.equal(kit.allowed('anyone@example.com'), true);
  process.env.PHOTON_ALLOW = 'Judge@Example.com,+15550001111';
  assert.equal(kit.allowed('judge@example.com'), true);
  assert.equal(kit.allowed('+17345550100'), false, 'PHOTON_TO is not implied once PHOTON_ALLOW is set');
  if (saved.ALLOW == null) delete process.env.PHOTON_ALLOW; else process.env.PHOTON_ALLOW = saved.ALLOW;
  if (saved.TO == null) delete process.env.PHOTON_TO; else process.env.PHOTON_TO = saved.TO;
});

test('the Mac kit is unavailable without PHOTON_TO, whatever a caller passes', async () => {
  const saved = process.env.PHOTON_TO; delete process.env.PHOTON_TO;
  assert.equal(kit.available(), false);
  assert.equal(await kit.send('+17345550100', 'hello'), null);
  if (saved != null) process.env.PHOTON_TO = saved;
});

test('the weekly statement is due Sunday from 7pm, once', () => {
  assert.deepEqual(due(at('2026-10-04T18:59:00'), {}), []);
  assert.deepEqual(due(at('2026-10-04T19:00:00'), {}), ['weekly']);
  assert.deepEqual(due(at('2026-10-04T19:00:00'), { weeklySentFor: '2026-09-28' }), []);
  assert.deepEqual(due(at('2026-10-05T19:00:00'), {}), []);
});

test('the monthly statement is due the last day of the month from 7pm, once', () => {
  assert.deepEqual(due(at('2026-10-31T19:05:00'), {}), ['monthly']);
  assert.deepEqual(due(at('2026-10-31T19:05:00'), { monthlySentFor: '2026-10' }), []);
  assert.deepEqual(due(at('2026-10-30T19:05:00'), {}), []);
});

test('next statement times roll forward correctly', () => {
  assert.equal(nextSunday7(at('2026-10-04T19:01:00')).toISOString(), at('2026-10-11T19:00:00').toISOString());
  assert.equal(nextSunday7(at('2026-10-01T10:00:00')).toISOString(), at('2026-10-04T19:00:00').toISOString());
  assert.equal(nextMonthEnd7(at('2026-10-31T19:01:00')).toISOString(), at('2026-11-30T19:00:00').toISOString());
});

test('the weekly text is four lines: numbers, kept, bill or biggest, one line of her', () => {
  const lines = weeklyText(new Date(), 'mama').split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^This week: \$\d+ of \$\d+ fun money gone, \$\d+ left/);
  assert.match(lines[1], /kept|Nothing kept/);
});

test('statement and text helpers in the writer still name every amount', () => {
  const s = weeklyStatement({ week: { budget: 75, spent: 50, kept: 40, daysLeft: 0, bills: [] }, biggest: { item: 'Latte', amount: 6 }, who: 'nana', trend: -1 });
  assert.match(s, /\$50 of \$75/); assert.match(s, /\$40/); assert.match(s, /Latte, \$6/); assert.match(s, /Better than last week/);
  assert.match(whatsLeft({ budget: 75, spent: 50, daysLeft: 2 }, 'mama'), /^\$25\. 2 days\. That is \$12 a day/);
});
