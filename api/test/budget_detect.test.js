// The detection half of the budgeting core on the 120-day fixture: merchants, transfers, recurring streams.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build, TODAY, DAY, CORRECTIONS } = require('../budget/fixture.js');
const { merchant } = require('../budget/merchant.js');
const transfers = require('../budget/transfers.js');
const recurring = require('../budget/recurring.js');

test('merchant: messy descriptions become one clean key per shop', () => {
  const cases = [
    ['POS DEBIT WALMART SUPERCENTER #1700 POWAY CA', 'walmart', null],
    ['SQ *BLUE OWL COFFEE', 'blue owl coffee', 'square'],
    ['TST* THE LUNCH ROOM', 'the lunch room', 'toast'],
    ['AMZN Mktp US*2K4ABC', 'amazon', null],
    ['PAYPAL *SPOTIFY', 'spotify', 'paypal'],
    ['UBER *EATS HELP.UBER.COM', 'uber eats', null],
    ['UBER *TRIP HELP.UBER.COM', 'uber', null],
    ['SHELL OIL 57444 ANN ARBOR MI', 'shell', null],
    ['CHECK #1042', 'check', null],
    ['ATM WITHDRAWAL 00921 S STATE ST', 'atm withdrawal', null],
    ['ACME CORP DIR DEP PPD ID: 1234567 ACME CORP', 'acme corp', null],
  ];
  for (const [d, key, via] of cases) {
    const m = merchant(d);
    assert.equal(m.key, key, `${d} -> ${m.key}`);
    assert.equal(m.via, via, `${d} via`);
  }
  assert.equal(merchant('SHELL OIL 1021 DETROIT MI').key, merchant('SHELL OIL 57444 ANN ARBOR MI').key, 'two Shell stations share a key');
  const z = merchant('ZELLE TO HARRIET LANDLORD CONF# 88210');
  assert.equal(z.normalized, 'Zelle to Harriet Landlord');
  assert.equal(z.person, true);
});

test('transfers: card autopay pairs and savings pairs are transfers; the two unrelated $50s are not', () => {
  const { rows, accounts } = build();
  const out = transfers.resolve(rows, accounts);
  const autopayOut = out.filter((r) => /AUTOPAY/.test(r.description));
  const autopayIn = out.filter((r) => /PAYMENT THANK YOU/.test(r.description));
  assert.ok(autopayOut.length >= 3 && autopayOut.every((r) => r.kind === 'transfer'), 'autopay out is a transfer');
  assert.ok(autopayIn.every((r) => r.kind === 'transfer'), 'payment received on the card is a transfer');
  assert.ok(autopayOut.filter((r) => r.pairId).length >= 3, 'autopay rows are paired');
  const sav = out.filter((r) => /ONLINE TRANSFER/.test(r.description));
  assert.equal(sav.length, 16);
  assert.ok(sav.every((r) => r.kind === 'transfer' && r.pairId), 'every savings move is a paired transfer');
  const shell = out.find((r) => /SHELL OIL 57444/.test(r.description)), target = out.find((r) => /^TARGET/.test(r.description));
  assert.equal(shell.kind, undefined, 'Shell $50 is spending');
  assert.equal(target.kind, undefined, 'Target $50 is spending');
  assert.equal(out.find((r) => /ATM WITHDRAWAL/.test(r.description)).kind, 'cash');
  const refund = out.find((r) => /REFUND/.test(r.description));
  assert.equal(refund.kind, 'refund');
});

test('recurring: payroll, rent, a variable utility, two Netflix lines, a weekly sub, and the Apple sub are streams; the annual charge is not', () => {
  const { rows, accounts } = build();
  const resolved = transfers.resolve(rows, accounts);
  const ss = recurring.streams(resolved, TODAY, { notRecurring: CORRECTIONS.notRecurring });
  const by = (k) => ss.filter((s) => s.key === k);
  const pay = by('acme corp')[0];
  assert.ok(pay && pay.kind === 'income' && pay.cadence === 'biweekly' && pay.status === 'mature', JSON.stringify(pay && { k: pay.kind, c: pay.cadence, s: pay.status, h: pay.hits }));
  assert.equal(pay.hits, 8);
  assert.ok(Math.abs(pay.nextAt - (pay.lastAt + 14 * DAY)) <= DAY, 'next payday is two weeks after the last');
  const rent = by('zelle to harriet landlord')[0];
  assert.ok(rent && rent.kind === 'bill' && rent.cadence === 'monthly' && rent.amount === 1150, JSON.stringify(rent && { k: rent.kind, c: rent.cadence, a: rent.amount, h: rent.hits }));
  const util = by('utilities')[0];
  assert.ok(util && util.variable && util.cadence === 'monthly', JSON.stringify(util && { v: util.variable, c: util.cadence, a: util.amount }));
  const netflix = by('netflix');
  assert.equal(netflix.length, 2, 'two Netflix lines cluster by amount');
  const main = netflix.find((s) => s.amount >= 15);
  assert.ok(main.amountChanged && main.amountChanged.from === 15.49 && main.amountChanged.to === 17.99, JSON.stringify(main.amountChanged));
  const spotify = by('spotify')[0];
  assert.ok(spotify && spotify.cadence === 'weekly' && spotify.status === 'mature');
  const apple = by('apple')[0];
  assert.ok(apple && apple.cadence === 'monthly' && apple.hits === 3 && apple.status === 'mature');
  assert.equal(by('amazon').length, 0, 'one annual charge is not a stream');
  assert.equal(by('atm withdrawal').length, 0, 'a correction keeps the ATM out of recurring');
  assert.equal(by('transfer').length, 0, 'transfers never become bills');
});

test('recurring: bills due before the next payday are the ones the envelope must leave room for', () => {
  const { rows, accounts } = build();
  const ss = recurring.streams(transfers.resolve(rows, accounts), TODAY);
  const pay = ss.find((s) => s.key === 'acme corp');
  const due = recurring.dueBefore(ss, TODAY, pay.nextAt);
  const names = due.map((s) => s.key);
  assert.ok(names.includes('utilities') || names.includes('netflix') || names.includes('spotify'), names.join());
  assert.ok(!names.includes('acme corp'));
});
