# Pricing wiring: what the research found (Oct 7 2026)

Sources fetched Oct 7 2026: extensionpay.com, stripe.com/pricing, docs.stripe.com (upgrades, changelog, webhooks,
checkout fulfillment, free trials, subscription webhooks, checkout sessions, customer portal, managed payments),
stripe-node 23.0.0, lemonsqueezy.com, paddle.com, gumroad.com, Chrome Web Store program policies, grammarly.com,
ynab.com, copilot.money, monarch.com, CNBC on Rocket Money (Mar 18 2026), RevenueCat State of Subscription Apps 2026,
Userpilot Aug 19 2026 citing ChartMogul Jan 2026.

## Options and fees
| Option | Fee | Fit |
|---|---|---|
| Stripe direct (Checkout + Billing + Portal) | 2.9% + 30c, plus 0.7% Billing | Yes: US account, we already have users and a server |
| Stripe Managed Payments (merchant of record) | +3.5% | Flip on when non-US revenue appears |
| ExtensionPay | 5% on top of Stripe | Duplicates the login we have |
| Lemon Squeezy | 5% + 50c | Folding into Stripe Managed Payments; do not start here |
| Paddle | 5% + 50c | VAT handling is dead weight for US-only revenue |
| Gumroad | 10% + 50c | Worst fee |

On $4.99 Stripe keeps about 48c (9.6%); on $39 about $1.70 (4.4%). The 30c fixed fee is why yearly is the default plan.

## Comparables
Grammarly Pro $12/mo yearly, 7-day trial. Rocket Money $7 to $14/mo, 7-day trial. YNAB $14.99/mo or $109/yr, 34-day
trial, no free tier. Copilot $95/yr, 1-month trial. Monarch $14.99/mo or $99.99/yr, 7-day trial. Honey is free (affiliate).

## Evidence on free tier vs trial
RevenueCat 2026 (2025 data): hard paywall converts 10.7% download-to-paid by day 35 against 2.1% for freemium, with
near-identical year-one retention. Trial-to-paid medians: 25.5% (4 days or less), 37.4% (5 to 9 days), 42.5% (17 to 32).
ChartMogul Jan 2026: freemium 3 to 5%, no-card trial 4 to 6%, card-required trial 25 to 35%.

**Verdict:** card-required 7-day trial, yearly preselected. Every direct comparable except Honey does this. A degraded
free tier costs about five times the conversion at this price.

## Chrome Web Store policy (Accepting Payment From Users)
No in-app-purchase flag exists. The policy: "If your Product requires the user to pay to obtain basic functionality,
you must make that clear in the description"; "clearly identify that you, not Google, are the seller"; "conspicuously
post your terms of sale (including any refund and return policies)". The listing needs the price, the trial, the
seller line and a terms link.

## The Stripe calls (plain Node, form-encoded, `Stripe-Version: 2026-09-30.endive`)
1. `POST /v1/checkout/sessions`: mode=subscription, line_items[0][price], client_reference_id=<user id>,
   metadata[user_id], subscription_data[metadata][user_id], subscription_data[trial_period_days]=7,
   allow_promotion_codes=true, success_url with {CHECKOUT_SESSION_ID}, cancel_url.
2. Webhook: raw body, header `t=...,v1=...`, HMAC-SHA256 of `${t}.${raw}` with the whsec key, constant-time compare,
   reject if the timestamp is more than 300 s off, dedupe on event id. Events: checkout.session.completed,
   customer.subscription.updated / deleted (plan on when status is trialing or active), invoice.payment_failed,
   customer.subscription.trial_will_end.
3. `POST /v1/billing_portal/sessions` with customer and return_url for cancel and plan switching.
4. The extension asks `GET /me` for { plan, status, periodEnd } on startup and after checkout.

## What we built from this
`api/billing.js` (Stripe over plain https, no SDK), routes `POST /billing/checkout`, `POST /billing/portal`,
`POST /stripe/webhook`, `GET /me`; the plan on every `/week`; the popup's plan row. With no `STRIPE_SECRET_KEY` the
API runs open (everyone full) so nothing changes until Praise adds keys. Default when keys exist: 7-day card trial,
then the judge goes quiet and the popup shows the two prices. `MAMA_FREE_TIER=1` keeps her in the cart on the free
tier with voice and texts off, the degraded alternative, kept as a switch because the evidence says it loses.
