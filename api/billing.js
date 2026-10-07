// Billing: Stripe over plain https, no SDK. docs/research/PRICING.md.
//
// The plan: a 7-day card-required trial, then $4.99 a month or $39 a year, yearly preselected. The evidence (RevenueCat
// 2026, ChartMogul 2026) puts a card trial at five times the conversion of a free tier at this price. With no
// STRIPE_SECRET_KEY the API runs open: every user is `open`, nothing is gated, nothing changes until keys exist.
// MAMA_FREE_TIER=1 is the degraded alternative (she stays in the cart, voice and texts off) kept as a switch.
//
// Flow: POST /billing/checkout -> Stripe Checkout Session (subscription mode, trial, client_reference_id = user id)
//       -> the person pays in a new tab -> Stripe posts /stripe/webhook (signature checked on the raw body)
//       -> the user's plan row is set -> GET /me tells the extension { plan, status, periodEnd, trialDaysLeft }.
//       POST /billing/portal -> the Customer Portal for cancel and plan switching.

const https = require('node:https');
const crypto = require('node:crypto');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS billing (user_id TEXT PRIMARY KEY, customer_id TEXT, subscription_id TEXT, status TEXT, price_id TEXT, period_end INTEGER, trial_end INTEGER, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS stripe_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, at INTEGER NOT NULL);
`);

const STRIPE_VERSION = '2026-09-30.endive';
const TRIAL_DAYS = Number(process.env.MAMA_TRIAL_DAYS || 7);
const PRICES = { month: { amount: 4.99, label: '$4.99 a month' }, year: { amount: 39, label: '$39 a year' } };
const now = () => Date.now();

const q = {
  get: db.prepare('SELECT * FROM billing WHERE user_id = ?'),
  byCustomer: db.prepare('SELECT * FROM billing WHERE customer_id = ?'),
  put: db.prepare(`INSERT INTO billing (user_id, customer_id, subscription_id, status, price_id, period_end, trial_end, updated_at) VALUES (@user_id, @customer_id, @subscription_id, @status, @price_id, @period_end, @trial_end, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET customer_id = COALESCE(excluded.customer_id, customer_id), subscription_id = COALESCE(excluded.subscription_id, subscription_id), status = COALESCE(excluded.status, status), price_id = COALESCE(excluded.price_id, price_id), period_end = COALESCE(excluded.period_end, period_end), trial_end = COALESCE(excluded.trial_end, trial_end), updated_at = excluded.updated_at`),
  seenEvent: db.prepare('INSERT OR IGNORE INTO stripe_events (id, type, at) VALUES (?, ?, ?)'),
};

const configured = () => !!process.env.STRIPE_SECRET_KEY;
const priceId = (plan) => (plan === 'month' ? process.env.STRIPE_PRICE_MONTH : process.env.STRIPE_PRICE_YEAR) || '';

/** One Stripe call, form-encoded, as the docs show for a server without the SDK. */
function stripe(method, path, form = {}) {
  return new Promise((resolve, reject) => {
    const body = method === 'POST' ? new URLSearchParams(flatten(form)).toString() : '';
    const req = https.request({ host: 'api.stripe.com', path, method, headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'stripe-version': STRIPE_VERSION, 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let raw = ''; res.on('data', (c) => (raw += c)); res.on('end', () => { try { const j = JSON.parse(raw); if (res.statusCode >= 400) reject(new Error(j.error?.message || `Stripe ${res.statusCode}`)); else resolve(j); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.setTimeout(15000, () => req.destroy(new Error('Stripe timed out')));
    req.end(body);
  });
}
/** { a: { b: 1 }, c: [x] } -> { 'a[b]': 1, 'c[0]': x } as Stripe's form encoding wants. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === 'object') flatten(v, key, out); else out[key] = String(v);
  }
  return out;
}

/** Start a checkout for this user: subscription mode, the trial, the user id on every later event. */
async function checkout(userId, plan = 'year', { successUrl, cancelUrl, email } = {}) {
  if (!configured()) throw new Error('Billing is not set up on this API.');
  if (!userId) throw new Error('a device token is required');
  const price = priceId(plan);
  if (!price) throw new Error(`No Stripe price for the ${plan} plan.`);
  const existing = q.get.get(userId);
  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,
    customer: existing?.customer_id || undefined,
    customer_email: existing?.customer_id ? undefined : email,
    metadata: { user_id: userId },
    subscription_data: { metadata: { user_id: userId }, trial_period_days: TRIAL_DAYS || undefined },
    allow_promotion_codes: 'true',
    success_url: successUrl || `${process.env.MAMA_PUBLIC_URL || 'https://api.mamabudget.com'}/billing/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.MAMA_PUBLIC_URL || 'https://api.mamabudget.com'}/billing/cancelled`,
  });
  return { url: session.url, id: session.id };
}

/** The Customer Portal: cancel, switch monthly and yearly, update the card. */
async function portal(userId, returnUrl) {
  if (!configured()) throw new Error('Billing is not set up on this API.');
  const row = q.get.get(userId);
  if (!row?.customer_id) throw new Error('No subscription to manage yet.');
  const s = await stripe('POST', '/v1/billing_portal/sessions', { customer: row.customer_id, return_url: returnUrl || `${process.env.MAMA_PUBLIC_URL || 'https://api.mamabudget.com'}/billing/done` });
  return { url: s.url };
}

/**
 * Webhook signature, as Stripe documents it: header `t=...,v1=...`, HMAC-SHA256 of `${t}.${rawBody}` with the
 * endpoint secret, constant-time compare, timestamp within five minutes.
 */
function verifySignature(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET, at = Math.floor(now() / 1000)) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  const v1 = String(header).split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !v1.length || Math.abs(at - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

/** Apply one Stripe event. Idempotent on event id; order is not assumed (the subscription's own status wins). */
function applyEvent(event) {
  if (!event || !event.id) return { ok: false };
  if (q.seenEvent.run(event.id, event.type || '', now()).changes === 0) return { ok: true, duplicate: true };
  const o = event.data && event.data.object;
  if (!o) return { ok: true };
  const sub = (s, userId) => q.put.run({ user_id: userId, customer_id: s.customer || null, subscription_id: s.id || null, status: s.status || null, price_id: s.items?.data?.[0]?.price?.id || null, period_end: s.current_period_end ? s.current_period_end * 1000 : null, trial_end: s.trial_end ? s.trial_end * 1000 : null, updated_at: now() });
  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = o.client_reference_id || o.metadata?.user_id;
      if (userId) q.put.run({ user_id: userId, customer_id: o.customer || null, subscription_id: typeof o.subscription === 'string' ? o.subscription : null, status: 'trialing', price_id: null, period_end: null, trial_end: null, updated_at: now() });
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const userId = o.metadata?.user_id || q.byCustomer.get(o.customer)?.user_id;
      if (userId) sub(o, userId);
      break;
    }
    case 'invoice.payment_failed': {
      const row = q.byCustomer.get(o.customer);
      if (row) q.put.run({ user_id: row.user_id, customer_id: null, subscription_id: null, status: 'past_due', price_id: null, period_end: null, trial_end: null, updated_at: now() });
      break;
    }
    default: break;
  }
  return { ok: true };
}

/** Handle the raw webhook request body. Throws on a bad signature so the server answers 400. */
function webhook(rawBody, signatureHeader) {
  if (!verifySignature(rawBody, signatureHeader)) throw new Error('bad signature');
  return applyEvent(JSON.parse(rawBody));
}

/**
 * The plan the extension reads. `open` when billing is not configured. Otherwise: trialing / active are `full`;
 * past_due keeps full for seven days; anything else is `locked` (or `free` when MAMA_FREE_TIER=1).
 */
function planFor(userId, at = now()) {
  if (!configured()) return { plan: 'open', status: 'open', periodEnd: null, trialDaysLeft: null, prices: PRICES };
  const row = userId ? q.get.get(userId) : null;
  const status = row?.status || 'none';
  const trialDaysLeft = row?.trial_end ? Math.max(0, Math.ceil((row.trial_end - at) / 86400000)) : null;
  const graceOk = status === 'past_due' && row.updated_at && at - row.updated_at < 7 * 86400000;
  const full = status === 'trialing' || status === 'active' || graceOk;
  return { plan: full ? 'full' : process.env.MAMA_FREE_TIER === '1' ? 'free' : 'locked', status, periodEnd: row?.period_end || null, trialDaysLeft, prices: PRICES };
}

module.exports = { checkout, portal, webhook, verifySignature, applyEvent, planFor, configured, PRICES, TRIAL_DAYS, flatten };
