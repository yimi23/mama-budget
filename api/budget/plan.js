// Safe to spend and the weekly envelope. docs/BUDGET.md section 2.7. Pure.
//
//   safe   = cash balances (available where the bank gives it)
//          - bills due before next payday (mature and early streams; missed ones kept for five days)
//          - the card balance you will pay before payday
//          - savings contributions due this period
//          - pending debits not already netted by the available balance
//   needs  = trailing 4-week median of weekly needs, scaled to the days until payday
//   fun    = max(0, safe - needs) / weeks until payday
//
// Variable income is budgeted on the minimum of the last three paychecks, never the mean. Monarch's shape, Simple's
// recomputation: every new row recomputes it.

const DAY = 86400;
const { dueBefore } = require('./recurring.js');
const { isCard } = require('./transfers.js');

const round = (n) => Math.round(n * 100) / 100;

/** The next payday and the pay amount to plan on, from the income streams. Null when none is mature yet. */
function payday(streamsList, now) {
  const income = streamsList.filter((s) => s.kind === 'income' && s.status !== 'inactive').sort((a, b) => b.hits - a.hits);
  const main = income[0];
  if (!main) return null;
  const amounts = main.rows.slice(-3).map((r) => Math.abs(r.amount));
  const cv = amounts.length > 1 ? Math.sqrt(amounts.reduce((s, x) => s + (x - amounts.reduce((a, b) => a + b, 0) / amounts.length) ** 2, 0) / amounts.length) / (amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
  let nextAt = main.nextAt;
  while (nextAt && nextAt < now) nextAt += Math.round(main.cadence === 'weekly' ? 7 : main.cadence === 'biweekly' ? 14 : main.cadence === 'semimonthly' ? 15 : 30) * DAY;
  return { stream: main, nextAt, amount: cv > 0.15 ? Math.min(...amounts) : amounts[amounts.length - 1], variable: cv > 0.15, cadence: main.cadence };
}

/** Weekly needs: the trailing four weeks of rows classed as need, as a median of weekly sums. */
function weeklyNeeds(rows, now) {
  const weeks = [0, 0, 0, 0];
  for (const r of rows) {
    if (r.kind !== 'need' || r.amount >= 0) continue;
    const age = (now - (r.posted || r.transactedAt)) / DAY;
    if (age < 0 || age >= 28) continue;
    weeks[Math.floor(age / 7)] += -r.amount;
  }
  const s = weeks.slice().sort((a, b) => a - b);
  return round((s[1] + s[2]) / 2);
}

/**
 * The plan. rows are classified and reconciled; streams from recurring; accounts from sync; savingsDue is the
 * contribution planned before payday (default 10% of the planned pay when the person has set nothing).
 */
function plan({ rows, streams, accounts, now, savingsRate = 0.1, savingsDue = null }) {
  const cash = accounts.filter((a) => !isCard(a));
  const cards = accounts.filter((a) => isCard(a));
  const balance = round(cash.reduce((s, a) => s + (a.available != null ? a.available : a.balance), 0));
  const pay = payday(streams, now);
  const until = pay ? pay.nextAt : now + 14 * DAY;
  const daysUntil = Math.max(1, Math.ceil((until - now) / DAY));
  const weeksUntil = Math.max(1, daysUntil / 7);
  const bills = dueBefore(streams, now, until).map((s) => ({ merchant: s.merchant, amount: s.amount, due: s.nextAt, status: s.status, variable: s.variable }));
  const billsTotal = round(bills.reduce((s, b) => s + b.amount, 0));
  // The card balance owed: what you will pay before payday. Pending card debits are inside that balance already.
  const cardOwed = round(cards.reduce((s, a) => s + Math.max(0, -a.balance), 0));
  const pendingCash = round(rows.filter((r) => r.pending && r.amount < 0 && cash.some((a) => a.id === r.accountId) && !cash.find((a) => a.id === r.accountId).available).reduce((s, r) => s + -r.amount, 0));
  const savings = savingsDue != null ? savingsDue : round((pay ? pay.amount : 0) * savingsRate);
  const safe = round(balance - billsTotal - cardOwed - savings - pendingCash);
  const needsWeekly = weeklyNeeds(rows, now);
  const needs = round(needsWeekly * weeksUntil);
  const fun = Math.max(0, round((safe - needs) / weeksUntil));
  const envelope = Math.max(25, Math.min(500, Math.floor(fun / 5) * 5));
  const reason = pay
    ? `$${envelope} a week: your pay${pay.variable ? ' (the lowest of the last three)' : ''}, minus ${bills.length ? bills.map((b) => b.merchant.toLowerCase()).slice(0, 3).join(', ') : 'nothing due'}${cardOwed ? ', the card' : ''}, your usual needs${savings ? `, and the $${savings} to save` : ''}.`
    : `$${envelope} a week from what is in the bank, minus bills and your usual needs. No regular pay found yet.`;
  return { balance, payday: pay && { at: pay.nextAt, amount: pay.amount, cadence: pay.cadence, variable: pay.variable }, daysUntil, bills, billsTotal, cardOwed, savings, pendingCash, safe, needsWeekly, needs, fun, envelope, reason };
}

module.exports = { plan, payday, weeklyNeeds };
