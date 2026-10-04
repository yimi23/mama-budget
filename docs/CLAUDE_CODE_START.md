# Claude Code: the prompts, in order

Open Claude Code in `~/Desktop/Mama Budget`. It reads CLAUDE.md on its own. Paste one prompt at a time, in this order. Each one says what done looks like; do not paste the next until the current one's checks pass. Keep the prompts short and let the docs carry the detail; that is what they are for.

If it starts inventing structure that is not in ARCHITECTURE.md, stop it and paste: "Follow docs/ARCHITECTURE.md exactly. Do not add folders, frameworks or abstractions it does not name."

---

## 0. Orientation (read only, no code)

```
Read CLAUDE.md, docs/PLAN.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/ONBOARDING.md and docs/BUILD_PLAN.md. Then look at design/screens/README.md and open 01, 06, 10, 12, 13 and 20 as PNGs.

Do not write code yet. Tell me in ten lines or fewer: what the product does in one sentence, the four cart readers in order, what the judge never does, what the envelope is, and the one thing you are unsure about after reading. Then stop.
```

Done when: its one sentence matches the aim in PLAN.md (stop people wasting money at the moment it happens, by giving them someone who cares enough to say something), it names the weekly envelope, and it says the model never decides need or want. If any of those are wrong, fix its understanding before anything else.

## 1. Scaffold

```
Scaffold the monorepo from docs/ARCHITECTURE.md: npm workspaces at the root, apps/extension with WXT and TypeScript (no UI framework), apps/api with Hono on Node 24, packages/shared, packages/scoring, packages/store. Move the existing api/ code into apps/api/src keeping it working, and the existing data/ and design/ folders where they are. Root scripts: dev (extension and api together), test, typecheck, score. .gitignore must cover .env, .output, node_modules and .cache. Do not install anything that ARCHITECTURE.md does not name.

Done when npm install, npm run typecheck and npm test all pass, and npm run dev opens Chrome with the extension loaded and the api answering GET /health.
```

## 2. Readers

```
Build the cart readers from the "Reading any cart" section of docs/ARCHITECTURE.md. All four return the same CartRead shape with a source and confidence. Order: platform JSON (Shopify /cart.js, WooCommerce, BigCommerce, same origin fetch from the content script), site adapters through one generic runAdapter(spec) with hand written specs for Amazon and Target, JSON-LD Product on product pages, and cart text to POST /extract through the worker. Amazon must read only the active cart, never Saved for later or Buy it again. Parse currency symbols and codes into packages/shared/currency.ts with a fixed table and toUSD.

I will give you the live selectors: [paste the Amazon and Target selectors you found in DevTools here]. Save the cart HTML I give you under apps/extension/fixtures/carts/ and write a node:test per reader against it.

Done when `npm test` runs the reader tests green and, with the extension loaded, the console on amazon.com/cart, target.com/cart and gymshark.com/cart prints the right items and prices.
```

## 3. Detector and the spine

```
Build lib/detect.ts and content.ts from ARCHITECTURE.md. detect.ts runs on <all_urls>, under 5ms, no DOM writes, no imports; it wakes on an add to cart click or on a cart or checkout page by two signals, and recognises order confirmation pages. The UI loads by dynamic import only after it fires. One host on documentElement with an open shadow root and all: initial. Badge with the gele meter from design/screens/10 and 11 (64px, gold ring, meter bar). MutationObserver with hash bail and a diff: new items judged, removed items trigger Proud once, quantity changes re judge that item only. Ask queue: one card at a time, three per session. Cross tab dedupe through storage.session. All API calls through the service worker with typed messages in packages/shared/messages.ts; listeners at top level, never async.

Wire /judge in the api to packages/scoring rules v2 with memory, loudness and now passed in. Write the detector tests: ten shopping pages wake her, ten non shopping pages (Gmail, YouTube, Wikipedia, a news site, a bank) do not.

Done when: on amazon.com, rice and dish soap in the cart show a calm badge and nothing else; AirPods added show the Ask card; on gymshark.com she appears with the right item from /cart.js; on gmail.com nothing loads at all (check the Performance tab).
```

## 4. The card, the voice, the ledger

```
Build the card states from design/screens/12 to 15 and 16 to 19 (Nana), lifting the HTML and CSS next to each PNG. Ask with two buttons: "It's for something" writes need to memory and closes; "I just want them" writes want and triggers the reaction: badge shake (skipped under prefers-reduced-motion), face Shocked, line, then the Shocked card with "You're right, Mama" and "Buy anyway". Buy anyway closes and marks decided; it never clicks a store button. Card is a role=dialog, focus moves in and back, buttons Tab reachable, the line in aria-live polite. Silent failure: two failed API calls in a row and the badge hides.

Api: /tts with ElevenLabs cached by text hash to .cache, 204 on failure; the offscreen document plays the mp3 and the six cue sounds (arrive, ask, surprised, proud, text received, kept) from public/sounds; /buy, /transfer, /deposit idempotent by requestId posting to Nessie through api/nessie/client.js; GET /week and GET /month from client.js week() and month(). Confirmation page detection posts /buy with the order id.

Done when the full cart demo runs on amazon.com with her voice on Shocked, and a $0.50 test order on the Shopify dev store moves the meter from the confirmation page.
```

## 5. Onboarding, home, settings

```
Build the popup from design/screens/02 to 09 and the practice tab from 01, following docs/ONBOARDING.md line by line: what she says, what happens, which sound, what skip does. She speaks, she never listens. Every action is real: 05 reads /month live and ticks rows as counts arrive (minimum 2.5s, maximum 6s), 06 plays the true line as her first spoken words, 07 sends a real text through /schedule?now=1 or the button is disabled with "Texts are off right now", 09 counts Kept up from 0, 01 adds the AirPods itself 1.5s after load and draws the dotted line to the badge. Mute top right from 04 on, remembered in settings.sounds. Then the home panel (Kept this week as the hero in tabular digits, the meter, the last three things she said) and settings (grandma, loudness, weekly envelope, quiet hours, sounds, pause on this site, panic hide) from DESIGN.md rules; there is no PNG for those two.

Done when a fresh install runs the whole onboarding with voice, the phone buzzes before it ends, and the practice cart asks about the AirPods and remembers the answer in the home panel.
```

## 6. Messages

```
Build apps/imessage from ARCHITECTURE.md: the Photon imessage kit as a dumb pipe. Inbound DM to POST /inbound, reply back. node-cron pulls GET /schedule for the Sunday 7pm statement and the month end summary. /inbound handles "how much do I have left" (whatsLeft from the writer), "move 40 to savings" (/deposit), "send 50 home" (/transfer), and answers anything else in one line in character. /buy fires one event text on Gele down. Dedupe inbound by message id, rate limit outbound to one per contact per few minutes.

Done when I text her "how much do I have left" and she answers with this week's numbers, and a Gele down purchase buzzes the phone.
```

## 7. Learner

```
Build /learn and /adapters from the "Learned" paragraph of ARCHITECTURE.md. First visit to an unknown store, the text reader answers and the worker sends a trimmed DOM outline of the cart region (capped 8k) to /learn once; the model returns an AdapterSpec under a JSON schema, validated with zod; the content script runs it against the same page and saves it to storage.local.adapters[host] only if it reproduces the text reader's items within a dollar, then pushes it to /adapters. GET /adapters on startup pulls shared specs. A spec that fails validation is dropped and relearned.

Done when the second visit to bestbuy.com/cart is instant with no model call, and the learned spec shows up in GET /adapters.
```

## 8. Score, tests, README

```
Wire packages/scoring: rules v1 frozen (it must keep producing the 50 case score), rules v2 ask and remember, the 50 cases, the labels, the merchant baseline. npm run score prints Mama vs bank map vs raters with honest denominators, need safety breaches, and the split count. README with the four MHacks criteria as headings (Innovation, Technical Complexity, Usability, Adherence to Theme), the paragraph on what the model does and does not do, the seven Nessie resources, the <all_urls> justification, how to run, how to load the zip, and the honesty lines (two retailers hand written, simulated bank, one envelope, on purpose).

Done when npm test is green across rules, detector, readers, currency and storeKey, and npm run score output is pasted into docs/RESULTS.md.
```

## 9. DEMO_MODE and hardening

```
DEMO_MODE=1 in the api serves recorded fixtures for /extract, /judge lines and /tts by nearest text hash, while the page stays live. Kill switches from ARCHITECTURE.md: fall back to fixtures after two provider failures, chrome.tts.speak if /tts fails, last good extraction from session storage if /extract fails, selector fast path if the model is down, panic flag hides the widget. /health reports per provider.

Done when I turn off the api's internet and the full Amazon demo still runs with voice.
```

---

## After every block

Paste the review prompt from docs/REVIEW.md. It changes nothing; it checks the build against everything we decided and ranks what a judge would see first. Fix the top three fails before the next build prompt.

## Prompts you will paste when things break

- "Read docs/DESIGN.md again. Cream ground, ink buttons, color only on her. No gradients, no emoji icons, no uniform radius: 8 inputs, 12 lists, pill buttons. Fix the card to match screen 13 exactly."
- "The judge decided something. It must not. The model only extracts items and writes lines. Move the decision back into packages/scoring rules and add a test that fails if the model's output changes the verdict."
- "You cached a DOM node across observer ticks. Re query on every tick. Amazon rerenders the cart."
- "Her line has a dash in it. No dashes anywhere in copy. Rephrase."
- "She said something she did not do. Remove the fake state. If the text did not send, the button is disabled with 'Texts are off right now.'"
- "Nothing may run on <all_urls> before detect.ts says yes. Show me the Performance tab on gmail.com with zero extension work."
