# Mama Budget

**You set the fun money for the week. She holds you to it, in your cart, before you pay, not after. What you need, she never touches.**

Every money app tells you after the money is gone. Mama Budget is a working Chrome extension (open source, 144 tests, built zip in Releases) that sits in the corner of your cart as a small face in a gold ring. It is not a blocker and not a guilt trip: she never shames, she asks once, she reacts only when you said something was a want and it blows the week, and Buy anyway is always there. Groceries, rent, medicine, money sent home: she says nothing. A new want above a few dollars: she asks what it is for, once, and remembers. A want that blows the week: she says the price, the item and what is left, out loud and in text, while the Buy button is still in front of you. Nothing is ever blocked. You can always buy anyway. Her number is **Kept**, what you did not spend, and it only goes up.

Built at MHacks 2026 by **Praise Oyimi** and **Ugonna Emeka-Inegbu**. Site: [mamabudget.com](https://mamabudget.com). Tracks: FinTech, Judged by an LLM, Useless AI, Dumbest Idea. Sponsor APIs: Capital One Nessie, Photon, ElevenLabs. Model: Claude.

## Who she is for

International and first generation students who send money home. Their budget has a line most apps have no category for: family. Every bank app files a $200 transfer home under "Transfers" next to a $200 jacket. She files it under need, before any rule about wants runs, because to her user that is not a judgement call. Four grandmas ship: **Mama**, Nigerian; **Nana**, US Midwest; **Abuela**, Mexican American; **Grandma Wong**, Cantonese. Same rules, same math, four voices, each written from documented speech of real grandmothers, never improvised, with the lines that shame left out on purpose. The figure from home follows the person's region, never the grandma. In Messages, one word (abuela, wong, nana, mama) changes who answers.

## Ninety seconds with her

1. **Install.** The first run opens in a tab. Two questions: who is checking (Mama, Nana, Abuela or Grandma Wong) and how loud (three tiers under her own names, from Gentle Auntie to Full Nigerian Mother). Everything else she reads from the bank.
2. **She reads your month** from Nessie: the envelope, what went on wants this week, what you kept, the merchants that keep coming back. "Here is what I saw" uses your name once, from the ledger. "What I will watch" names the merchants she will meet you at.
3. **A practice cart** so you meet her before a real store. Rice, quiet. Something you do not need, she asks.
4. **Amazon.** Rice in the cart, she breathes in the corner, meter still. AirPods in, one neutral card: "AirPods Pro, $249. What is this for?" with a one line box for a reason.
5. **You answer.** "I just want them" admits a want; she reacts to the week, not to you. If it fits, a nod. If it blows the week, Gele down: "Ehn ehn. $249, with $25 left this week. You are sure?" Spoken and written. The row in your cart gets her mark.
6. **You type a reason instead.** "Graduation" makes it planned, never scolded. If it costs more than the week has, she offers the gap from savings and moves it through the bank when you say yes.
7. **Buy anyway** posts the purchase to Nessie, the meter climbs, the badge speaks once. **You're right** puts it back; Kept ticks up and she says so.
8. **Name a store.** She is on Target, Walmart, Allbirds, Zara, DoorDash and the subscription page of whatever you were about to sign up for. On a Shopify product page she answers the Add to cart click itself, before the item is in any cart. On a merchant she watches, she arrives with the week in hand before the cart opens.
9. **Your phone.** When the week blows and texts are on, she texts the phone through Photon, in character, with the same numbers. And the thread runs the other way: text her "should I buy the Sony XM5 for $348" or send her a screenshot of the product page, and she weighs it with the same judge and the same memory as the cart. A need gets a thumbs up and no words. A first sighting gets one question. A want over $25 gets a second bubble if the same product is cheaper somewhere she actually fetched, said as cash back in the week, with the link. Gele down arrives as a voice note in her voice.

## Judged by an LLM: the four criteria

### Innovation

The intervention happens at the only moment that changes behaviour: between the cart and the charge. Budget apps are reports. Browser coupon tools are reactive to price, not to you. She is a person in the cart who knows your week, asks before she judges, remembers the answer across every store, and treats money to family as sacred by design. The escalation is not a notification setting, it is a relationship: a first sighting is only ever a question, a remembered want gets a reaction sized to the week, a planned purchase is left alone, and the last thing she does with a saved purchase is say she is proud.

### Technical Complexity

- **Reach without permission creep.** One content script on `<all_urls>`, gated by a pure detector that runs under 5ms with no imports and no DOM writes. It needs two structural signals (a cart or checkout path, a subtotal node, a pay button, a card field or hosted checkout iframe) before loading anything. Prose alone never opens her. Gmail order emails, Zara's script tags and a "subscribe to newsletter" button were all live false positives that are now unit tests.
- **Four readers, one shape.** Platform JSON first (Shopify `/cart.js`, WooCommerce Store API, BigCommerce storefront, a same origin fetch), then hand written adapters through one `runAdapter(spec)` (Amazon checked rows only, Target, Walmart), then the product page's own JSON-LD (so the add to cart click is answered before the item is in any cart, and never on a cart path, where that data is recommendations), then the cart region's visible text to the model with a JSON schema. Prices are reconciled against the subtotal so unit and line prices never get confused. The judge never knows which reader fired.
- **Rules keep the promises, the model knows the world.** `rules_v2` is a pure function: family money protected, first sighting asked, planned never scolded, thresholds scaled by loudness, a $5 line on watched merchants. The model classifies whether an unknown item is a necessity from the item and the store, reads what a typed reason means, extracts items from cart text and writes her lines from the whole situation. It is raced on a timeout and completes into a cache, so a slow answer costs nothing and the next judgement is instant. Word lists are the fallback only when the model is off.
- **A real ledger.** Every purchase, put back, transfer home and plan funded from savings is a Nessie write with an idempotent `requestId`, so a card answered twice or an order page reloaded charges once. The week is computed from the ledger, not from a counter.
- **A stateless service worker.** All state in `chrome.storage` (memory keyed by normalised name so a want admitted on Amazon is remembered on Target, reasons, what was reacted to this week, what was posted). Audio from an offscreen document, `browser.tts` as fallback. The API fails twice in a row and the badge hides; a store page never shows an error.
- **Pre-written speech.** While the ask card is on screen she already writes both possible reactions and warms the voice, so the moment you answer she speaks.
- **The claim is a test, not a sentence.** `api/test/invariance.test.js` swaps the model for one that returns garbage and asserts all 50 frozen verdicts are byte for byte unchanged; then, for every case in every memory state, week, loudness and watched flag (over 10,000 situations), that whether she reacts is identical for every value the model could return, that a garbage answer behaves exactly like no answer, that family money is always protected, and that the model can only ever make her quieter.
- **144 tests**, 73 on the API (judge v1 and v2, invariance, reasons, the text reader, the no repeat picker, the ledger questions, Photon gate and echoes) and 71 on the extension (detector, each reader against saved real carts and product pages, flow, badge, week math, onboarding, and a source reading guard that fails if a shipped feature is not wired into the session).

### Usability

- Nothing is blocked. Buy anyway always works. No store button is ever clicked by us.
- One card at a time. Several small wants at once become one card with rows, not a pile of cards.
- Max one reaction per item, three asks per session, then she goes quiet.
- Every loud line names the amount, the item and what is left. Nothing about the person. One cultural marker per line at most. Every scolding ends with love.
- Text accompanies every spoken line. Voice can be off, sound can be off, and she still works. Cards are keyboard reachable, labelled, and respect reduced motion.
- Store currency first, home currency second, from the browser region, never from the grandma you picked.
- Start over, from the popup, clears her memory and resets the bank, so a second judge meets her fresh.

### Adherence to Theme

**She grows with you.** Week one she only asks. By week three she knows your haunts, your admitted wants and the reasons you gave, and she meets you at the door of the merchant that keeps eating the week. Her number, Kept, is a record of every time you were right. The fun money is yours to set; what grows is how well she knows the shape of your week, and how little she has to say.

## How it works

```
store tab                              service worker                    api (localhost:8787)
---------                              --------------                    --------------------
detect.ts (pure gate, <5ms)
  two signals ----> import session ---> JUDGE / ANSWER / PLAN / FUND --> /v2/judge  rules_v2 + model
  readers: platform JSON, adapters,     BUY / PUT_BACK / CONFIRM ------> /v2/buy, /v2/putback   Nessie ledger
           cart text -> EXTRACT ------> /extract                        model, JSON schema
  badge, card, bubble, panel, mark      SPEAK ----> offscreen audio <--- /tts                   ElevenLabs
                                        storage: memory, reasons, posted, settings                Photon texts
```

- `apps/extension/lib/detect.ts` decides whether she wakes. `lib/readers/` turns a page into `CartRead`. `lib/session.ts` runs the conversation. `lib/ui/` is the badge, card, bubble, panel and row mark, in one shadow root with `all: initial`, built with `createElement` only.
- `api/judge/rules.js` is v1, frozen for the 50 case score. `api/judge/rules_v2.js` is ask and remember, what ships.
- `api/lines/writer.js` is the fixed line bank and the fill rules; `api/lines/model.js` is the one file that talks to Claude.
- `api/nessie/client.js` is the bank. `api/voice/elevenlabs.js` is her voice. `api/photon/` is her texting.
- `packages/shared/` holds the typed messages and the `CartRead`, `Verdict`, `Week` and `Month` shapes both sides agree on.

### What the model does, and what it never does

The model (`claude-opus-5-5`, official SDK, structured JSON output) does four things: turns cart text into items, says whether an unknown item is an obvious necessity given the item and the store, reads what a typed reason means (an occasion, a need, or just a want), and writes her lines from the whole situation. Lines go through must include checks: the price, the item and what is left have to be in a loud line or the fixed pool is used instead.

The model never decides whether she reacts. Family money is protected before any model call. A first sighting is a question no matter what the model thinks. A planned item is never scolded. The week's numbers set the volume. With no key, every one of those promises still holds and she speaks from the pool.

## Is she right? The 50 case score

We froze 50 anonymised student purchases before writing any rules and asked mothers to label each one privately: Need, Want, or Depends. Rules v1 was frozen before the labels arrived and never changed after. The comparison is a merchant category map, the way a bank app labels the same purchases. Protocol and labels are in `data/` (`scoring_protocol.pdf`, `cases.json`, `labels/labels.json`, `baseline.json`).

```
npm run score
```

Two raters, Oct 4 2026, majority over both, a split is a case they disagreed on:

| Measure | Result |
|---|---|
| Mama agreement with participating mothers, where they agreed | 26 / 32 (81%) |
| Merchant only baseline, same 32 cases | 22 / 32 (69%) |
| Need safety breaches (target zero) | 0 / 16 |
| Asks on unclear cases | 6 / 15 (40%) |
| Cases the two mothers split on | 15 / 50 |

This is reported as agreement with our participating mothers, never as objective truth. Full tables, including every miss, are in `docs/RESULTS.md`.

What the score taught us, kept in the open: the first mother labelled both transfers home as Depends, and our hardest rule says money to family is always a need. We kept the rule and reported the disagreement. On unclear cases she still calls a want more often than she asks (6 of 15); the ask threshold moved in v2 and v1 stays frozen so the number above is honest. A third rater is pending.

## Sponsor APIs

**Capital One Nessie** is the bank, not a mock. The seed creates the customer's accounts (`POST /customers/:id/accounts`) and reads the customer back for the name (`GET /customers/:id`). Spending is `POST /accounts/:id/purchases`. Money moving is withdrawal and deposit pairs (`/withdrawals`, `/deposits`): transfers home, a plan funded from savings, a put back. Recurring things are `POST /accounts/:id/bills`. The week, the month, Kept, the savings balance and the watched merchants are all computed from what Nessie holds. A local cache mirrors it so the demo never stalls on the network, and `POST /reset` reseeds both.

**Photon** is her phone, both ways. When the week blows and texts are on, she texts through iMessage via Photon's Spectrum (her own number, no Mac), with the local Mac kit as the fallback. Texts to her are a fifth reader: words or a screenshot become items, judged by the same rules and remembered under the same keys as the cart; she confirms a photo she is unsure of before judging it, types while she reads, answers in one bubble, replies in thread, uses a tapback instead of words when a want fits, and sends a cheaper listing as a rich link only when the price came from a page the search returned. A restart never replays old texts and her own words are never read back as orders. Daily cap, minimum gap, allow list and a dry run mode are in `.env.example`; `GET /messages` shows what she would have sent. Off by default: the UI says "Texts are off right now" and never shows a sent state that did not happen.

**ElevenLabs** is her voice. `eleven_multilingual_v2`, Mama as "Mama (Amarachi)", Nana as "Mother (US Midwest)", with stability and style moved by mood so shocked and proud do not sound the same. Audio is cached by voice, mood and text; a `204` means text only.

## Privacy and permissions

- `<all_urls>` is required because she has to be wherever money is about to leave, and a cart is not a fixed list of domains. The gate is the trade: no import, no network, no DOM write happens until the detector sees a cart or checkout by two structural signals. On every other page the cost is one pure function.
- The only data that leaves a page is the visible text of the cart region, sent to our own API on localhost, and only when the platform JSON and the adapters did not read it. No page HTML, no cookies, no account data.
- Permissions: `storage`, `offscreen` (audio), `tts` (fallback voice). Host permission: `http://localhost:8787/*` only.
- Secrets live only in `api/.env`, which is gitignored. The extension bundle is public and holds no keys.
- No `innerHTML` with page data anywhere. One host element, open shadow root, never a write to the store's DOM.

## Accessibility

Every line is shown as text at the moment it is spoken, so she works for someone who can see and not hear, and for someone who can hear and not see. The badge carries an `aria-label` with what is left and the days to go. Cards use dialog roles, focus moves in and back out, buttons are real buttons, and the meter is a described value, not a colour. `prefers-reduced-motion` removes every animation. Numbers are read as words in speech so "$249" is never said as digits.

## Run it

Requirements: Node 22 or newer, Chrome.

```
git clone https://github.com/yimi23/mama-budget.git
cd mama-budget
npm install

cp .env.example api/.env     # fill NESSIE_KEY, ANTHROPIC_API_KEY, ELEVEN_API_KEY and the voice ids
npm run seed                  # a month of history for the demo student
npm run api                   # http://localhost:8787, GET /health should answer

npm test                      # 144 tests
npm run score                 # the 50 case score
npm run build:ext             # apps/extension/build/chrome-mv3
```

Load the extension: `chrome://extensions`, Developer mode on, **Load unpacked**, pick `apps/extension/build/chrome-mv3`. Or download the built zip from Releases, unzip, and load that folder. The first run tab opens on install. After reloading the extension, hard refresh any store tab you already had open.

Keys are optional. With none set the API runs on the local ledger cache, she speaks from the fixed line bank through `browser.tts`, and texts are off. With a Nessie key the bank is live. With an Anthropic key she reads carts she has never seen and writes lines from the situation. With an ElevenLabs key she has her voices.

**Teammates and a second laptop.** `npm run update` pulls, installs and builds; then click Reload on the extension in `chrome://extensions`. Every push to `main` also publishes `mama-budget-extension-latest.zip` on the `latest` release. To share one Mama between two laptops (one ledger, one phone number), run the API on one of them and put its address, for example `http://10.0.0.12:8787`, in the popup's home screen under "Where she runs"; the other laptop's extension then talks to it. The API listens on every interface and trusts any extension origin.

Useful during a judging session: **Start over** in the popup resets her memory and the bank. `POST /reset` does the same from the terminal. `npm run dev` runs the extension in watch mode and the API together.

## Where things are

```
apps/extension/   WXT, Manifest V3, TypeScript
  entrypoints/    content.ts (gate), background.ts (worker), offscreen, popup (onboarding), practice (cart)
  lib/            detect.ts, session.ts, flow.ts, readers/, ui/, onboarding.ts
  test/           69 tests, fixtures are saved real carts
api/              Node, plain http, no framework
  judge/          rules.js (v1, frozen), rules_v2.js (ships), reasons.js
  lines/          writer.js (line bank), model.js (the one file that calls Claude)
  nessie/         client.js, seed.js
  voice/ photon/ notify/
  test/           71 tests
packages/shared/  typed messages and shapes
scoring/          npm run score
data/             cases, labels, protocol, baseline
docs/             PLAN, ARCHITECTURE, DESIGN, ONBOARDING, BUILD_PLAN, REVIEW, RESULTS, DEMO, PHOTON
design/           brand marks and the numbered screens the UI was lifted from
```

## What is not done, said plainly

- Three stores have hand written adapters. Every other store's cart goes through the model reader, which is slower (a second or two) and asks instead of judging when its confidence is low. Product pages are read from their JSON-LD, which Shopify stores, Walmart and most big retailers publish and Amazon does not.
- The phone path needs `PHOTON_TO` and either a Mac signed into Messages or Spectrum credentials. Without them she never texts, and says so.
- The ledger moves on Buy anyway and on an order confirmation page she can recognise. A store with an unusual confirmation page is only charged from the card.
- The score has two raters. The third is pending, and 15 of 50 cases are splits the mothers did not agree on.
- The API runs on your machine. There is no hosted version, so the extension talks to `localhost:8787` and hides when it is down.

## Team

Praise Oyimi ([yimi23](https://github.com/yimi23)) and Ugonna Emeka-Inegbu ([HackUgo](https://github.com/HackUgo)). MHacks 2026, University of Michigan.

Voices by ElevenLabs. Bank by Capital One Nessie. Texts by Photon. Lines, reading and reasons by Claude. Everything she promises is kept by rules you can read in `api/judge/rules_v2.js`.
