// The live ledger: SimpleFIN rows through the pipeline, cached a day, with the week's state kept on disk.
// The server reads `week()`, `month()`, `saw()` and `setEnvelope()` from here when a SimpleFIN link exists, and from
// the Nessie sandbox otherwise (demo mode). Shapes match what nessie/client.js returned, so nothing downstream moves.
//
// Files (data/, never committed): budget-cache.json (the last pull: accounts, rows) and budget-state.json (envelope,
// closes, graces, jar, corrections, posted orders waiting for the bank).

const fs = require('node:fs');
const path = require('node:path');
const sync = require('./sync.js');
const { reconcile } = require('./reconcile.js');
const transfers = require('./transfers.js');
const recurring = require('./recurring.js');
const { classify } = require('./kinds.js');
const { plan } = require('./plan.js');
const week = require('./week.js');
const { merchant } = require('./merchant.js');

const DATA = path.join(__dirname, '..', '..', 'data');
const CACHE = path.join(DATA, 'budget-cache.json');
const STATE = path.join(DATA, 'budget-state.json');
const DAY = 86400;
const FRESH_MS = 6 * 3600 * 1000; // the Bridge refreshes about daily; we pull at most four times a day

const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };
const nowSec = () => Math.floor(Date.now() / 1000);
/** Callers pass a Date (schedule.js), milliseconds, or seconds. */
const toSec = (t) => (t == null ? nowSec() : t instanceof Date ? Math.floor(t.getTime() / 1000) : Number(t) > 1e11 ? Math.floor(Number(t) / 1000) : Number(t));

function live() { return /^https:\/\/[^@\s]+:[^@\s]+@/.test(process.env.SIMPLEFIN_ACCESS_URL || ''); }
function state() { return readJson(STATE, { envelope: null, closes: [], graces: { used: [], banked: 0 }, jar: 0, corrections: { kinds: {}, notRecurring: [] }, posted: [], putBacks: [] }); }
function saveState(s) { writeJson(STATE, s); return s; }

/** Pull from the bank when the cache is older than six hours (or `force`). Keeps the last good pull on failure. */
async function refresh(force = false) {
  const cache = readJson(CACHE, null);
  if (!force && cache && Date.now() - (cache.at || 0) < FRESH_MS) return cache;
  if (!live()) return cache;
  try {
    const now = nowSec();
    const windows = sync.windows(90, now);
    let accounts = [], rows = [];
    for (const w of windows) {
      const body = await sync.pull(process.env.SIMPLEFIN_ACCESS_URL, { start: w.start, end: w.end, pending: true });
      accounts = sync.accounts(body);
      rows = rows.concat(sync.rows(body));
      if (body.errlist.length) console.log('[budget] bank says:', body.errlist.map((e) => e.msg || e).join('; '));
    }
    const seen = new Set();
    rows = rows.filter((r) => (seen.has(r.id + r.accountId) ? false : seen.add(r.id + r.accountId)));
    const fresh = { at: Date.now(), accounts, rows };
    writeJson(CACHE, fresh);
    console.log(`[budget] pulled ${rows.length} rows across ${accounts.length} accounts`);
    return fresh;
  } catch (e) {
    console.log('[budget] pull failed, keeping the last one:', e.message);
    return cache;
  }
}

/** The pipeline over the cache: classified rows, streams, the plan. Orders posted by the extension that the bank
 *  has not shown yet are added as want rows so the week is true before the nightly sync. */
function compute(cache, st, now = nowSec()) {
  if (!cache) return null;
  const bankRows = reconcile(cache.rows, now);
  const resolved = transfers.resolve(bankRows, cache.accounts);
  const streams = recurring.streams(resolved, now, { notRecurring: st.corrections.notRecurring });
  let rows = classify(resolved, streams, st.corrections);
  // Posted orders: matched to a bank row by amount within $1 and three days, else kept as a pending want.
  const unmatched = [];
  for (const o of st.posted || []) {
    const hit = rows.find((r) => !r.matchedOrder && r.amount < 0 && Math.abs(-r.amount - o.price) < 1 && Math.abs((r.posted || r.transactedAt) - o.at) <= 3 * DAY);
    if (hit) { hit.matchedOrder = o.requestId; if (o.tag && hit.kind !== o.tag && !st.corrections.kinds[hit.merchantKey]) hit.kind = o.tag; hit.item = o.item; }
    else unmatched.push({ id: `order:${o.requestId}`, accountId: 'pending-orders', amount: -o.price, posted: 0, transactedAt: o.at, pending: true, description: o.item, payee: o.store || '', mcc: '', kind: o.tag || 'want', merchantKey: merchant(o.store || o.item).key, merchantName: o.store || o.item, item: o.item, fromExtension: true });
  }
  rows = rows.concat(unmatched);
  const p = plan({ rows, streams, accounts: cache.accounts, now, savingsDue: st.savingsDue ?? null });
  return { rows, streams, plan: p, accounts: cache.accounts, at: cache.at };
}

/** The last pull through the pipeline, synchronously: callers read the week in the middle of a request. */
function snapshot(now = nowSec()) {
  const cache = readJson(CACHE, null);
  const st = state();
  const c = compute(cache, st, now);
  return c ? { ...c, state: st } : null;
}

/** nessie.week() shape, from the bank. */
function weekView(at) {
  const now = toSec(at);
  const s = snapshot(now);
  if (!s) return null;
  const st = s.state;
  const envelope = st.envelope || s.plan.envelope;
  const w = week.current(s.rows, { ...st, envelope }, now, st.putBacks || []);
  const bills = s.plan.bills.map((b) => ({ payee: b.merchant, nickname: b.merchant, amount: b.amount, due: week.key(b.due), daysUntil: Math.max(0, Math.ceil((b.due - now) / DAY)), status: b.status }));
  const spentIncludesPending = s.rows.some((r) => r.fromExtension);
  return {
    envelope, budget: envelope, spent: w.spent, left: w.left, kept: w.kept, ratio: w.ratio, mood: w.mood, bills,
    topWants: w.topWants.map((t) => ({ merchant: t.merchant, amount: t.amount, category: 'Want' })), cheapestFood: null,
    sentHome: 0, toSavings: s.plan.savings, counts: { purchases: s.rows.filter((r) => r.amount < 0 && !['transfer', 'refund'].includes(r.kind)).length, wants: w.counts.wants, needs: s.rows.filter((r) => r.kind === 'need').length, paychecks: s.streams.filter((x) => x.kind === 'income').length, transfers: s.rows.filter((r) => r.kind === 'transfer').length, bills: bills.length },
    funded: 0, daysLeft: w.daysLeft, period: 'week', carry: w.carry, streak: w.streak, jar: w.jar, grace: w.grace,
    payday: s.plan.payday && { at: week.key(s.plan.payday.at), amount: s.plan.payday.amount, daysUntil: s.plan.daysUntil },
    safe: s.plan.safe, reason: s.plan.reason, proposed: s.plan.envelope, pendingFromExtension: spentIncludesPending, source: 'bank', pulledAt: s.at,
  };
}

/** nessie.month() shape, from the bank: the last 30 days. */
function monthView(at) {
  const now = toSec(at);
  const s = snapshot(now);
  if (!s) return null;
  const since = now - 30 * DAY;
  const rows = s.rows.filter((r) => (r.posted || r.transactedAt) >= since);
  const wants = rows.filter((r) => r.kind === 'want' && r.amount < 0);
  const byMerchant = {};
  for (const r of wants) { const k = r.merchantName || r.merchantKey; byMerchant[k] = (byMerchant[k] || 0) + -r.amount; }
  const topWants = Object.entries(byMerchant).map(([m, a]) => ({ merchant: m, amount: Math.round(a * 100) / 100, category: 'Want' })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const needs = rows.filter((r) => r.kind === 'need' && r.amount < 0);
  const cheapestFood = needs.filter((r) => /\b(?:grocer|market|kroger|meijer|walmart|aldi|shoprite|spar|costco)\b/i.test(r.merchantName || '')).sort((a, b) => -a.amount - -b.amount)[0];
  const envelope = (s.state.envelope || s.plan.envelope) * 4.3;
  const spent = Math.round(wants.reduce((x, r) => x + -r.amount, 0) * 100) / 100;
  return {
    envelope: Math.round(envelope), budget: Math.round(envelope), spent, left: Math.round(envelope - spent), kept: s.state.jar || 0, ratio: envelope ? spent / envelope : 0, mood: 'calm',
    bills: s.streams.filter((x) => x.direction === 'out' && x.kind === 'bill').map((b) => ({ payee: b.merchant, nickname: b.merchant, amount: b.amount, due: b.nextAt ? week.key(b.nextAt) : null, daysUntil: b.nextAt ? Math.max(0, Math.ceil((b.nextAt - now) / DAY)) : null })),
    topWants, cheapestFood: cheapestFood ? { item: cheapestFood.merchantName, amount: -cheapestFood.amount, merchant: cheapestFood.merchantName, tag: 'need', date: week.key(cheapestFood.posted || cheapestFood.transactedAt) } : null,
    sentHome: 0, toSavings: s.plan.savings, counts: { purchases: rows.filter((r) => r.amount < 0).length, wants: wants.length, needs: needs.length, paychecks: rows.filter((r) => r.kind === 'income').length, transfers: rows.filter((r) => r.kind === 'transfer').length, bills: s.streams.filter((x) => x.kind === 'bill').length },
    funded: 0, period: 'month', source: 'bank',
  };
}

/** "Here is what I saw": detected paychecks, bills (early ones marked confirm), transfers and cards, top unsure merchants. */
function saw(at) {
  const now = toSec(at);
  const s = snapshot(now);
  if (!s) return null;
  const unsure = {};
  for (const r of s.rows) if (r.unsure && r.amount < 0) unsure[r.merchantName] = (unsure[r.merchantName] || 0) + -r.amount;
  return {
    paychecks: s.streams.filter((x) => x.kind === 'income').map((x) => ({ from: x.merchant, amount: x.amount, cadence: x.cadence, next: x.nextAt ? week.key(x.nextAt) : null, variable: x.variable })),
    bills: s.streams.filter((x) => x.direction === 'out' && x.kind !== 'habit').map((x) => ({ merchant: x.merchant, amount: x.amount, cadence: x.cadence, next: x.nextAt ? week.key(x.nextAt) : null, confirm: x.status === 'early', kind: x.kind, variable: x.variable, changed: x.amountChanged })),
    cards: s.accounts.filter((a) => transfers.isCard(a)).map((a) => ({ name: a.name, owed: Math.max(0, -a.balance) })),
    transfers: s.rows.filter((r) => r.kind === 'transfer' && r.pairId).length / 2,
    unsure: Object.entries(unsure).map(([m, a]) => ({ merchant: m, amount: Math.round(a * 100) / 100 })).sort((a, b) => b.amount - a.amount).slice(0, 10),
    plan: s.plan, pulledAt: s.at,
  };
}

function setEnvelope(amount) { const st = state(); st.envelope = Math.max(25, Math.min(500, Math.round(Number(amount) || 0))); saveState(st); return st.envelope; }
function correct(merchantKey, kind) { const st = state(); if (kind === 'not-recurring') st.corrections.notRecurring = [...new Set([...st.corrections.notRecurring, merchantKey])]; else st.corrections.kinds[merchantKey] = kind; saveState(st); return st.corrections; }
/** An order the extension saw land: kept until the bank shows it. */
function postOrder({ requestId, item, price, store, tag }) { const st = state(); if (!(st.posted || []).some((o) => o.requestId === requestId)) { st.posted = [...(st.posted || []), { requestId, item, price: Number(price), store, tag, at: nowSec() }].slice(-200); saveState(st); } return st.posted.length; }
function putBack({ requestId, item, amount }) { const st = state(); if (!(st.putBacks || []).some((k) => k.requestId === requestId)) { st.putBacks = [...(st.putBacks || []), { requestId, item, amount: Number(amount), date: week.key(nowSec()) }].slice(-500); saveState(st); } return st.putBacks.length; }
function closeWeek({ useGrace = false } = {}, at) {
  const now = toSec(at);
  const s = snapshot(now);
  if (!s) return null;
  const st = s.state;
  const r = week.close(s.rows, { ...st, envelope: st.envelope || s.plan.envelope }, now, { useGrace, putBacks: st.putBacks || [] });
  saveState({ ...st, closes: r.state.closes, graces: r.state.graces, jar: r.state.jar });
  return r;
}

function ready() { return live() && !!readJson(CACHE, null); }

module.exports = { live, ready, refresh, snapshot, week: weekView, month: monthView, saw, setEnvelope, correct, postOrder, putBack, closeWeek, state, compute };
