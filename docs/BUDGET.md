# The budgeting core, and the injection and character track

What Mama Budget has to become to be a budgeting product, not a cart judge with a slider. Written Oct 5 2026 from
three research passes: how YNAB, Monarch, Copilot, Rocket Money, Cleo, Qapital, Digit and Simple actually work; what
the behavioural evidence says keeps people under budget past month one; and how production systems turn raw bank
rows into bills, income, transfers, needs and wants. The sources are in docs/BUDGET_SOURCES.md. Everything below is
either a decision or a number; nothing is a mood.

## 0. The one sentence

Mama holds you to one number a week, fun money, that she computes from your real bank: what came in, minus what has
to go out before the next paycheck, minus what you said to save, minus what you need to live on, divided by the weeks
until payday. She says that number and the days left. Everything else is how she gets it right and how she says it.

## 1. What changes from today

| Today | The core |
|---|---|
| Envelope set by a slider, proposed from 30 days of wants times 1.4 | Envelope computed from income, bills, goals and needs; the slider adjusts the proposal and she says why |
| Two tags, want and need, from a word list | Five kinds: income, transfer, bill, need, want; rules first, your corrections forever, the model last |
| One seeded rent bill | Bills and paychecks detected from the ledger, confirmed once, forecast forward |
| Kept = savings transfers plus put-backs | Kept = the same, swept into a named jar every Sunday; it never inflates next week |
| Nessie sandbox, seeded history | SimpleFIN read-only link, nightly sync, 90 days back on day one |
| No notion of a card | Credit card payments are transfers, card purchases count once, the card balance you will pay comes out of safe to spend |

## 2. The pipeline, in order

Every nightly sync runs these in this order. Each step is a pure function over rows with a test, in `api/budget/`.

### 2.1 Pull (`sync.js`)
GET the Access URL `/accounts` with `pending=1`, 90 days per request (the Bridge caps the range; 24 requests a day per
link, so one nightly pull plus a 14-day re-pull for mutations). Rows: `id`, `posted` (0 while pending), `amount`
(signed string, positive is a deposit), `description`, `transacted_at`, `pending`. Accounts: `id`, `name`,
`currency`, `balance`, `available-balance`, `balance-date`. Show every `errlist` entry to the user; the Bridge requires it.

### 2.2 Normalise the merchant (`merchant.js`)
Uppercase, collapse whitespace. Strip channel prefixes (`POS DEBIT`, `CHECK CARD PURCHASE`, `PURCHASE AUTHORIZED ON 10/02`,
`RECURRING DEBIT CARD`, `ACH DEBIT`, `DIRECT DEP`). Strip ACH metadata (`ORIG CO NAME:`, `DESC DATE:`, `TRACE#`, `PPD ID:`).
Remove reference junk (`REF#`, `CARD ENDING 1234`, `*2K4ABC`, 10+ digit runs, inline dates, `STORE 1700`, trailing city,
state, ZIP). Processor prefixes become a `via` field, not a merchant: `SQ *`, `TST*`, `PAYPAL *`, `APLPAY`, `GOOGLE *`;
`AMZN MKTP` and `AMAZON.COM*` are Amazon. Alias table (`WM SUPERCENTER` → Walmart, `UBER *TRIP` vs `UBER *EATS`). Then
fuzzy-group per user so `SHELL OIL 574` and `SHELL OIL 1021` share one `merchant_key`. Keep `raw`, `normalized`, `merchant_key`, `via`.

### 2.3 Transfers and card payments first (`transfers.js`)
Nothing is spending until this has run.
1. Pair matching: different accounts, equal amount to the cent, opposite sign, within 3 days, posted only, each row used
   once, nearest date wins. Both accounts must be the user's and the amount at least $20 unless one side passes the vocabulary.
2. Vocabulary: `PAYMENT THANK YOU`, `AUTOPAY`, `AUTOMATIC PAYMENT`, `ONLINE PAYMENT`, `CC PAYMENT`, `ONLINE TRANSFER TO/FROM`,
   `INTERNAL TRANSFER`, `XFER`, issuer names (`CHASE CREDIT CRD AUTOPAY`, `AMEX EPAYMENT`, `CAPITAL ONE CRCARDPMT`, `APPLECARD GSBANK PAYMENT`).
3. Account type rule: a credit on a card account is a payment if matched by 1 or 2, otherwise a refund that nets against spending.
Loan and mortgage payments are bills, not transfers. Venmo, Zelle and Cash App to yourself, brokerage sweeps and ATM
withdrawals are transfer-like: out of spending, shown on their own line.

### 2.4 Recurring streams: bills and paychecks (`recurring.js`)
Key = `merchant_key` + sign. Cluster amounts: exact, else within max(7.5%, $1); utilities up to 30% if the dates are tight.
Median gap classifies cadence: 6 to 8 days weekly, 13 to 15 biweekly, semi-monthly when the days of month pair
(1st and 15th, 15th and last), 28 to 31 monthly, 89 to 92 quarterly, 360 to 370 annual. Date tolerance 3 days.
Mature at 3 hits; 2 for quarterly or annual, and 2 when the description says `RECURRING`, `MEMBERSHIP` or `AUTOPAY`.
With 90 days of history, two-hit monthly streams are "early": they go into the forecast flagged, and onto the
confirmation screen as "confirm?". Predict the next date as last date plus median gap, clamped to month end. Missed
when now is 5 days past the prediction; inactive after two misses. Amount forecast: last amount for fixed streams, the
trimmed median of the last three for variable ones. More than 6 hits in 30 days is a habit, never a bill.
Income: positive rows on deposit accounts not claimed as transfers, matching `PAYROLL`, `SALARY`, `DIRECT DEP`, `DIR DEP`,
`PPD`, `ADP`, `GUSTO`, `PAYCHEX`, `WORKDAY`, `SSA`, `IRS TREAS`, or forming a recurring inflow of $200 or more. Variable
income (coefficient of variation above 15%) is budgeted on the minimum of the last three paychecks, never the mean.

### 2.5 Kinds (`kinds.js`)
Label set: Plaid's public taxonomy, mapped to five kinds. Needs: groceries, pharmacy, primary care, fuel, transit, tolls,
parking, rent, utilities, phone, insurance, childcare. Wants: restaurants, coffee, fast food, entertainment, general
merchandise, travel, personal care; rideshare is a want you can flip. Cascade: your correction by `merchant_key`
(forever, replayed on every sync), then deterministic rules (the vocabularies above plus grocery, pharmacy, fuel,
telecom and insurer names), then the alias table, then the Haiku classifier on the normalised name. Thresholds as the
extension already uses: apply at 0.90 and above, show as a guess between 0.60 and 0.90, leave as an uncategorised want
below. The model never overrides a rule or a correction. The PROTECTED word list in rules_v2 stays and sits above all of it.

### 2.6 Pending, refunds, reversals (`reconcile.js`)
Pending rows live in their own set. A pending row is retired when a posted row on the same account, same sign, amount
equal or within 25% (tips, fuel pre-authorisations), same `merchant_key`, posts within 7 days. A pending row with no
match after 10 days is a dropped authorisation and is deleted. A refund is a positive row whose `merchant_key` matches
a prior negative of equal or smaller amount within 60 days; it nets against that kind and is never income. A reversal
is the same amount, opposite sign, same merchant within 3 days; hide both. Re-pull a trailing 14 days every sync and
diff by id, because posted rows change.

### 2.7 Safe to spend and the week (`plan.js`)
```
safe   = sum(available-balance, else balance, over cash accounts)
       - bills due before next payday (mature and early streams, missed ones kept for 5 days)
       - the card balance you will pay before payday (statement balance when autopay in full)
       - savings contributions due this period
       - pending debits not already netted by available-balance
needs  = trailing 4-week median of needs, scaled to the days until payday
fun    = max(0, safe - needs) / weeks until payday        (the weekly envelope she proposes)
```
Monarch's shape, Simple's recomputation: every new row recomputes it. The envelope is proposed from this and the user
may move it; she says the reason in one sentence: "$145 a week: your pay, minus rent, the phone, groceries and the
$100 you said to save." Pay-period alignment stays weekly, Monday to Sunday, with "until payday" shown as a second
number when payday is inside the week.

### 2.8 The week's rules (`week.js`, replaces the sums in nessie/client.js)
- Only wants move the meter. Needs and bills are reported, never scolded.
- Unspent fun money is swept into the Kept jar on Sunday at 7 pm, named and shown growing. It never rolls into next
  week's envelope (expiring budgets cause the end-of-week binge; a visible jar makes the small win).
- Overspend: next week's envelope is reduced by the overage, said plainly on Sunday, capped at half the envelope so a
  bad week never zeroes the next.
- One grace a month: a week that went over by less than 25% is forgiven on request ("Mama's grace"), costs the grace,
  and keeps the weeks-kept streak alive. A streak that cannot be repaired kills engagement; a free one does nothing.
- Weeks kept is the streak. Three in a row is said out loud on Sunday.
- Buy anyway always works and never argues. Hard earmarks push people to credit; she never blocks an emergency.

## 3. First run, three questions
1. Link the bank (paste the SimpleFIN setup token; she says what SimpleFIN is and what it costs, in one sentence).
2. "Here is what I saw": detected paychecks, detected bills (early ones marked "confirm?"), detected transfers and
   cards, the top ten uncategorised merchants by spend. Confirm or fix in one screen. Ask payday and a savings amount
   only if not detected.
3. The weekly number, pre-filled from the formula, with her one-sentence reason, and one prompt the evidence says
   corrects the usual under-estimate: "Anything unusual this week?"
Nothing else. The grandma and loudness questions stay where they are.

## 4. The injection and character track

The cart judge is the product's front door, and it has to be right on every page type, not only carts. What exists is
detection by two signals, five readers, and a judge; what is missing is page-type discipline and a corpus.

### 4.1 Page types and what she does on each
| Page | Signals | She |
|---|---|---|
| Cart or bag | cart path or title, subtotal, checkout control | reads, asks or nods, one card |
| Checkout | pay path, order summary, payment fields | reads the order lines, no new asks for items already asked |
| Product page | JSON-LD Product, add-to-cart control, not a money path | asks on the add click only, never on arrival |
| Pricing grid | several recurring prices, nothing chosen | silent (shipped Oct 5: `comparingPlans`) |
| Plan checkout or upgrade modal | one recurring price with a subtotal, pay control or "current plan" | reads the plan as one item with its period |
| Order confirmation | thank-you words and an order number | posts what was paid from the page's own total (shipped Oct 4) |
| Order history, account, billing pages | history or account paths | silent; these say "order placed" about money already gone |
| Search results, category listings, recommendation rails | many prices, no subtotal, no cart words | silent |

### 4.2 Behaviour rules
- Calm is the default. Loud is rare and earned by the envelope, never by the item.
- First sightings are asked, in one card for a whole cart ("six new things"), never six cards.
- An item asked on the product page is not asked again in the cart, under any name (shipped Oct 4: `recall()`).
- One reaction per item, three asks per session, one card at a time. A re-read of the same cart never re-opens a card.
- Pricing pages: she speaks only when a plan is chosen or being paid for.
- Wording varies on every repeat (the no-repeat picker plus `fresh()`); habituation erases a prompt that never changes.
- She texts first after an overspend, in a tone that invites a reply; the person will not open the app that day.
- Every loud line names the price, the item and the week's number, and nothing about the person.
- Quiet hours stay opt-in until launch, then default on.

### 4.3 The corpus
Four saved carts are not a regression suite. Build a saved-page corpus of at least 30 pages across the eight types above,
from at least 15 stores (the three adapted stores, five Shopify stores, three other platforms, four unknown stores, two
subscription products), each with the expected read (items, subtotal, or silence) in a sidecar JSON. The detector and
readers run against it in `npm test`, and `tools/live.mjs` runs five of them live in CI weekly. A new store that fails
in the wild gets saved into the corpus before it gets fixed.

### 4.4 Speed budget, held by tests
Gate under 5 ms. Click to her words under 1 s on adapted and platform stores, under 3 s cold on unknown stores. Judge
under 2 s with the line, badge at once. These are the numbers measured live on Oct 4; the harness fails the build if
they regress by more than 25%.

## 5. Modules and tests
```
api/budget/
  sync.js        SimpleFIN pull, windows, errlist           test: recorded responses, 24-a-day guard
  merchant.js    normalise, via, alias, fuzzy key           test: 40 raw descriptions -> keys
  transfers.js   pairs, vocabulary, account-type rule        test: the fixture's pairs, the false $50 pair
  recurring.js   streams, cadence, maturity, forecast        test: payroll, rent, Netflix price change, two plans
  kinds.js       five kinds, cascade, corrections            test: rules beat model, corrections beat rules
  reconcile.js   pending, refunds, reversals                 test: $1 pre-auth to $43, $40 tip to $48, dropped auth
  plan.js        safe to spend, needs forecast, fun money    test: worked examples, variable income on the minimum
  week.js        meter, sweep, overspend carry, grace, streak test: Sunday close, grace once a month, cap at half
api/test/fixtures/ledger-120d.json   the synthetic ledger in section 6
```
The judge (`rules_v2`) does not change. It receives the week from `week.js` instead of `nessie/client.js`. Nessie
remains as demo mode for a person with no bank, seeded from the same fixture.

## 6. The fixture
One synthetic 120-day ledger across checking, savings and one credit card: biweekly payroll (`ACME CORP DIR DEP PPD ID: 123`)
with one bonus and one holiday shift; a semi-monthly variant; rent on the 1st by Zelle that posts on the 3rd once; a
variable electric bill; Netflix with a mid-series price change; a second Netflix line at a different amount; a weekly
Spotify-style charge; one annual charge; the card autopay pair one day apart; a checking-to-savings pair same day;
two unrelated $50 purchases on the same day that must not pair; a pending $40 restaurant that posts $48; a $1 fuel
pre-auth that posts $43; a pending row that vanishes; an Amazon refund; a duplicate charge and its reversal;
`SQ *`, `TST*`, `AMZN Mktp US*2K4ABC`, `POS DEBIT WALMART SUPERCENTER #1700 POWAY CA`, `UBER *TRIP`, `UBER *EATS`,
`PAYPAL *SPOTIFY`, `CHECK #1042`, `ATM WITHDRAWAL`, `VENMO FROM FRIEND`; and a corrections file that must survive a re-sync.
Expected outputs are fixed: streams with cadence, next date and confidence; transfer pairs; kinds; and one safe-to-spend
number for a fixed "today".

## 6b. Built, Oct 7 2026
Sections 2 to 5 are code in `api/budget/` with tests on the fixture (`api/test/budget_*.test.js`), the live ledger is
wired through `api/ledger.js`, and onboarding screens 04 to 06 run on a real link. Verified against the SimpleFIN demo
link end to end (360 rows, three accounts). Not yet: the corpus of 30 pages and the speed harness in CI (section 4.3,
4.4), the extension's kept moments and shelf surfaces, and a run on Praise's own bank (needs her token).

## 7. Definition of done
The core is done when, on the fixture and on Praise's real SimpleFIN link:
1. Every bill and paycheck in the fixture is detected with the right cadence, and the two-hit monthly bill shows as "confirm?".
2. No transfer or card payment is counted as spending; the false $50 pair is not paired.
3. Safe to spend and the weekly number match the worked example to the dollar, and recompute on a new row.
4. Sunday close sweeps the leftover into the jar, carries an overage capped at half, honours one grace a month, and texts the result.
5. "Here is what I saw" shows real detected data from a real bank, and the envelope's reason sentence is true.
6. The corpus of 30 pages passes, the eight page types behave as the table says, and the speed budget holds.
7. The judge's invariance test and the 50-case score are unchanged.

## 8. Order of work, Thursday to Saturday
- **Thursday:** fixture, `merchant.js`, `transfers.js`, `recurring.js`, with tests. SimpleFIN `sync.js` against Praise's link.
- **Friday:** `kinds.js`, `reconcile.js`, `plan.js`, `week.js`. Swap the judge's week source. "Here is what I saw" on real data.
- **Saturday:** Sunday close with sweep, carry and grace; the corpus to 30 pages; page-type rules in the detector; speed budget in the harness; the texts for overspend and streak.

## 9. Decisions, settled Oct 5 (Praise)
- **Overspend carry cap:** half the next envelope.
- **Grace:** one a month, and good weeks earn more: every four weeks kept in a row banks one extra grace, at most two banked. Grace never covers a week more than 25% over.
- **Savings default:** 10% of net pay when none is detected, noted at once on first run and changeable in one tap.
- **Restricting purchases when things get bad:** on ice. The idea has cases that go wrong (emergencies, needs, shared cards); she never blocks, she speaks. Revisit only with evidence from real weeks.
- **Watcher (one person who gets a weekly line):** yes in principle; needs its own research pass on consent, wording and what the watcher can see before it is built.
- **Kept jar:** a number she narrates at launch; a real transfer when a bank with transfers exists.
- **Name:** Mama Budget. Settled.
- **Who builds:** Praise builds all of it. Ugonna's role is testing on his Mac and the demo setup.
- **Hosting:** EC2 with Docker, like Remi, before anyone else uses the API.
- **Resets:** none. RESET_ON_RELOAD is off from Oct 5; the demo is over.
- **Design pass before Thursday:** the envelope and the surfaces the loop needs (kept moments, the shelf, the Sunday report card, the jar), with the chosen avatar's miniature uses. Screens first, then code.

## 9b. Open
- Overspend carry cap: half the envelope (proposed) or a third.
- Grace: one a month (proposed) or one a quarter.
- Savings default when none is detected: 10% of net pay (proposed) or ask.
- Whether the Kept jar moves real money to savings at SimpleFIN banks (it cannot; SimpleFIN is read-only, so the jar is a number until a bank with transfers exists) or stays a number she narrates.
