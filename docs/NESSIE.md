# Nessie: what Ugonna needs to make true tonight

Nessie is Capital One's simulated bank for hackathons. It is the only ledger Mama reads. Two of the six hooks in PLAN.md depend on it being right: she reads your month and says one true thing in onboarding, and your phone gets a real first statement before setup ends. If the ledger is thin, both are lies. So this is the first job, before any route.

## 1. Get in (10 minutes)

1. Go to nessieisreal.com, sign in with GitHub, copy the API key.
2. Put it in `apps/api/.env` as `NESSIE_KEY=`. Never anywhere else. `.env` is in `.gitignore` before the first commit.
3. Base URL is `https://api.nessieisreal.com`. HTTPS only. Plain http times out (another team found this the hard way last month).
4. Every request carries `?key=KEY` as a query parameter. No headers.
5. Smoke test: `curl "https://api.nessieisreal.com/customers?key=KEY"` should return a JSON array, even if empty.

## 2. Three quirks that change how we build

| Quirk | What it means for us |
|---|---|
| Purchase amounts are truncated to integers | Everything we post is whole dollars. `whole()` in `client.js` rounds before posting. Her lines say "$32," never "$31.99." |
| Account `balance` does not move when purchases, deposits or transfers post | Never read balance. Every number she says (spent, left, kept) is a sum over the purchases and transfers we fetch. `month()` in `client.js` does this. |
| Merchant `category` is a string, purchases require a `merchant_id` | Create the eleven merchants first, keep their ids, then post purchases. The seed does this in order. |

Also: there is a `GET` for each list but no date filter, so we fetch everything for the account and filter in code. And the description field is free text, so it is ours: `"<tag> | <item>"` where tag is `need`, `want`, `family`, `saved` or `income`. That tag is how `/month` knows what counts against the envelope.

## 3. The seven resources and why each exists

| Resource | Endpoint | Why we use it |
|---|---|---|
| Customers | `POST /customers` | The student, and a second customer "Family Home" so money sent home is a real transfer to a real account |
| Accounts | `POST /customers/{id}/accounts` | Checking, Savings, and the family account. Types are `Checking` and `Savings` |
| Merchants | `POST /merchants` | Eleven merchants with a category string. Food Delivery, Grocery, Coffee, Clothing, Bars, Utilities, Phone, Education, Transit |
| Purchases | `POST /accounts/{id}/purchases` | 19 purchases over 30 days, tagged need or want in the description |
| Deposits | `POST /accounts/{id}/deposits` | Two paychecks, so the statement can say what came in |
| Transfers | `POST /accounts/{id}/transfers` | $50 to the family account, $40 to savings. These are what "Kept" counts |
| Bills | `POST /accounts/{id}/bills` | Rent, $650, recurring on the 1st, next payment in 4 days. Feeds "rent in 4 days" in her sub line |

Field names the seed uses, confirm them against the docs page in hour one:

- Purchase: `merchant_id, medium: "balance", purchase_date: "YYYY-MM-DD", amount, status: "completed", description`
- Deposit: `medium: "balance", transaction_date, status: "completed", amount, description`
- Transfer: `medium: "balance", payee_id, amount, transaction_date, status: "completed", description`
- Bill: `status: "recurring", payee, nickname, payment_date: "YYYY-MM-DD", recurring_date: 1, payment_amount`
- Merchant: `name, category (string), address {street_number, street_name, city, state, zip}, geocode {lat, lng}`

## 4. The story the seed tells

Run `NESSIE_KEY=... node api/nessie/seed.js`. It writes to Nessie and mirrors everything to `data/nessie-cache.json`, so if Nessie is down during judging the cache answers and nobody notices.

The 30 days, whole dollars:

- Needs, never move the meter: electric 48, phone 45, groceries 14 + 31 + 22, rice 24 at Target, textbook 62, bus pass 30
- Wants over 30 days, 210: DoorDash 32 + 27 + 24 + 19 (102, the biggest), hoodie 55, Starbucks 7 + 7 + 6, bubble tea 8 + 9, bar 16
- Wants this week (Monday to today), 50 of a 75 weekly envelope: Starbucks 6, DoorDash 19, bubble tea 9, bar 16
- Income: two paychecks of 480
- Kept: 50 sent home 19 days ago, 40 moved to savings this week. 90 over 30 days, 40 this week
- Bill: rent 650 due in 4 days

Why these numbers: the envelope is weekly. $50 of $75 puts her at calm with the meter visibly up, so one $179 AirPods buy on stage blows the week many times over and Gele goes down. Food delivery at 102 over 30 days against rice at 24 is the one true thing she says in onboarding, and the top three want merchants become the three things she says she will watch. Kept $40 this week gives the home panel a real number on first open.

## 5. What `/week` and `/month` must return

Both come from `client.js`, already written and tested against the local cache. `GET /week` is the envelope she watches (`week()`), shape below with `envelope: 75, spent: 50, left: 25, kept: 40, daysLeft: 2`. `GET /month` is the 30 day read for onboarding (`month()` plus `trueLine()`, `watches()`, `proposeEnvelope()`):

```json
{
  "envelope": 300, "spent": 210, "left": 90, "kept": 90, "ratio": 0.7, "mood": "calm",
  "bills": [{ "nickname": "Rent", "amount": 650, "daysUntil": 4 }],
  "topWants": [{ "merchant": "DoorDash", "category": "Food Delivery", "amount": 102 }, ...],
  "cheapestFood": { "item": "20 lb bag of rice", "amount": 24 },
  "counts": { "purchases": 19, "wants": 11, "needs": 8 }
}
```

`trueLine()` gives the onboarding facts: `{ topCategory: "food delivery", topAmount: 102, contrastItem: "rice", contrastAmount: 24 }`. The character wording lives in `lines/writer.js`, not here. `proposeEnvelope()` takes a week of the last 30 days of wants (210 / 30 × 7 = 49) plus 40 percent room to breathe, rounded up to 25, so she proposes $75 and the user slides it. `watches()` is the top three want merchants, worded in `lines/writer.js` as `watchLines()`.

One decision baked in: the envelope is **weekly**, Monday 00:00 to Sunday 23:59 local, closed by the Sunday 7pm statement. The 30 day read is only for onboarding. Reason: paychecks and the statement are weekly, $75 a week is a number a student can feel in a cart, and the demo falls on a Sunday with six days of history in the week.

## 6. The writes during the demo

- `POST /buy` with `{ item, price, merchant, tag, requestId }` calls `purchase()`. The order id from the confirmation page is the `requestId`, so a refresh never double posts. Tag comes from the verdict: a need buy never moves the meter.
- `POST /transfer` with `{ amount, requestId }` calls `transferHome()`. Text "send 50 home" lands here.
- `POST /deposit` with `{ amount, requestId }` calls `moveToSavings()`. Text "move 40 to savings" lands here. Both add to Kept.
- Every write mirrors to the cache first, then tries Nessie with a 4 second timeout. Nessie failing never fails the request.

## 7. Done means

- [ ] `curl .../customers?key=` returns JSON over HTTPS
- [ ] Seed runs clean, prints `Nessie seeded` with 11 merchants and 19 purchases
- [ ] `GET /accounts/{id}/purchases?key=` in the browser shows the 19 rows with the `tag | item` descriptions
- [ ] `GET /week` returns spent 50, left 25, kept 40, Rent in 4. `GET /month` returns trueLine food delivery 102 vs rice 24, proposedEnvelope 75
- [ ] Screenshot of the seeded purchases list saved to `docs/proof/nessie.png` for Devpost
- [ ] Field names above checked against the live docs and this file corrected if any differ

If the docs page will not load (it was flaky for other teams), the Python SDK on GitHub `nessieisreal/nessie-python-sdk` has the field names in its model files.
