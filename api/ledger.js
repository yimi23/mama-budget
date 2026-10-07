// The one ledger the rest of the API reads. Live when a SimpleFIN link has been pulled (api/budget), the Nessie
// sandbox otherwise (demo mode). Same names and shapes as nessie/client.js, so callers do not know which is under them.
//
// What changes in live mode: the week comes from real bank rows; an order the extension sees is kept as a posted
// order until the bank shows it; a put-back is a kept moment on the week; the envelope is the person's or the plan's;
// money never moves (SimpleFIN is read-only), so "to savings" and "home" are narrated, not executed.

const nessie = require('./nessie/client');
const budget = require('./budget');

// MAMA_LEDGER=demo pins the sandbox (tests, demos on a machine with a link).
const live = () => process.env.MAMA_LEDGER !== 'demo' && budget.ready();

module.exports = {
  live,
  week: (...a) => (live() ? budget.week(...a) : nessie.week(...a)),
  month: (...a) => (live() ? budget.month(...a) : nessie.month(...a)),
  saw: () => (live() ? budget.saw() : null),
  setEnvelope: (amount) => (live() ? budget.setEnvelope(amount) : nessie.setEnvelope(amount)),
  proposeEnvelope: (m) => (live() ? (budget.snapshot()?.plan.envelope ?? 75) : nessie.proposeEnvelope(m)),
  trueLine: (m) => nessie.trueLine(m),
  watches: (m) => nessie.watches(m),
  weekStart: nessie.weekStart,
  daysLeftInWeek: nessie.daysLeftInWeek,
  savingsBalance: () => (live() ? (budget.state().jar || 0) : nessie.savingsBalance()),
  customerName: () => (live() ? Promise.resolve(null) : nessie.customerName()),
  // Money paths. Live: recorded, never moved.
  purchase: async (o) => (live() ? budget.postOrder({ requestId: String(o.requestId || `${o.item}:${Date.now()}`), item: o.item, price: o.price, store: o.merchant, tag: o.tag }) : nessie.purchase(o)),
  transferHome: async (amount, requestId) => (live() ? { narrated: true, amount } : nessie.transferHome(amount, requestId)),
  moveToSavings: async (amount, requestId) => (live() ? { narrated: true, amount } : nessie.moveToSavings(amount, requestId)),
  fundFromSavings: async (amount, item, requestId) => (live() ? { narrated: true, amount } : nessie.fundFromSavings(amount, item, requestId)),
  deposit: async (...a) => (live() ? { narrated: true } : nessie.deposit(...a)),
  putBack: (o) => (live() ? budget.putBack(o) : null),
  // Raw access some callers still use (the watcher, the schedule). Live mode has no Nessie cache to read.
  readCache: () => (live() ? { purchases: [], transfers: [], putBack: budget.state().putBacks || [], envelope: budget.state().envelope, live: true } : nessie.readCache()),
  writeCache: (c) => (live() ? undefined : nessie.writeCache(c)),
  call: (...a) => nessie.call(...a),
  spentThisWeek: async () => module.exports.week().spent,
  refresh: (force) => budget.refresh(force),
  closeWeek: (o) => (live() ? budget.closeWeek(o) : null),
  correct: (k, kind) => (live() ? budget.correct(k, kind) : null),
};
