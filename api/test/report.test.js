// The Sunday report: six lines in her order, numbers only, nothing about the person.
const test = require('node:test');
const assert = require('node:assert/strict');
const { report, dayName } = require('../budget/report');
const { weeklyStatement, weeklyReport } = require('../lines/writer');

const base = { week: { envelope: 300, spent: 240, kept: 40 }, lastWeek: { spent: 290 }, biggest: { item: 'DoorDash', amount: 48, day: 'Thursday' }, streak: 3, graced: false, jar: 410, closed: true, carry: 0, nextEnvelope: 300, close: 'Good week.' };

test('a kept week: what stayed first, then last week, the biggest thing with its day, the streak, the jar, Monday', () => {
  const r = report(base);
  assert.deepEqual(r.lines, [
    '$60 stayed in the envelope. $240 of $300 gone.',
    'Last week $290 went. Better.',
    'Biggest thing: DoorDash, $48, Thursday.',
    '3 weeks kept in a row.',
    'You put back $40. The jar is $410.',
    'Monday: $300 goes in. Good week.',
  ]);
  assert.equal(r.fields.result.arrow, 'better');
  assert.equal(r.fields.monday.envelope, 300);
});

test('an over week: the overage and the carry lead, the jar sits beside it, a new streak starts Monday', () => {
  const r = report({ ...base, week: { envelope: 300, spent: 360, kept: 0 }, streak: 0, carry: 60, nextEnvelope: 240, close: 'We will do better. I am not angry.' });
  assert.equal(r.lines[0], '$60 over this week: $360 of $300 gone. $60 carries to Monday.');
  assert.equal(r.lines[1], 'Last week $290 went. More this week.');
  assert.equal(r.lines[3], 'A new streak starts Monday.');
  assert.equal(r.lines[4], 'The jar is $410.');
  assert.equal(r.lines[5], 'Monday: $240 goes in. One less DoorDash and the week is yours. We will do better. I am not angry.');
  assert.equal(r.lines.length, 6);
});

test('a graced week keeps the streak; mid-week reads "so far"; no name ever appears', () => {
  const g = report({ ...base, week: { envelope: 300, spent: 330, kept: 0 }, graced: true, streak: 4 });
  assert.equal(g.lines[3], 'Grace used this month. The streak stands at 4.');
  const mid = report({ ...base, closed: false, lastWeek: null, streak: 2 });
  assert.match(mid.lines[0], /stayed in the envelope so far/);
  assert.equal(mid.lines.length, 5); // no last week line
  assert.equal(dayName('2026-10-08'), 'Thursday');
  for (const l of [...g.lines, ...mid.lines]) assert.doesNotMatch(l, /\byou are\b|\blazy\b|\bPraise\b/i);
});

test('the writer folds her one line into the last line and still takes the old shape', () => {
  const s = weeklyStatement({ week: { budget: 75, spent: 50, kept: 40, daysLeft: 0, bills: [] }, biggest: { item: 'Latte', amount: 6 }, who: 'nana', trend: -1 });
  const lines = s.split('\n');
  assert.equal(lines.length, 6);
  assert.match(lines[5], /^Monday: \$75 goes in\. Better than last week\. I noticed\.$/);
  const r = weeklyReport(base, 'mama');
  assert.equal(r.fields.jar, 410);
  assert.match(r.lines[5], /Better than last week/);
});
