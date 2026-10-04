// Seeds the demo student in Nessie with 30 days of history that tells one true story:
// food delivery heavy, rice cheap, money sent home, rent due in 4 days, two thirds of this week's envelope gone.
// Run: NESSIE_KEY=... node api/nessie/seed.js
// Without a key it seeds the local cache only, which is enough to run the demo.
//
// Nessie facts that shape this file (confirm in hour one, see docs/NESSIE.md):
//  - HTTPS only. http://api.nessieisreal.com times out.
//  - Purchase amounts are truncated to integers. Everything here is whole dollars.
//  - Account balance does not move when purchases post. Every number she says is a sum over the ledger.
//  - Merchant category is a string. Purchases need a merchant_id.
//  - The description field is ours. Format: "<tag> | <item>" where tag is need, want, family, saved or income.

const { call, readCache, writeCache } = require('./client');

const ENVELOPE = Number(process.env.FUN_BUDGET || 75); // weekly fun money, USD

const MERCHANTS = {
  Kroger:              { category: 'Grocery',       tag: 'need' },
  Target:              { category: 'Grocery',       tag: 'need' },
  'Consumers Energy':  { category: 'Utilities',     tag: 'need' },
  'T-Mobile':          { category: 'Phone',         tag: 'need' },
  'CMU Bookstore':     { category: 'Education',     tag: 'need' },
  'Ann Arbor Transit': { category: 'Transit',       tag: 'need' },
  DoorDash:            { category: 'Food Delivery', tag: 'want' },
  Starbucks:           { category: 'Coffee',        tag: 'want' },
  'Boba shop':         { category: 'Coffee',        tag: 'want' },
  'Online store':      { category: 'Clothing',      tag: 'want' },
  Bar:                 { category: 'Bars',          tag: 'want' },
};

// day = days ago. Whole dollars only.
const HISTORY = [
  // needs: never move the meter
  { day: 29, merchant: 'Consumers Energy', item: 'Electric bill', amount: 48 },
  { day: 28, merchant: 'T-Mobile', item: 'Phone bill', amount: 45 },
  { day: 27, merchant: 'Kroger', item: 'Eggs, milk, bread', amount: 14 },
  { day: 24, merchant: 'Target', item: '20 lb bag of rice', amount: 24 },
  { day: 21, merchant: 'CMU Bookstore', item: 'Textbook', amount: 62 },
  { day: 18, merchant: 'Kroger', item: 'Groceries', amount: 31 },
  { day: 12, merchant: 'Ann Arbor Transit', item: 'Bus pass', amount: 30 },
  { day: 6,  merchant: 'Kroger', item: 'Groceries', amount: 22 },
  // wants: 210 of 300
  { day: 26, merchant: 'DoorDash', item: 'Food delivery', amount: 32 },
  { day: 25, merchant: 'Starbucks', item: 'Latte', amount: 7 },
  { day: 22, merchant: 'DoorDash', item: 'Food delivery', amount: 27 },
  { day: 20, merchant: 'Boba shop', item: 'Bubble tea', amount: 8 },
  { day: 17, merchant: 'Online store', item: 'Hoodie', amount: 55 },
  { day: 15, merchant: 'Starbucks', item: 'Latte', amount: 7 },
  { day: 13, merchant: 'DoorDash', item: 'Food delivery', amount: 24 },
  { day: 3,  merchant: 'Bar', item: 'Bar tab', amount: 16 },
  { day: 4,  merchant: 'Boba shop', item: 'Bubble tea', amount: 9 },
  { day: 5,  merchant: 'Starbucks', item: 'Latte', amount: 6 },
  { day: 2,  merchant: 'DoorDash', item: 'Food delivery', amount: 19 },
]; // 30 day wants: 210, food delivery 102 is the biggest, rice 24 is the contrast.
   // This week (Mon to today): 6+19+9+16 = 50 of a 75 envelope, so the meter is visibly up and AirPods blow it.

const DEPOSITS = [
  { day: 30, amount: 480, item: 'Paycheck' },
  { day: 15, amount: 480, item: 'Paycheck' },
];
const TRANSFERS = [
  { day: 19, to: 'family',  amount: 50, item: 'Sent home' },
  { day: 3,  to: 'savings', amount: 40, item: 'Moved to savings' },
];
const BILL = { payee: 'Landlord', nickname: 'Rent', amount: 650, dueInDays: 4, recurringDay: 1 };

function iso(daysAgo) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); }
function isoFromNow(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

async function main() {
  const c = readCache();
  c.envelope = ENVELOPE;
  c.merchants = Object.entries(MERCHANTS).map(([name, m]) => ({ name, category: m.category }));
  c.purchases = HISTORY.map(h => ({ item: h.item, amount: h.amount, merchant: h.merchant, tag: MERCHANTS[h.merchant].tag, date: iso(h.day) }));
  c.deposits = DEPOSITS.map(d => ({ amount: d.amount, item: d.item, date: iso(d.day) }));
  c.transfers = TRANSFERS.map(t => ({ amount: t.amount, to: t.to, item: t.item, tag: t.to === 'family' ? 'family' : 'saved', date: iso(t.day) }));
  c.bills = [{ payee: BILL.payee, nickname: BILL.nickname, amount: BILL.amount, due: isoFromNow(BILL.dueInDays), recurringDay: BILL.recurringDay }];

  try {
    const cust = await call('POST', '/customers', { first_name: 'Demo', last_name: 'Student', address: { street_number: '500', street_name: 'S State St', city: 'Ann Arbor', state: 'MI', zip: '48109' } });
    const cid = cust.objectCreated._id;
    const chk = await call('POST', `/customers/${cid}/accounts`, { type: 'Checking', nickname: 'Checking', rewards: 0, balance: 1400 });
    const sav = await call('POST', `/customers/${cid}/accounts`, { type: 'Savings', nickname: 'Savings', rewards: 0, balance: 120 });
    const fam = await call('POST', '/customers', { first_name: 'Family', last_name: 'Home', address: { street_number: '1', street_name: 'Warri Rd', city: 'Warri', state: 'DE', zip: '00000' } });
    const famAcct = await call('POST', `/customers/${fam.objectCreated._id}/accounts`, { type: 'Checking', nickname: 'Family', rewards: 0, balance: 0 });
    c.customerId = cid; c.accountId = chk.objectCreated._id; c.savingsId = sav.objectCreated._id; c.familyAccountId = famAcct.objectCreated._id;

    c.merchantIds = {};
    for (const [name, m] of Object.entries(MERCHANTS)) {
      const r = await call('POST', '/merchants', { name, category: m.category, address: { street_number: '1', street_name: 'Main St', city: 'Ann Arbor', state: 'MI', zip: '48104' }, geocode: { lat: 42.28, lng: -83.74 } });
      c.merchantIds[name] = r.objectCreated._id;
    }
    for (const p of [...c.purchases].sort((a, b) => a.date.localeCompare(b.date))) {
      await call('POST', `/accounts/${c.accountId}/purchases`, { merchant_id: c.merchantIds[p.merchant], medium: 'balance', purchase_date: p.date, amount: p.amount, status: 'completed', description: `${p.tag} | ${p.item}` });
    }
    for (const d of c.deposits) {
      await call('POST', `/accounts/${c.accountId}/deposits`, { medium: 'balance', transaction_date: d.date, status: 'completed', amount: d.amount, description: `income | ${d.item}` });
    }
    for (const t of c.transfers) {
      const destId = t.to === 'family' ? c.familyAccountId : c.savingsId;
      const description = `${t.tag} | ${t.item}`;
      // Nessie rejects "medium"/"payee_id" on /transfers and never stores a destination (verified
      // against the live sandbox), so money sent home or to savings is a withdrawal here, deposit there.
      await call('POST', `/accounts/${c.accountId}/withdrawals`, { medium: 'balance', amount: t.amount, transaction_date: t.date, status: 'completed', description });
      await call('POST', `/accounts/${destId}/deposits`, { medium: 'balance', amount: t.amount, transaction_date: t.date, status: 'completed', description });
    }
    await call('POST', `/accounts/${c.accountId}/bills`, { status: 'recurring', payee: BILL.payee, nickname: BILL.nickname, payment_date: c.bills[0].due, recurring_date: BILL.recurringDay, payment_amount: BILL.amount });
    console.log('Nessie seeded', { customerId: cid, accountId: c.accountId, merchants: Object.keys(c.merchantIds).length, purchases: c.purchases.length });
  } catch (e) {
    console.log('Nessie unavailable or no key. Local cache only.', e.message);
  }
  writeCache(c);
  const { week } = require('./client');
  const w = week();
  console.log(`Local history: ${c.purchases.length} purchases over 30 days. This week: wants ${w.spent} of ${w.envelope}, kept ${w.kept}, mood ${w.mood}.`);
}
main();
