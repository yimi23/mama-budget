// Remove the bank, delete everything, STOP on texts. On a throwaway database.
process.env.MAMA_DB = `/tmp/mama-forget-test-${process.pid}.sqlite`;
process.env.MAMA_LEDGER = 'demo';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const budget = require('../budget');
const house = require('../house');
require('../billing');

const user = (n) => db.userForToken(`forget-test-${n}-${'x'.repeat(20)}`).id;
const rows = (table, u) => db.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(u).n;

test('unlink removes the bank link and its cache for another device; the week state stays', () => {
  const u = user('a');
  assert.equal(budget.isOwner(u), false, 'the test user must not be the owner');
  budget.linkAccess('https://user:pass@bridge.simplefin.org/simplefin', u);
  db.bankCache.put(u, { accounts: [], rows: [], at: Date.now() });
  db.budgetState.put(u, { jar: 40, putBacks: [] });
  assert.ok(db.bankLink.get(u)); assert.ok(db.bankCache.get(u));
  budget.unlink(u);
  assert.equal(db.bankLink.get(u), null);
  assert.equal(db.bankCache.get(u), null);
  assert.equal(db.budgetState.get(u, null).jar, 40);
});

test('forget deletes every row for the device, including the house seat and the billing row', () => {
  const u = user('b');
  budget.linkAccess('https://user:pass@bridge.simplefin.org/simplefin', u);
  db.settings.put(u, { grandma: 'mama' });
  db.memory.put(u, { items: {} });
  house.open(u, 200);
  db.db.prepare('INSERT INTO billing (user_id, customer_id, status, updated_at) VALUES (?, ?, ?, ?)').run(u, 'cus_test', 'trialing', Date.now());
  for (const t of ['bank_links', 'settings', 'memory', 'house_members', 'billing']) assert.equal(rows(t, u), 1, t);
  house.leave(u);
  budget.forget(u);
  for (const t of ['bank_links', 'bank_cache', 'budget_state', 'settings', 'memory', 'house_members', 'billing']) assert.equal(rows(t, u), 0, t);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(u).n, 0);
});

test('the routes exist: /bank/unlink, /me/delete, and /reset touches only the asking device when it is not the owner', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /'POST \/bank\/unlink'/);
  assert.match(src, /'POST \/me\/delete'/);
  assert.match(src, /'POST \/reset': async \(body, query, ctx\)[\s\S]{0,400}nessie\.forget\(u\)/);
});

test('STOP holds every text to that number until START; the confirmation itself still goes out', async () => {
  const stoppedFile = path.join(__dirname, '..', '..', 'data', 'photon-stopped.json');
  const before = fs.existsSync(stoppedFile) ? fs.readFileSync(stoppedFile, 'utf8') : null;
  const notify = require('../notify');
  const number = '+1 (989) 555 0199';
  try {
    assert.equal(notify.stopped(number), false);
    assert.equal(notify.stopTexts(number), true);
    assert.equal(notify.stopped('19895550199'), true);
    const held = await notify.notify(number, 'Sunday statement', 'calm', { prompted: true, important: true });
    assert.equal(held.held, 'stopped');
    const confirm = await notify.notify(number, 'No more texts from her.', 'calm', { prompted: true, stopConfirm: true });
    assert.equal(confirm.held, undefined);
    assert.equal(notify.startTexts(number), true);
    assert.equal(notify.stopped(number), false);
    const after = await notify.notify(number, 'She is back.', 'proud', { prompted: true });
    assert.equal(after.held, undefined);
  } finally {
    if (before == null) fs.rmSync(stoppedFile, { force: true }); else fs.writeFileSync(stoppedFile, before);
  }
});
