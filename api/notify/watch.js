// The bank watcher. Every 3s, fetches the checking account's purchases and withdrawals straight from
// Nessie and compares against what it has already seen. This is the ONLY place that calls notify()
// for a ledger event, so a purchase posted anywhere -- our own /buy, /v2/buy, the /bank demo
// terminal, or straight to Nessie by hand -- produces exactly one text, and /buy and /v2/buy no
// longer text directly (see api/server.js).
//
// Withdrawals are watched too, not just purchases: Nessie's /transfers never stores a destination
// (see nessie/client.js), so "money sent home or moved to savings" shows up here as a withdrawal on
// checking tagged "family | ..." or "saved | ...", which is how the "proud" level fires.
//
// Persistence: data/notify-state.json holds which Nessie ids have been processed and whether the
// very first tick has run yet. The first tick ever (or the first after a reset) only records what is
// already there -- it never texts, so a freshly seeded month's history never triggers a notification.
// Every tick after that texts for anything genuinely new, including across a server restart, because
// the seen list is a file, not a process global.

const fs = require('node:fs');
const path = require('node:path');
const nessie = require('../nessie/client');
const { judge } = require('../judge/rules');
const writer = require('../lines/writer');
const memory = require('./memory');
const notifyMod = require('./index');

const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'notify-state.json');
const POLL_MS = 3000;
const CART_TTL_MS = 10 * 60 * 1000;

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { bootstrapped: !!s.bootstrapped, seen: s.seen || [] };
  } catch {
    return { bootstrapped: false, seen: [] };
  }
}
function writeState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

/** Pre-marks a Nessie id as seen, e.g. a transfer the chat just confirmed, so this tick doesn't text it again. */
function markSeen(nessieId) {
  if (!nessieId) return;
  const s = readState();
  if (!s.seen.includes(nessieId)) { s.seen.push(nessieId); writeState(s); }
}

// Carts the extension reported via /v2/judge (see server.js), kept 10 minutes, for "a new purchase
// matches a cart reported recently" -> include the item names in the text.
let recentCarts = [];
function recordCart(store, items) {
  if (!items || !items.length) return;
  const total = items.reduce((s, i) => s + Number(i.unitPrice || 0) * Number(i.qty || 1), 0);
  recentCarts.push({ store: String(store || ''), items, total, at: Date.now() });
  pruneCarts();
}
function pruneCarts() {
  const cutoff = Date.now() - CART_TTL_MS;
  recentCarts = recentCarts.filter((c) => c.at >= cutoff);
}
function latestCart() {
  pruneCarts();
  return recentCarts.length ? recentCarts[recentCarts.length - 1] : null;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matchCart(merchant, amount) {
  pruneCarts();
  const nm = norm(merchant);
  return recentCarts.find((c) => {
    const sameMerchant = !!nm && (norm(c.store).includes(nm) || nm.includes(norm(c.store)));
    const sameTotal = Math.abs(c.total - amount) < 1; // whole-dollar rounding
    return sameMerchant || sameTotal;
  }) || null;
}

// Our own description convention, "<tag> | <item>". Anything posted outside our API (the item 9/11
// "straight to Nessie" test) usually won't have it, so judge/rules.js classifies it the same way it
// would classify a card item -- reused, not duplicated.
function parseTagged(description) {
  const m = /^(need|want|family|saved|income)\s*\|\s*(.*)$/i.exec(String(description || ''));
  return m ? { tag: m[1].toLowerCase(), item: m[2].trim() } : null;
}

function levelFor(tag, afterRatio) {
  if (tag === 'family' || tag === 'saved') return 'proud';
  if (tag !== 'want') return null;
  if (afterRatio >= 1) return 'over';
  if (afterRatio >= 0.75) return 'warning';
  return 'note';
}

function merchantNameFor(cache, merchantId) {
  if (!merchantId) return '';
  const entry = Object.entries(cache.merchantIds || {}).find(([, id]) => id === merchantId);
  return entry ? entry[0] : '';
}

async function handlePurchase(p, cache) {
  const tagged = parseTagged(p.description);
  let tag, itemName;
  if (tagged) {
    tag = tagged.tag; itemName = tagged.item;
  } else {
    const v = judge({ item: String(p.description || ''), price: Number(p.amount || 0), merchant: '' }, nessie.week());
    tag = v.label === 'need' ? 'need' : 'want';
    itemName = String(p.description || '(purchase)');
  }
  const merchant = merchantNameFor(cache, p.merchant_id);
  const alreadyMirrored = cache.purchases.some((c) => c.nessieId === p._id);
  if (!alreadyMirrored) {
    cache.purchases.push({ item: itemName, amount: Number(p.amount || 0), merchant, tag, date: String(p.purchase_date || '').slice(0, 10), nessieId: p._id });
  }
  const weekAfter = nessie.week();
  const level = levelFor(tag, weekAfter.ratio);
  if (!level) return; // need: no text

  const amount = Number(p.amount || 0);
  const cart = matchCart(merchant, amount);
  const cartNames = cart ? cart.items.map((i) => i.name) : null;

  const mem = memory.read();
  const broken = memory.findBrokenPromise(mem, itemName, merchant);
  let text = writer.notifyText(level, weekAfter, { item: itemName, price: amount }, 'mama', cartNames);
  if (broken) {
    memory.markBroken(mem, broken, itemName);
    text += `\nYou said "${broken.text}."`;
  }
  if (level === 'warning' || level === 'over') memory.noteCommented(mem, { nessieId: p._id, item: itemName, level });
  memory.addHistory(mem, 'mama', text);
  memory.write(mem);

  await notifyMod.notify(null, text, level);
}

async function handleWithdrawal(w, cache) {
  const tagged = parseTagged(w.description);
  if (!tagged || (tagged.tag !== 'family' && tagged.tag !== 'saved')) return; // not ours to narrate
  const alreadyMirrored = cache.transfers.some((c) => c.nessieId === w._id);
  if (!alreadyMirrored) {
    cache.transfers.push({ amount: Number(w.amount || 0), to: tagged.tag === 'family' ? 'family' : 'savings', item: tagged.item, tag: tagged.tag, date: String(w.transaction_date || '').slice(0, 10), nessieId: w._id });
  }
  const weekAfter = nessie.week();
  const text = writer.notifyText('proud', weekAfter, { item: tagged.item, price: Number(w.amount || 0) }, 'mama');
  const mem = memory.read();
  memory.addHistory(mem, 'mama', text);
  memory.write(mem);
  await notifyMod.notify(null, text, 'proud');
}

async function tick() {
  const cache = nessie.readCache();
  if (!cache.accountId) return; // not seeded yet

  let purchases, withdrawals;
  try {
    [purchases, withdrawals] = await Promise.all([
      nessie.call('GET', `/accounts/${cache.accountId}/purchases`),
      nessie.call('GET', `/accounts/${cache.accountId}/withdrawals`),
    ]);
  } catch (e) {
    console.log('[watch] Nessie unavailable this tick, skipping:', e.message);
    return;
  }

  const state = readState();
  const seen = new Set(state.seen);
  const bootstrap = !state.bootstrapped;
  const events = [...(purchases || []).map((row) => ({ kind: 'purchase', row })), ...(withdrawals || []).map((row) => ({ kind: 'withdrawal', row }))];
  let changed = false;

  for (const { kind, row } of events) {
    const id = row._id;
    if (!id || seen.has(id)) continue;
    seen.add(id); changed = true;
    if (bootstrap) continue; // pre-existing (seeded) history: recorded as seen, never texted

    try {
      if (kind === 'purchase') await handlePurchase(row, cache);
      else await handleWithdrawal(row, cache);
    } catch (e) {
      console.log('[watch] notify failed for', id, e.message);
    }
  }

  if (bootstrap) state.bootstrapped = true;
  if (changed) {
    state.seen = [...seen];
    writeState(state);
    nessie.writeCache(cache);
  }
}

let timer;
function start() {
  if (timer) return;
  const run = () => tick().catch((e) => console.log('[watch] tick failed:', e.message));
  run();
  timer = setInterval(run, POLL_MS);
}
function stop() {
  clearInterval(timer);
  timer = undefined;
}

/** POST /reset and npm run reseed: fresh student means fresh watcher state too. */
function resetState() {
  writeState({ bootstrapped: false, seen: [] });
  recentCarts = [];
}

module.exports = { start, stop, resetState, recordCart, latestCart, markSeen };
