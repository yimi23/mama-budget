// Capital One Nessie. Simulated bank for the demo. Not live bank access, say so on stage.
// Check the base URL and field names against the current docs before the demo:
// https://api.nessieisreal.com  (HTTPS only; plain http times out)
// Every call falls back to the local cache in data/nessie-cache.json if Nessie is slow or down,
// so the demo never stalls on someone else's server.

const fs = require('node:fs');
const path = require('node:path');
require('../env'); // loads api/.env into process.env before NESSIE_KEY is read below

const BASE = process.env.NESSIE_BASE || 'https://api.nessieisreal.com';
const KEY = process.env.NESSIE_KEY || '';
const CACHE = path.join(__dirname, '..', '..', 'data', 'nessie-cache.json');

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return { accountId: null, familyAccountId: null, savingsId: null, purchases: [], transfers: [], deposits: [], merchants: [], merchantIds: {} }; }
}
function writeCache(c) { fs.writeFileSync(CACHE, JSON.stringify(c, null, 2)); }

async function call(method, route, body) {
  if (!KEY) throw new Error('no NESSIE_KEY');
  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}key=${KEY}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`${method} ${route} -> ${r.status} ${detail}`.trim());
    }
    return r.status === 204 ? null : r.json();
  } finally { clearTimeout(t); }
}

const today = () => new Date().toISOString().slice(0, 10);

async function merchantId(name) {
  const c = readCache();
  if (c.merchantIds && c.merchantIds[name]) return c.merchantIds[name];
  try {
    const out = await call('POST', '/merchants', { name, category: 'demo', address: { street_number: '1', street_name: 'State St', city: 'Ann Arbor', state: 'MI', zip: '48109' }, geocode: { lat: 42.28, lng: -83.74 } });
    const id = out.objectCreated._id;
    c.merchantIds = c.merchantIds || {}; c.merchantIds[name] = id; writeCache(c);
    return id;
  } catch { return `local-${name}`; }
}

// Amounts are whole dollars: Nessie truncates purchase amounts to integers.
const whole = (n) => Math.round(Number(n));

async function purchase({ item, price, merchant, tag = 'want', requestId }) {
  const c = readCache();
  if (requestId && c.purchases.some((p) => p.requestId === requestId)) return c.purchases.find((p) => p.requestId === requestId);
  const rec = { item, amount: whole(price), merchant, tag, date: today(), requestId };
  try {
    const mid = await merchantId(merchant || 'Store');
    // nessieId lets the bank watcher (notify/watch.js) tell "already mirrored by our own API" from
    // "posted straight to Nessie by someone else" when it polls live purchases, without double-counting.
    const out = await call('POST', `/accounts/${c.accountId}/purchases`, { merchant_id: mid, medium: 'balance', purchase_date: rec.date, amount: rec.amount, status: 'completed', description: `${tag} | ${item}` });
    if (out?.objectCreated?._id) rec.nessieId = out.objectCreated._id;
  } catch { /* fall back to cache only */ }
  c.purchases.push(rec); writeCache(c);
  return rec;
}

// Nessie rejects "medium" and "payee_id" on /transfers ("extra fields not permitted") and never
// stores or reports a destination for one (verified against the live sandbox), so a transfer record
// alone can't move money or say where it went. A withdrawal on the source account plus a deposit on
// the destination account does both for real, tagged the same "<tag> | <item>" way as purchases so
// the description stays meaningful if anything ever reads these live instead of the local cache.
async function moveMoney(fromId, toId, amount, date, description) {
  // The withdrawal's nessieId is what the bank watcher (notify/watch.js) matches against, and what a
  // chat-initiated transfer (notify/chat.js) pre-marks as "seen" so the watcher never notifies it twice.
  const out = await call('POST', `/accounts/${fromId}/withdrawals`, { medium: 'balance', amount, transaction_date: date, status: 'completed', description });
  await call('POST', `/accounts/${toId}/deposits`, { medium: 'balance', amount, transaction_date: date, status: 'completed', description });
  return out?.objectCreated?._id;
}

async function transferHome(amount, requestId) {
  const c = readCache();
  if (requestId && c.transfers.some((t) => t.requestId === requestId)) return c.transfers.find((t) => t.requestId === requestId);
  const rec = { amount: whole(amount), to: 'family', tag: 'family', item: 'Sent home', date: today(), requestId };
  try { rec.nessieId = await moveMoney(c.accountId, c.familyAccountId, rec.amount, rec.date, 'family | Sent home'); } catch {}
  c.transfers.push(rec); writeCache(c);
  return rec;
}

async function moveToSavings(amount, requestId) {
  const c = readCache();
  if (requestId && c.transfers.some((t) => t.requestId === requestId)) return c.transfers.find((t) => t.requestId === requestId);
  const rec = { amount: whole(amount), to: 'savings', tag: 'saved', item: 'Moved to savings', date: today(), requestId };
  try { rec.nessieId = await moveMoney(c.accountId, c.savingsId, rec.amount, rec.date, 'saved | Moved to savings'); } catch {}
  c.transfers.push(rec); writeCache(c);
  return rec;
}

// Kept for the older route name. A deposit into savings is the same as moving money to savings.
const deposit = moveToSavings;

// The envelope is weekly. The week runs Monday 00:00 to Sunday 23:59 local, and the Sunday 7pm statement closes it.
// "month()" is the 30 day read she does in onboarding; "week()" is the envelope she watches.
function weekStart(now = new Date()) {
  const d = new Date(now); const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d;
}
function inWindow(dateStr, days = 30) {
  const d = new Date(dateStr); const now = new Date();
  return (now - d) / 86400000 <= days;
}
// Dates are YYYY-MM-DD; parse at local noon so a UTC midnight never lands on the previous local day.
function inWeek(dateStr, now = new Date()) { return new Date(`${dateStr}T12:00:00`) >= weekStart(now); }
function daysLeftInWeek(now = new Date()) { const end = weekStart(now); end.setDate(end.getDate() + 7); return Math.max(0, Math.ceil((end - now) / 86400000)); }

// Everything she says comes from these sums. Never from Nessie's balance field, which does not move.
function summary(filter, envelope) {
  const c = readCache();
  const purchases = c.purchases.filter((p) => filter(p.date));
  const transfers = c.transfers.filter((t) => filter(t.date));
  const wants = purchases.filter((p) => p.tag === 'want');
  const spent = wants.reduce((s, p) => s + p.amount, 0);
  const kept = transfers.reduce((s, t) => s + t.amount, 0) + (c.putBack || []).filter((k) => filter(k.date)).reduce((s, k) => s + k.amount, 0);
  // A charge with no store name (a card buy from an unknown page) groups under its own item name instead of a blank.
  const byMerchant = {};
  for (const p of wants) { const k = p.merchant || p.item || 'something'; byMerchant[k] = (byMerchant[k] || 0) + p.amount; }
  const topWants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([merchant, amount]) => ({ merchant, amount, category: (c.merchants || []).find((m) => m.name === merchant)?.category || merchant }));
  const deposits = (c.deposits || []).filter((d) => filter(d.date));
  const sentHome = transfers.filter((t) => t.to === 'family').reduce((s, t) => s + t.amount, 0);
  const toSavings = transfers.filter((t) => t.to === 'savings').reduce((s, t) => s + t.amount, 0);
  const needs = purchases.filter((p) => p.tag === 'need');
  const staples = needs.filter((p) => /rice|eggs|bread|groceries|beans|garri/i.test(p.item));
  const cheapestFood = staples.find((p) => /rice/i.test(p.item)) || staples.sort((a, b) => a.amount - b.amount)[0] || null;
  const bills = (c.bills || []).map((b) => ({ ...b, daysUntil: Math.ceil((new Date(b.due) - new Date()) / 86400000) })).filter((b) => b.daysUntil >= 0 && b.daysUntil <= 7);
  const ratio = envelope ? spent / envelope : 0;
  const mood = ratio >= 1 ? 'down' : ratio >= 0.9 ? 'shocked' : ratio >= 0.75 ? 'watching' : 'calm';
  return { envelope, budget: envelope, spent, left: Math.max(0, envelope - spent), kept, ratio, mood, bills, topWants, cheapestFood, sentHome, toSavings, counts: { purchases: purchases.length, wants: wants.length, needs: needs.length, paychecks: deposits.length, transfers: transfers.length, bills: (c.bills || []).length } };
}

// This week's envelope. What the badge, the card and "how much do I have left" read.
// "Take $200 from savings for this week": savings to checking in Nessie, and the week's envelope grows by that much.
// Not a transfer in the kept sense (nothing was saved), so it lives in its own list.
async function fundFromSavings(amount, item, requestId) {
  const c = readCache();
  c.funding = c.funding || [];
  if (requestId && c.funding.some((f) => f.requestId === requestId)) return c.funding.find((f) => f.requestId === requestId);
  const rec = { amount: whole(amount), item, date: today(), requestId };
  try { rec.nessieId = await moveMoney(c.savingsId, c.accountId, rec.amount, rec.date, `fund | ${item}`); } catch {}
  c.funding.push(rec); writeCache(c);
  return rec;
}

/** What is in savings as the ledger knows it: everything ever moved there, minus what came back out to fund a week. */
function savingsBalance() {
  const c = readCache();
  const inn = (c.transfers || []).filter((t) => t.to === 'savings').reduce((s, t) => s + t.amount, 0);
  const out = (c.funding || []).reduce((s, f) => s + f.amount, 0);
  return Math.max(0, inn - out);
}

function week(now = new Date()) {
  const c = readCache();
  const funded = (c.funding || []).filter((f) => inWeek(f.date, now)).reduce((s, f) => s + f.amount, 0);
  const envelope = (c.envelope || Number(process.env.FUN_BUDGET || 75)) + funded;
  return { ...summary((d) => inWeek(d, now), envelope), funded, daysLeft: daysLeftInWeek(now), period: 'week' };
}

// The 30 day read for onboarding: the true line and the watches. Its envelope is the weekly one times 4.3 so ratio still means something.
function month(days = 30) {
  const c = readCache();
  const envelope = Math.round((c.envelope || Number(process.env.FUN_BUDGET || 75)) * 4.3);
  return { ...summary((d) => inWindow(d, days), envelope), period: 'month' };
}

// The one true line for onboarding. Facts only; the character wording is added in lines/writer.js.
function trueLine(m = month()) {
  const top = m.topWants[0];
  if (!top) return null;
  return { topCategory: top.category.toLowerCase(), topAmount: top.amount, contrastItem: m.cheapestFood ? m.cheapestFood.item.replace(/^\d+\s*lb bag of\s*/i, '') : null, contrastAmount: m.cheapestFood ? m.cheapestFood.amount : null };
}

// Proposed weekly envelope: a week of what you spend (30 day wants / 30 * 7) plus 40% room to breathe, rounded up to 25, floored at 25.
function proposeEnvelope(m = month()) { return Math.max(25, Math.ceil((m.spent / 30 * 7 * 1.4) / 25) * 25); }

// Three watches from the top want merchants. Facts only; wording in lines/writer.js.
function watches(m = month()) { return m.topWants.slice(0, 3); }

// The first name Nessie holds for the demo student. Read once, kept in the cache. Used exactly once, on "Here is what I saw".
async function customerName() {
  const c = readCache();
  if (c.firstName) return c.firstName;
  if (!c.customerId) return null;
  const cust = await call('GET', `/customers/${c.customerId}`);
  c.firstName = cust && cust.first_name ? String(cust.first_name) : null;
  if (c.firstName) writeCache(c);
  return c.firstName;
}

// The weekly envelope, set from onboarding screen 06. Whole dollars, 25 to 500.
function setEnvelope(amount) {
  const n = Math.max(25, Math.min(500, Math.round(Number(amount) || 0)));
  const c = readCache(); c.envelope = n; writeCache(c);
  return n;
}

async function spentThisWeek() { return week().spent; }
const spentThisMonth = spentThisWeek; // old name, kept for the server

module.exports = { call, purchase, transferHome, moveToSavings, fundFromSavings, savingsBalance, deposit, week, month, trueLine, proposeEnvelope, watches, weekStart, daysLeftInWeek, spentThisWeek, spentThisMonth, readCache, writeCache, customerName, setEnvelope };
