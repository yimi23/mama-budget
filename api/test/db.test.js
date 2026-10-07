const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
process.env.MAMA_DB = path.join(os.tmpdir(), `mama-test-${process.pid}.sqlite`);
process.env.MAMA_SERVER_KEY = 'test-key';
const db = require('../db.js');

test('a device token becomes one user, the same user every time; short tokens are nobody', () => {
  const a = db.userForToken('device-token-aaaaaaaaaaaaaaaa');
  const b = db.userForToken('device-token-aaaaaaaaaaaaaaaa');
  const c = db.userForToken('device-token-bbbbbbbbbbbbbbbb');
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.equal(db.userForToken('short'), null);
  assert.ok(db.userCount() >= 2);
});

test('per-user json tables keep their shape, and users never see each other', () => {
  const a = db.userForToken('device-token-aaaaaaaaaaaaaaaa').id, c = db.userForToken('device-token-bbbbbbbbbbbbbbbb').id;
  db.settings.put(a, { grandma: 'nana', envelope: 145 });
  db.budgetState.put(a, { envelope: 145, closes: [], jar: 60 });
  assert.deepEqual(db.settings.get(a), { grandma: 'nana', envelope: 145 });
  assert.deepEqual(db.settings.get(c, { fresh: true }), { fresh: true });
  assert.equal(db.budgetState.get(a).jar, 60);
  assert.equal(db.budgetState.get(c, null), null);
});

test('a bank access URL is encrypted at rest and comes back whole', () => {
  const a = db.userForToken('device-token-aaaaaaaaaaaaaaaa').id;
  const access = 'https://user:secret@beta-bridge.simplefin.org/simplefin';
  db.bankLink.put(a, access);
  const raw = db.db.prepare('SELECT access_enc FROM bank_links WHERE user_id = ?').get(a).access_enc;
  assert.ok(!raw.includes('secret'), 'the secret never sits in the table in clear');
  assert.equal(db.bankLink.get(a), access);
  db.bankLink.remove(a);
  assert.equal(db.bankLink.get(a), null);
});

test('deleting a user removes every row they own', () => {
  const c = db.userForToken('device-token-bbbbbbbbbbbbbbbb').id;
  db.memory.put(c, { items: { rice: 'need' } });
  db.bankCache.put(c, { accounts: [], rows: [], at: 1 });
  db.deleteUser(c);
  assert.equal(db.memory.get(c, null), null);
  assert.equal(db.bankCache.get(c), null);
  assert.notEqual(db.userForToken('device-token-bbbbbbbbbbbbbbbb').id, c, 'a fresh user next time');
});
