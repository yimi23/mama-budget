// The 120-day synthetic ledger from docs/BUDGET.md section 6: three accounts and every trap the pipeline must survive.
// Deterministic (no randomness), dated relative to a fixed "today" so tests never drift. Rows are in the shape
// sync.rows() produces from SimpleFIN, so every module is tested on exactly what it will see.
//
// Expected outcomes are written next to the rows that cause them; the tests assert those, not re-derived sums.

const DAY = 86400;
const TODAY = Date.UTC(2026, 9, 7, 12) / 1000; // 2026-10-07 noon UTC, a Wednesday
const at = (daysAgo, hour = 10) => TODAY - daysAgo * DAY + (hour - 12) * 3600;
const iso = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

const ACCOUNTS = [
  { id: 'chk', name: 'Everyday Checking', connection: 'C1', currency: 'USD', balance: 1842.17, available: 1792.17, balanceDate: TODAY, holdingsValue: 0 },
  { id: 'sav', name: 'Savings', connection: 'C1', currency: 'USD', balance: 2640.0, available: 2640.0, balanceDate: TODAY, holdingsValue: 0 },
  { id: 'card', name: 'Visa Signature', connection: 'C2', currency: 'USD', balance: -412.36, available: null, balanceDate: TODAY, holdingsValue: 0 },
];

let seq = 0;
const row = (accountId, daysAgo, amount, description, extra = {}) => ({
  id: `${accountId}-${++seq}`, accountId, accountName: ACCOUNTS.find((a) => a.id === accountId).name, connection: accountId === 'card' ? 'C2' : 'C1',
  currency: 'USD', amount, posted: extra.pending ? 0 : at(daysAgo), transactedAt: at(daysAgo), pending: !!extra.pending,
  description, payee: extra.payee || '', memo: extra.memo || description, mcc: extra.mcc || '',
});

function build() {
  seq = 0;
  const rows = [];

  // Biweekly payroll on Fridays, net 1,642.18, with one bonus month and one holiday shift a day early.
  // Expected: stream income/biweekly, 8 hits, next payday = last + 14 days.
  for (let k = 0; k < 8; k++) {
    let d = 2 + k * 14;               // 2 days ago was Monday... keep cadence 14 regardless of weekday for the test
    if (k === 5) d += 1;               // paid a day early (holiday)
    rows.push(row('chk', d, 1642.18 + (k === 3 ? 500 : 0), 'ACME CORP DIR DEP PPD ID: 1234567 ACME CORP', { payee: 'ACME CORP', memo: 'DIRECT DEP' }));
  }
  // Rent on the 1st by Zelle to the landlord, four months; one posted on the 3rd. Expected: bill/monthly 1,150.
  for (const m of [0, 1, 2, 3]) {
    const first = Date.UTC(2026, 9 - m, 1, 12) / 1000;
    const shift = m === 2 ? 2 * DAY : 0;
    rows.push(row('chk', Math.round((TODAY - first - shift) / DAY), -1150, 'ZELLE TO HARRIET LANDLORD CONF# 8821' + m, { payee: 'Harriet Landlord' }));
  }
  // Variable electric bill around the 12th: 84.20, 97.55, 71.30, 102.80. Expected: bill/monthly, variable, median forecast.
  for (const [m, amt] of [[0, 102.8], [1, 71.3], [2, 97.55], [3, 84.2]]) {
    const dt = Date.UTC(2026, 9 - m, 12, 12) / 1000;
    if (dt < TODAY) rows.push(row('chk', Math.round((TODAY - dt) / DAY), -amt, 'CONSUMERS ENERGY ACH DEBIT', { payee: 'Consumers Energy', mcc: '4900' }));
  }
  // Netflix 15.49 monthly on the 20th, then a price rise to 17.99. Expected: one stream, amount_changed.
  for (const [m, amt] of [[0, 17.99], [1, 17.99], [2, 15.49], [3, 15.49]]) {
    const dt = Date.UTC(2026, 9 - m, 20, 12) / 1000;
    if (dt < TODAY) rows.push(row('card', Math.round((TODAY - dt) / DAY), -amt, 'NETFLIX.COM', { payee: 'Netflix', mcc: '4899' }));
  }
  // A second Netflix line (a gift sub) at 7.99 on the 5th. Expected: a separate stream by amount.
  for (const m of [0, 1, 2, 3]) {
    const dt = Date.UTC(2026, 9 - m, 5, 12) / 1000;
    if (dt < TODAY) rows.push(row('card', Math.round((TODAY - dt) / DAY), -7.99, 'NETFLIX.COM', { payee: 'Netflix', mcc: '4899' }));
  }
  // Weekly Spotify-style charge 5.99 every 7 days. Expected: subscription/weekly.
  for (let k = 0; k < 16; k++) rows.push(row('card', 1 + k * 7, -5.99, 'PAYPAL *SPOTIFY', { payee: 'Spotify', mcc: '5815' }));
  // One annual charge, 95.00, 100 days ago. Expected: not a stream yet (one hit).
  rows.push(row('card', 100, -95, 'AMAZON PRIME*2K4ABC', { payee: 'Amazon Prime' }));
  // Card autopay pair: card payment leaves checking on the 25th, lands on the card a day later. Expected: transfer pair, never spending.
  for (const m of [0, 1, 2, 3]) {
    const dt = Date.UTC(2026, 9 - m, 25, 12) / 1000;
    if (dt < TODAY) {
      const d = Math.round((TODAY - dt) / DAY);
      rows.push(row('chk', d, -380, 'CHASE CREDIT CRD AUTOPAY 1234', { payee: 'Chase Card Services' }));
      rows.push(row('card', d - 1 >= 0 ? d - 1 : 0, 380, 'PAYMENT THANK YOU', { payee: 'Payment' }));
    }
  }
  // Checking to savings on payday, 100 each, same day. Expected: transfer pair.
  for (let k = 0; k < 8; k++) {
    rows.push(row('chk', 2 + k * 14, -100, 'ONLINE TRANSFER TO SAV ...4411', { payee: 'Transfer' }));
    rows.push(row('sav', 2 + k * 14, 100, 'ONLINE TRANSFER FROM CHK ...0912', { payee: 'Transfer' }));
  }
  // Two unrelated $50 purchases on the same day on two accounts: must NOT pair.
  rows.push(row('chk', 9, -50, 'SHELL OIL 57444 ANN ARBOR MI', { payee: 'Shell', mcc: '5541' }));
  rows.push(row('card', 9, -50, 'TARGET 00012345 ANN ARBOR MI', { payee: 'Target', mcc: '5310' }));
  // A pending restaurant 40.00 that posts as 48.00 (tip). Expected: one purchase, 48, the pending retired.
  rows.push(row('card', 1, -40, 'ZINGERMANS DELI', { payee: "Zingerman's", mcc: '5812', pending: true }));
  rows.push(row('card', 0, -48, 'ZINGERMANS DELI ANN ARBOR', { payee: "Zingerman's", mcc: '5812' }));
  // A $1 fuel pre-auth that posts as 43.21. Expected: one purchase, 43.21.
  rows.push(row('card', 3, -1, 'SPEEDWAY 04412', { payee: 'Speedway', mcc: '5542', pending: true }));
  rows.push(row('card', 2, -43.21, 'SPEEDWAY 04412 YPSILANTI MI', { payee: 'Speedway', mcc: '5542' }));
  // A pending that vanishes (no posted twin, 12 days old). Expected: dropped.
  rows.push(row('card', 12, -19.99, 'HOTEL HOLD', { payee: 'Hotel', mcc: '7011', pending: true }));
  // Amazon purchase 62.40 then a refund 62.40 nine days later. Expected: nets to zero, refund is not income.
  rows.push(row('card', 30, -62.4, 'AMZN Mktp US*2K4ABC', { payee: 'Amazon', mcc: '5942' }));
  rows.push(row('card', 21, 62.4, 'AMZN Mktp US*2K4ABC REFUND', { payee: 'Amazon', mcc: '5942' }));
  // A duplicate charge and its reversal within two days. Expected: both hidden.
  rows.push(row('card', 15, -29.99, 'UBER *TRIP HELP.UBER.COM', { payee: 'Uber', mcc: '4121' }));
  rows.push(row('card', 15, -29.99, 'UBER *TRIP HELP.UBER.COM', { payee: 'Uber', mcc: '4121' }));
  rows.push(row('card', 14, 29.99, 'UBER *TRIP REVERSAL', { payee: 'Uber', mcc: '4121' }));
  // Everyday rows with messy descriptions. Needs and wants by MCC or name.
  rows.push(row('card', 4, -86.12, 'POS DEBIT WALMART SUPERCENTER #1700 POWAY CA', { payee: 'Walmart', mcc: '5411' }));
  rows.push(row('card', 6, -23.5, 'SQ *BLUE OWL COFFEE', { payee: 'Blue Owl Coffee', mcc: '5814' }));
  rows.push(row('card', 7, -14.75, 'TST* THE LUNCH ROOM', { payee: 'The Lunch Room', mcc: '5812' }));
  rows.push(row('card', 8, -31.2, 'UBER *EATS HELP.UBER.COM', { payee: 'Uber Eats', mcc: '5812' }));
  rows.push(row('chk', 11, -45, 'CHECK #1042'));
  rows.push(row('chk', 13, -200, 'ATM WITHDRAWAL 00921 S STATE ST'));
  rows.push(row('chk', 5, 60, 'VENMO FROM UGONNA E PAYMENT', { payee: 'Venmo' }));
  rows.push(row('card', 10, -12.99, 'CVS/PHARMACY #0421', { payee: 'CVS', mcc: '5912' }));
  rows.push(row('card', 16, -58, 'MEIJER #064 ANN ARBOR', { payee: 'Meijer', mcc: '5411' }));
  rows.push(row('card', 18, -119, 'ZARA USA 1183', { payee: 'Zara', mcc: '5651' }));
  rows.push(row('card', 24, -9.99, 'APPLE.COM/BILL', { payee: 'Apple', mcc: '5818' }));
  rows.push(row('card', 54, -9.99, 'APPLE.COM/BILL', { payee: 'Apple', mcc: '5818' }));
  rows.push(row('card', 84, -9.99, 'APPLE.COM/BILL', { payee: 'Apple', mcc: '5818' }));

  return { accounts: ACCOUNTS, rows: rows.sort((a, b) => (b.posted || b.transactedAt) - (a.posted || a.transactedAt)) };
}

// Corrections a person made, keyed by merchant, which must survive every re-sync.
const CORRECTIONS = {
  kinds: { 'uber eats': 'want', 'cvs': 'need' },
  notRecurring: ['atm withdrawal'],
};

module.exports = { TODAY, ACCOUNTS, build, CORRECTIONS, iso, DAY };
