const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sync = require('../budget/sync.js');

const demo = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/simplefin-demo-v2.json'), 'utf8'));
const DAY = 86400;

test('a setup token decodes to a claim URL, the claim answers with an access URL, and credentials come out of the URL', async () => {
  const token = Buffer.from('https://beta-bridge.simplefin.org/simplefin/claim/DEMO-xyz').toString('base64');
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => 'https://u1:p1@beta-bridge.simplefin.org/simplefin\n' }; };
  const access = await sync.claim(token, fetchImpl);
  assert.equal(access, 'https://u1:p1@beta-bridge.simplefin.org/simplefin');
  assert.equal(calls[0].url, 'https://beta-bridge.simplefin.org/simplefin/claim/DEMO-xyz');
  assert.equal(calls[0].init.method, 'POST');
  const { base, auth } = sync.split(access);
  assert.equal(base, 'https://beta-bridge.simplefin.org/simplefin');
  assert.equal(auth, 'Basic ' + Buffer.from('u1:p1').toString('base64'));
  await assert.rejects(sync.claim('not-base64-of-a-url', fetchImpl), /https/);
});

test('pull asks for version 2 and pending rows, sends basic auth, never a window over the limit', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => demo }; };
  const body = await sync.pull('https://u1:p1@beta-bridge.simplefin.org/simplefin', { start: 1_790_000_000, end: 1_791_000_000 }, fetchImpl);
  const u = new URL(seen.url);
  assert.equal(u.searchParams.get('version'), '2');
  assert.equal(u.searchParams.get('pending'), '1');
  assert.equal(u.searchParams.get('start-date'), '1790000000');
  assert.ok(seen.init.headers.authorization.startsWith('Basic '));
  assert.ok(!seen.url.includes('p1'), 'credentials travel in the header, not the URL');
  assert.equal(body.accounts.length, 3);
  assert.deepEqual(body.errlist, []);
  await assert.rejects(sync.pull('https://u1:p1@x.org/simplefin', { start: 0, end: (sync.WINDOW_DAYS + 1) * DAY }, fetchImpl), /days/);
});

test('rows: one flat list, newest first, numbers as numbers, payee, memo and mcc kept, pending from posted 0', () => {
  const r = sync.rows(demo);
  assert.equal(r.length, 8);
  assert.ok(r[0].posted >= r[r.length - 1].posted);
  const grocery = r.find((t) => t.memo.includes('LOCAL GROCER'));
  assert.equal(typeof grocery.amount, 'number');
  assert.ok(grocery.amount < 0, 'spending is negative');
  assert.equal(grocery.mcc, '5411');
  assert.equal(grocery.payee, 'Grocery store');
  assert.equal(grocery.pending, false);
  const pending = sync.rows({ accounts: [{ id: 'a', name: 'Chk', transactions: [{ id: 'p', posted: 0, amount: '-4.00', description: 'Coffee', transacted_at: 1791300000 }] }] });
  assert.equal(pending[0].pending, true);
  assert.equal(pending[0].mcc, '');
});

test('accounts: cash balances, holdings kept apart so stock never reads as spendable', () => {
  const a = sync.accounts(demo);
  const savings = a.find((x) => x.name === 'SimpleFIN Savings');
  assert.equal(savings.balance, 114825.51);
  assert.equal(savings.available, 114825.51);
  assert.ok(savings.holdingsValue > 100000);
  assert.equal(a.find((x) => x.name === 'SimpleFIN Empty Account').transactions, 0);
});

test('windows: bounded slices with a 5-day overlap, oldest first, covering the days asked', () => {
  const now = 1_791_000_000;
  const w = sync.windows(30, now);
  assert.equal(w.length, 1);
  assert.equal(w[0].end, now);
  assert.equal((w[0].end - w[0].start) / DAY, 35);
  const w2 = sync.windows(180, now);
  assert.ok(w2.length >= 3);
  for (const x of w2) assert.ok((x.end - x.start) / DAY <= sync.WINDOW_DAYS);
  for (let i = 1; i < w2.length; i++) assert.ok(w2[i - 1].end - w2[i].start >= 5 * DAY, 'consecutive windows overlap');
  assert.ok(w2[0].start <= now - 180 * DAY);
});

test('the daily cap is the Bridge expectation', () => {
  assert.equal(sync.underCap(0), true);
  assert.equal(sync.underCap(23), true);
  assert.equal(sync.underCap(24), false);
});
