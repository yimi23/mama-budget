// Safe to spend, the envelope, and the week's rules, on the fixture, to the dollar.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build, TODAY, DAY, CORRECTIONS } = require('../budget/fixture.js');
const transfers = require('../budget/transfers.js');
const recurring = require('../budget/recurring.js');
const { reconcile } = require('../budget/reconcile.js');
const { classify } = require('../budget/kinds.js');
const { plan } = require('../budget/plan.js');
const week = require('../budget/week.js');

function pipeline(now = TODAY) {
  const { rows, accounts } = build();
  const resolved = transfers.resolve(reconcile(rows, now), accounts);
  const streams = recurring.streams(resolved, now, { notRecurring: CORRECTIONS.notRecurring });
  return { rows: classify(resolved, streams, CORRECTIONS), streams, accounts };
}

test('the plan: payday, bills before it, the card, savings, needs, and one weekly number with a true reason', () => {
  const { rows, streams, accounts } = pipeline();
  const p = plan({ rows, streams, accounts, now: TODAY });
  assert.ok(p.payday && p.payday.cadence === 'biweekly', JSON.stringify(p.payday));
  assert.equal(p.payday.amount, 1642.18, 'the bonus month does not inflate the plan');
  assert.equal(p.balance, 1792.17 + 2640, 'available balance where the bank gives it');
  assert.ok(p.bills.every((b) => b.due <= p.payday.at), 'only bills due before payday');
  assert.equal(p.cardOwed, 412.36);
  assert.equal(p.savings, 164.22, '10% of the planned pay when nothing is set');
  assert.equal(p.safe, Math.round((p.balance - p.billsTotal - p.cardOwed - p.savings - p.pendingCash) * 100) / 100);
  assert.ok(p.needsWeekly > 0, 'needs come from the last four weeks');
  assert.ok(p.envelope >= 25 && p.envelope <= 500 && p.envelope % 5 === 0, String(p.envelope));
  assert.match(p.reason, /^\$\d+ a week: your pay/);
  assert.match(p.reason, /save/);
  // A new row recomputes it: a $400 want today lowers safe by 400 only through the balance, which the bank moves.
  const p2 = plan({ rows, streams, accounts: accounts.map((a) => a.id === 'chk' ? { ...a, available: a.available - 400 } : a), now: TODAY });
  assert.equal(p2.safe, Math.round((p.safe - 400) * 100) / 100);
});

test('the week: only wants move the meter; needs and bills are counted but never scolded', () => {
  const { rows } = pipeline();
  const w = week.current(rows, { envelope: 145, closes: [], graces: { used: [], banked: 0 }, jar: 0 }, TODAY);
  assert.equal(w.envelope, 145);
  const wantsThisWeek = rows.filter((r) => r.kind === 'want' && r.amount < 0 && (r.posted || r.transactedAt) >= week.weekStart(TODAY));
  assert.equal(w.spent, Math.round(wantsThisWeek.reduce((s, r) => s + -r.amount, 0) * 100) / 100);
  assert.ok(w.needs > 0 && w.bills >= 0);
  assert.equal(w.left, Math.round((145 - w.spent) * 100) / 100);
  assert.ok(['calm', 'watching', 'down'].includes(w.mood));
});

test('Sunday close: leftover sweeps into the jar and never into next week; an overage carries, capped at half', () => {
  const { rows } = pipeline();
  const state0 = { envelope: 100, closes: [], graces: { used: [], banked: 0 }, jar: 0 };
  // Pretend the week had $40 of wants: sweep $60.
  const light = rows.filter((r) => !(r.kind === 'want' && r.amount < 0 && (r.posted || r.transactedAt) >= week.weekStart(TODAY)));
  const sunday = week.weekStart(TODAY) + 6 * DAY + 19 * 3600;
  const r1 = week.close([...light, { id: 'w1', accountId: 'card', amount: -40, posted: sunday - DAY, transactedAt: sunday - DAY, kind: 'want', merchantName: 'Zara', description: 'ZARA' }], state0, sunday);
  assert.equal(r1.close.kept, 60); assert.equal(r1.state.jar, 60);
  const nextWeek = week.current(light, r1.state, sunday + 2 * DAY);
  assert.equal(nextWeek.envelope, 100, 'leftover does not inflate next week');
  // A week $80 over on a $100 envelope: next week is short by half the envelope, not $80.
  const r2 = week.close([...light, { id: 'w2', accountId: 'card', amount: -180, posted: sunday - DAY, transactedAt: sunday - DAY, kind: 'want', merchantName: 'Zara', description: 'ZARA' }], state0, sunday);
  assert.equal(r2.close.over, 80);
  assert.equal(week.current(light, r2.state, sunday + 2 * DAY).envelope, 50);
  assert.match(r2.text, /\$50 short/);
});

test('grace: one a month, only within 25% over, keeps the streak; four kept weeks bank one more, two at most', () => {
  const sunday = week.weekStart(TODAY) + 6 * DAY + 19 * 3600;
  const spend = (amt, at) => [{ id: 'x' + at, accountId: 'card', amount: -amt, posted: at - DAY, transactedAt: at - DAY, kind: 'want', merchantName: 'Zara', description: 'ZARA' }];
  let state = { envelope: 100, closes: [], graces: { used: [], banked: 0 }, jar: 0 };
  // $120 on $100: 20% over, grace allowed.
  let r = week.close(spend(120, sunday), state, sunday, { useGrace: true });
  assert.equal(r.close.graced, true); assert.equal(r.streak, 1);
  assert.equal(week.graceAvailable(r.state, sunday), 0, 'the month\'s grace is spent');
  // $140 on $100 the next week: 40% over, grace not allowed even if asked.
  r = week.close(spend(140, sunday + 7 * DAY), r.state, sunday + 7 * DAY, { useGrace: true });
  assert.equal(r.close.graced, false); assert.equal(r.streak, 0);
  // Four kept weeks in a row bank a grace.
  state = { envelope: 100, closes: [], graces: { used: [], banked: 0 }, jar: 0 };
  for (let i = 0; i < 4; i++) { r = week.close(spend(50, sunday + i * 7 * DAY), state, sunday + i * 7 * DAY); state = r.state; }
  assert.equal(r.streak, 4); assert.equal(state.graces.banked, 1);
  for (let i = 4; i < 12; i++) { r = week.close(spend(50, sunday + i * 7 * DAY), state, sunday + i * 7 * DAY); state = r.state; }
  assert.equal(state.graces.banked, 2, 'two banked at most');
  assert.match(r.text, /12 weeks in a row/);
});
