// Pending, refunds, reversals. docs/BUDGET.md section 2.6. Pure.
//
// A pending row is retired when a posted row on the same account, same sign, amount equal or within 25% (tips, fuel
// pre-authorisations), same merchant key, posts within 7 days. A pending row with no match after 10 days is a dropped
// authorisation and is removed. A refund is a positive row whose merchant matches a prior negative of equal or
// smaller amount within 60 days; it nets against that purchase and is never income. A reversal is the same amount,
// opposite sign, same merchant within 3 days; both are hidden.

const DAY = 86400;
const { merchant } = require('./merchant.js');

function reconcile(rows, now) {
  const keyed = rows.map((r) => ({ ...r, merchantKey: r.merchantKey || merchant(r.description, r.payee).key }));
  const out = [];
  const retired = new Set(), hidden = new Set(), refunded = new Map();
  const posted = keyed.filter((r) => !r.pending);

  // Pending to posted.
  for (const p of keyed.filter((r) => r.pending)) {
    const twin = posted.find((q) => q.accountId === p.accountId && Math.sign(q.amount) === Math.sign(p.amount) && q.merchantKey === p.merchantKey
      && (Math.abs(Math.abs(q.amount) - Math.abs(p.amount)) <= Math.max(Math.abs(p.amount) * 0.25, 1) || Math.abs(p.amount) <= 1.5)
      && q.posted >= p.transactedAt - DAY && q.posted <= p.transactedAt + 7 * DAY);
    if (twin) retired.add(p.id);
    else if (now - p.transactedAt > 10 * DAY) retired.add(p.id); // dropped authorisation
  }
  // Reversals: same merchant, same amount, opposite sign, within 3 days. Hide the pair (and a duplicate charge with it).
  for (const r of posted) {
    if (hidden.has(r.id) || r.amount >= 0) continue;
    const rev = posted.find((q) => !hidden.has(q.id) && q.id !== r.id && q.accountId === r.accountId && q.merchantKey === r.merchantKey && Math.abs(q.amount + r.amount) < 0.005 && q.amount > 0 && Math.abs(q.posted - r.posted) <= 3 * DAY && /revers|duplicate|correction|chargeback/i.test(q.description));
    if (rev) { hidden.add(r.id); hidden.add(rev.id); }
  }
  // Refunds: a positive row matching a prior negative at the same merchant within 60 days, equal or smaller.
  for (const r of posted) {
    if (hidden.has(r.id) || r.amount <= 0 || r.kind === 'transfer') continue;
    const buy = posted.find((q) => !hidden.has(q.id) && !refunded.has(q.id) && q.accountId === r.accountId && q.merchantKey === r.merchantKey && q.amount < 0 && Math.abs(q.amount) >= r.amount - 0.005 && q.posted <= r.posted && r.posted - q.posted <= 60 * DAY);
    if (buy) { refunded.set(buy.id, r.amount); hidden.add(r.id); }
  }
  for (const r of keyed) {
    if (retired.has(r.id) || hidden.has(r.id)) continue;
    const net = refunded.has(r.id) ? Math.round((r.amount + refunded.get(r.id)) * 100) / 100 : r.amount;
    out.push({ ...r, amount: net, refunded: refunded.has(r.id) ? refunded.get(r.id) : undefined });
  }
  return out;
}

module.exports = { reconcile };
