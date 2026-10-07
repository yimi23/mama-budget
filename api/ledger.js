// The one ledger the rest of the API reads. Live when a SimpleFIN link has been pulled (api/budget), the Nessie
// sandbox otherwise (demo mode). Same names and shapes as nessie/client.js, so callers do not know which is under them.
//
// What changes in live mode: the week comes from real bank rows; an order the extension sees is kept as a posted
// order until the bank shows it; a put-back is a kept moment on the week; the envelope is the person's or the plan's;
// money never moves (SimpleFIN is read-only), so "to savings" and "home" are narrated, not executed.

const nessie = require('./nessie/client');
const budget = require('./budget');

// MAMA_LEDGER=demo pins the sandbox (tests, demos on a machine with a link).
const live = (userId) => process.env.MAMA_LEDGER !== 'demo' && budget.ready(userId);
// A second device with no bank yet reads the shared sandbox week, but its own put-backs and shelf live in its own
// state rows: the Nessie cache belongs to the owner, and does not exist at all once the owner is live.
const ownState = (userId) => live(userId) || (!!userId && !budget.isOwner(userId));
const DAY = 86400000;
const keptThisWeek = (userId, at) => { const start = nessie.weekStart(at || new Date()).getTime(); return (budget.state(userId).putBacks || []).filter((k) => Date.parse(`${k.date}T12:00:00Z`) >= start && Date.parse(`${k.date}T12:00:00Z`) < start + 7 * DAY).reduce((s, k) => s + k.amount, 0); };

module.exports = {
  live,
  // Every reader takes the user last; no user means the owner (the watcher, the schedule and chat run as the owner).
  week: (at, userId) => (live(userId) ? budget.week(at, userId) : ownState(userId) ? { ...nessie.week(at), kept: keptThisWeek(userId, at) } : nessie.week(at)),
  month: (at, userId) => (live(userId) ? budget.month(at, userId) : nessie.month(at)),
  saw: (userId) => (live(userId) ? budget.saw(undefined, userId) : null),
  setEnvelope: (amount, userId) => (live(userId) ? budget.setEnvelope(amount, userId) : nessie.setEnvelope(amount)),
  proposeEnvelope: (m, userId) => (live(userId) ? (budget.snapshot(undefined, userId)?.plan.envelope ?? 75) : nessie.proposeEnvelope(m)),
  trueLine: (m) => nessie.trueLine(m),
  watches: (m) => nessie.watches(m),
  weekStart: nessie.weekStart,
  daysLeftInWeek: nessie.daysLeftInWeek,
  savingsBalance: (userId) => (live(userId) ? (budget.state(userId).jar || 0) : nessie.savingsBalance()),
  customerName: (userId) => (live(userId) ? Promise.resolve(null) : nessie.customerName()),
  // Money paths. Live: recorded, never moved.
  purchase: async (o, userId) => (live(userId) ? budget.postOrder({ requestId: String(o.requestId || `${o.item}:${Date.now()}`), item: o.item, price: o.price, store: o.merchant, tag: o.tag }, userId) : nessie.purchase(o)),
  transferHome: async (amount, requestId, userId) => (live(userId) ? { narrated: true, amount } : nessie.transferHome(amount, requestId)),
  moveToSavings: async (amount, requestId, userId) => (live(userId) ? { narrated: true, amount } : nessie.moveToSavings(amount, requestId)),
  fundFromSavings: async (amount, item, requestId, userId) => (live(userId) ? { narrated: true, amount } : nessie.fundFromSavings(amount, item, requestId)),
  deposit: async (...a) => (live() ? { narrated: true } : nessie.deposit(...a)),
  // Null means "not handled here": the server writes the owner's sandbox cache instead.
  putBack: (o, userId) => (ownState(userId) ? budget.putBack(o, userId) : null),
  // The shelf: put-backs not let go, newest first. Demo mode keeps them in the Nessie cache.
  shelf: (userId) => (ownState(userId) ? budget.shelf(userId) : budget.shelfRows(nessie.readCache().putBack || [])),
  shelve: (o, userId) => {
    if (ownState(userId)) return budget.shelve(o, userId);
    const c = nessie.readCache();
    c.putBack = (c.putBack || []).map((k) => (k.requestId !== o.requestId ? k : o.action === 'let-go' ? { ...k, gone: 'let' } : o.action === 'still' ? { ...k, still: true } : k));
    nessie.writeCache(c);
    return budget.shelfRows(c.putBack);
  },
  // Raw access some callers still use (the watcher, the schedule). Live mode has no Nessie cache to read.
  readCache: () => (live() ? { purchases: [], transfers: [], putBack: budget.state().putBacks || [], envelope: budget.state().envelope, live: true } : nessie.readCache()),
  writeCache: (c) => (live() ? undefined : nessie.writeCache(c)),
  call: (...a) => nessie.call(...a),
  spentThisWeek: async () => module.exports.week().spent,
  refresh: (force, userId) => budget.refresh(force, userId),
  closeWeek: (o, userId) => (live(userId) ? budget.closeWeek(o, undefined, userId) : null),
  correct: (k, kind, userId) => (live(userId) ? budget.correct(k, kind, userId) : null),
  linkAccess: (access, userId) => budget.linkAccess(access, userId),
  isOwner: (userId) => budget.isOwner(userId),
  claimOwner: (userId) => budget.claimOwner(userId),
};
