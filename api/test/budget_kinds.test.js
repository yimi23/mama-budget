// Pending, refunds, reversals, and the five kinds, on the fixture.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build, TODAY, CORRECTIONS } = require('../budget/fixture.js');
const transfers = require('../budget/transfers.js');
const recurring = require('../budget/recurring.js');
const { reconcile } = require('../budget/reconcile.js');
const { classify } = require('../budget/kinds.js');

function pipeline() {
  const { rows, accounts } = build();
  const clean = reconcile(rows, TODAY);
  const resolved = transfers.resolve(clean, accounts);
  const ss = recurring.streams(resolved, TODAY, { notRecurring: CORRECTIONS.notRecurring });
  return { rows: classify(resolved, ss, CORRECTIONS), streams: ss, accounts };
}

test('reconcile: the tip and the fuel pre-auth retire their pending rows, the stale hold is dropped, the refund nets, the reversal hides', () => {
  const { rows } = build();
  const out = reconcile(rows, TODAY);
  assert.equal(out.filter((r) => r.pending).length, 0, 'no pending rows survive on this fixture');
  const zing = out.filter((r) => /ZINGERMANS/.test(r.description));
  assert.equal(zing.length, 1); assert.equal(zing[0].amount, -48);
  const speed = out.filter((r) => /SPEEDWAY/.test(r.description));
  assert.equal(speed.length, 1); assert.equal(speed[0].amount, -43.21);
  assert.equal(out.filter((r) => /HOTEL HOLD/.test(r.description)).length, 0, 'the vanished hold is gone');
  const amz = out.filter((r) => /AMZN Mktp/.test(r.description));
  assert.equal(amz.length, 1, 'the refund row is folded into the purchase');
  assert.equal(amz[0].amount, 0); assert.equal(amz[0].refunded, 62.4);
  assert.equal(out.filter((r) => /UBER \*TRIP/.test(r.description)).length, 1, 'the duplicate and its reversal are hidden, one real trip remains');
});

test('kinds: income, transfer, bill, need and want land where the spec says', () => {
  const { rows } = pipeline();
  const kind = (re) => rows.filter((r) => re.test(r.description)).map((r) => r.kind);
  assert.ok(kind(/ACME CORP/).every((k) => k === 'income'), kind(/ACME CORP/).join());
  assert.ok(kind(/ONLINE TRANSFER|AUTOPAY|PAYMENT THANK YOU/).every((k) => k === 'transfer'));
  assert.ok(kind(/ZELLE TO HARRIET/).every((k) => k === 'bill'), kind(/ZELLE TO HARRIET/).join());
  assert.ok(kind(/CONSUMERS ENERGY/).every((k) => k === 'bill'), kind(/CONSUMERS ENERGY/).join());
  assert.deepEqual(kind(/WALMART/), ['need']);
  assert.deepEqual(kind(/MEIJER/), ['need']);
  assert.deepEqual(kind(/SHELL OIL/), ['need'], 'fuel is a need');
  assert.deepEqual(kind(/CVS/), ['need'], 'the person said CVS is a need');
  assert.deepEqual(kind(/UBER \*EATS/), ['want'], 'the person said Uber Eats is a want');
  assert.ok(kind(/NETFLIX|SPOTIFY|APPLE/).every((k) => k === 'want'), 'subscriptions are wants');
  assert.deepEqual(kind(/ZARA/), ['want']);
  assert.deepEqual(kind(/BLUE OWL|LUNCH ROOM/), ['want', 'want']);
  assert.deepEqual(kind(/ATM WITHDRAWAL/), ['transfer'], 'cash out is shown apart, never a want');
  assert.deepEqual(kind(/VENMO FROM/), ['transfer'], 'money from a friend is not income');
  assert.deepEqual(kind(/CHECK #1042/), ['want'], 'a bare check is a want until the person says otherwise');
  assert.ok(rows.find((r) => /CHECK #1042/.test(r.description)).unsure, 'and it is marked unsure');
});
