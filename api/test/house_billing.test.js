// The house and billing, on a throwaway database.
process.env.MAMA_DB = `/tmp/mama-house-test-${process.pid}.sqlite`;
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('./../db');
const house = require('../house');
const billing = require('../billing');

const user = (n) => db.userForToken(`house-test-${n}-${'x'.repeat(20)}`).id;

test('open, join by code, four at most, the opener sets Monday\'s number, leaving is one tap', () => {
  const a = user('a'), b = user('b'), c = user('c'), d = user('d'), e = user('e');
  const h = house.open(a, 300);
  assert.match(h.code, /^\d{6}$/);
  assert.equal(h.members, 1); assert.equal(h.opener, true);
  const hb = house.join(b, h.code);
  assert.equal(hb.members, 2); assert.equal(hb.opener, false);
  house.join(c, h.code); house.join(d, h.code);
  assert.throws(() => house.join(e, h.code), /full/);
  assert.throws(() => house.join(e, '000000'), /No house/);
  assert.throws(() => house.setEnvelope(b, 400), /opened the house/);
  const set = house.setEnvelope(a, 400);
  assert.equal(set.envelope, 300); assert.equal(set.nextEnvelope, 400); // applies next Monday, not now
  assert.equal(house.applyPending(h.id, new Date()), false);
  assert.equal(house.applyPending(h.id, new Date(Date.now() + 8 * 86400000)), true);
  assert.equal(house.view(h.id, a).envelope, 400);
  house.leave(d);
  assert.equal(house.view(h.id, a).members, 3);
  assert.equal(house.houseOf(d), null);
});

test('the house week sums the members against the house envelope and shows amount, item and day, never who', () => {
  const a = user('wa'), b = user('wb');
  const h = house.open(a, 200);
  house.join(b, h.code);
  const weeks = { [a]: { spent: 60, kept: 10, daysLeft: 3, bills: [], topWants: [{ merchant: 'DoorDash', amount: 48 }], counts: { wants: 2 } }, [b]: { spent: 90, kept: 0, daysLeft: 3, bills: [], topWants: [{ merchant: 'Zara', amount: 90 }], counts: { wants: 1 } } };
  const shelves = { [a]: [{ item: 'AirPods', amount: 249, date: '2026-10-06' }], [b]: [] };
  const w = house.week(b, { weekFor: (id) => weeks[id], shelfFor: (id) => shelves[id] });
  assert.equal(w.envelope, 200); assert.equal(w.spent, 150); assert.equal(w.left, 50); assert.equal(w.kept, 10);
  assert.equal(w.mood, 'watching');
  assert.deepEqual(w.items.map((i) => i.item), ['AirPods', 'Zara', 'DoorDash']);
  assert.equal(JSON.stringify(w).includes(a), false, 'no member id in the house week');
  assert.deepEqual(w.mine, { spent: 90, kept: 0 });
  assert.equal(w.house.opener, false);
});

test('billing: open when no key; the webhook signature is checked on the raw body; events set the plan', () => {
  const u = user('bill');
  assert.equal(billing.planFor(u).plan, 'open');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  try {
    assert.equal(billing.planFor(u).plan, 'locked');
    const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'trialing', trial_end: Math.floor(Date.now() / 1000) + 5 * 86400, current_period_end: Math.floor(Date.now() / 1000) + 5 * 86400, metadata: { user_id: u }, items: { data: [{ price: { id: 'price_year' } }] } } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');
    assert.throws(() => billing.webhook(body, `t=${t},v1=deadbeef`), /bad signature/);
    assert.equal(billing.verifySignature(body, `t=${t - 600},v1=${sig}`), false, 'stale timestamp');
    assert.deepEqual(billing.webhook(body, `t=${t},v1=${sig}`), { ok: true });
    assert.deepEqual(billing.webhook(body, `t=${t},v1=${sig}`), { ok: true, duplicate: true });
    const p = billing.planFor(u);
    assert.equal(p.plan, 'full'); assert.equal(p.status, 'trialing'); assert.equal(p.trialDaysLeft, 5);
    const gone = JSON.stringify({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: { user_id: u } } } });
    billing.applyEvent(JSON.parse(gone));
    assert.equal(billing.planFor(u).plan, 'locked');
    process.env.MAMA_FREE_TIER = '1';
    assert.equal(billing.planFor(u).plan, 'free');
    assert.deepEqual(billing.flatten({ line_items: [{ price: 'p', quantity: 1 }], subscription_data: { metadata: { user_id: 'u' } } }), { 'line_items[0][price]': 'p', 'line_items[0][quantity]': '1', 'subscription_data[metadata][user_id]': 'u' });
  } finally { delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; delete process.env.MAMA_FREE_TIER; }
});
