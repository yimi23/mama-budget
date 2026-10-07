// The shelf and the confirm tap, on the budget core: a confirmed early stream is a bill, "not a bill" drops it,
// a put-back sits on the shelf until let go, and letting go never takes the kept credit out of the week.
const test = require('node:test');
const assert = require('node:assert/strict');
const recurring = require('../budget/recurring');
const budget = require('../budget');
const week = require('../budget/week');

const DAY = 86400;
const row = (i, amount, desc, daysAgo, now) => ({ id: `r${i}`, accountId: 'chk', amount, posted: now - daysAgo * DAY, transactedAt: now - daysAgo * DAY, description: desc, payee: desc, mcc: '', pending: false });

test('an early two-hit monthly stream is mature once confirmed, and gone when marked not a bill', () => {
  const now = 1_800_000_000;
  const rows = [row(1, -89, 'PLANET FIT CLUB', 40, now), row(2, -89, 'PLANET FIT CLUB', 10, now)];
  const early = recurring.streams(rows, now).find((s) => s.key.includes('planet'));
  assert.ok(early, 'stream found');
  assert.equal(early.status, 'early');
  const confirmed = recurring.streams(rows, now, { confirmed: [early.key] }).find((s) => s.key === early.key);
  assert.equal(confirmed.status, 'mature');
  assert.equal(recurring.streams(rows, now, { notRecurring: [early.key] }).some((s) => s.key === early.key), false);
});

test('shelf rows: newest first, let go leaves the shelf but keeps the week credit, still marks planned', () => {
  const list = [
    { requestId: 'a', item: 'AirPods', amount: 249, store: 'bestbuy.com', date: '2026-10-05' },
    { requestId: 'b', item: 'Tree Runners', amount: 100, store: 'allbirds.com', date: '2026-10-06' },
  ];
  const shelf = budget.shelfRows(list);
  assert.deepEqual(shelf.map((s) => s.requestId), ['b', 'a']);
  const after = budget.shelfRows(list.map((k) => (k.requestId === 'a' ? { ...k, gone: 'let' } : { ...k, still: true })));
  assert.deepEqual(after.map((s) => [s.requestId, s.still]), [['b', true]]);
  // The kept credit counts every put-back of the week, let go or not.
  const now = Date.parse('2026-10-07T12:00:00Z') / 1000;
  const w = week.current([], { envelope: 300, closes: [], graces: { used: [], banked: 0 }, jar: 0 }, now, list.map((k) => (k.requestId === 'a' ? { ...k, gone: 'let' } : k)));
  assert.equal(w.kept, 349);
});
