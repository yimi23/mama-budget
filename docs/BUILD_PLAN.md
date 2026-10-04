# Build plan: Saturday 7:50pm to Sunday 12:00pm

Two people. Sixteen hours. Started 80 minutes behind the first draft, so the first two blocks are compressed and the sleep block is not. Submission on Devpost by 12:00pm, hard stop 12:15pm EDT.

## What has to be true at 11:30am Sunday

0. The aim shows in the first 20 seconds of the demo without anyone explaining it. Setup knows you (she reads the month, says one true thing, and names three things she will watch), the phone buzzes with her first statement before onboarding ends, and the hero number is Kept this week, not spent. If a judge walks away saying "it reads carts," we built the wrong thing.
1. A judge opens amazon.com, adds rice and dish soap, nothing happens. Adds AirPods and Mama asks, inside Amazon's own cart page. Taps "I just want them" and she reacts, out loud. Then the judge names any store. You open it, add something, she is there. Shopify stores work with zero custom code, that is the beat that wins Innovation. A test order on a store we control fires a real confirmation page, the purchase posts to Nessie, the meter moves, the iPhone buzzes. Text her "how much do I have left" and she answers. Live sites, first try.
2. The Devpost page is written for the four criteria and names the theme line: she grows with you.
3. The repo has a README that runs, tests that pass, the 50 case score, and the protocol.
4. Every sponsor prize has its proof: Nessie resources named, Photon two way shown, ElevenLabs voice heard, Figma file linked, .tech live, Notability screenshots attached.

Everything else is a bonus. There is no fake store. If the reader does not work on a real site, nothing else matters.

## Every use case, and where it is handled

| Situation | What she does | Where |
|---|---|---|
| Install, first run | Popup onboarding in the new order: she arrives, grandma (Hear her), connect bank, she reads your month, one true line plus proposed weekly envelope, three watches, phone, first statement arrives, loudness, Kept this week. Practice cart is the finale and ends with "Open a real store." | Onboarding block, screens 01 to 09, docs/research_clicky_onboarding.md |
| Product page, add to cart or buy now clicked | Reads JSON-LD, asks right there if the item is new and over $15 | `readers/jsonld.ts`, click hook |
| Cart page, protected item (rice, soap, textbook, medicine, money to family) | Nothing. Badge calm. Never moves the meter. | rules PROTECTED, `spent` counts wants only |
| Cart page, unknown item over $15 | One neutral Ask, two buttons, remembered forever | rules v2 |
| Cart page, unknown item under $15 | Nothing, or a small nod if it is a repeat | rules v2 |
| Three new items at once | One card at a time, queue the rest, max three asks per session, rest stay silent until next session | ask queue in content script |
| Admitted want that fits the envelope | Nod | rules v2, envelope |
| Admitted want that blows the envelope | Shocked, voice, line names amount and item | rules v2, `/tts` |
| Same want bought again this week | Line notes the repeat, count comes from the ledger | memory count + Nessie purchases |
| Buy anyway | Card closes, item marked decided, nothing blocked, no store button touched | card |
| Item removed from cart | Proud bubble, once | observer diff |
| Quantity changed | Re read, re judge the delta only | observer, hash |
| Real order placed | Confirmation page detected, `/buy` posted with order id, meter moves, text if Gele down | `detect.ts` confirm, `/buy` idempotent |
| Shopify checkout on another origin | Last cart kept per store (eTLD+1) for 30 minutes, confirmation matched to it | `storage.session.lastCart[store]` |
| Amazon "Saved for later", "Buy it again", recommendations | Ignored. Adapter scopes to the active cart container only | `readers/sites/amazon.ts` |
| Store in naira, pounds, euros | Currency symbol parsed, converted with a fixed table in `packages/shared/currency.ts`, line shows the store currency and the USD, Mama adds naira | readers, line writer |
| Store nobody has seen | Text reader answers now, learner writes the adapter in the background, shared through `/adapters` | layers 4 and 2b |
| Shopify, WooCommerce, BigCommerce store | Platform JSON, instant | layer 1 |
| Quiet hours 11pm to 7am | Asks still happen silently as badge state, no card, no voice | flags, judge `now` injected |
| Loudness tier | Scales the ask line and the envelope thresholds: Full Nigerian Mother 1.0, Church Friend 0.6, Mama 0.3. Same numbers for Nana's three names | judge `loudness` param |
| Pause on this site, panic hide | Popup toggle writes `paused[host]`, badge gone on that host; `panic` hides everywhere | settings, flags |
| Two tabs with carts | Reactions deduped by item across tabs through `storage.session` | content script |
| Week rollover | Alarm Monday 00:05 resets the envelope, memory persists; the Sunday 7pm statement closes the week. Month end sends a summary | `chrome.alarms`, `/schedule` |
| API unreachable | After two failed calls the badge hides. She never breaks the shopping page. No error UI on the store. | worker retry, silent failure rule |
| Model or Nessie down during judging | `DEMO_MODE` fixtures answer for the API, page stays live | fixtures |
| Keyboard and screen reader | Card is focusable, buttons reachable by Tab, `aria-live="polite"` on the line, `prefers-reduced-motion` respected | card |
| Text her anything | Answers from the same `/month` the card uses, "send 50 home" and "move 40 to savings" act on Nessie, anything else gets a one line in character answer | `/inbound` |
| Sunday 7pm and month end | Statement text, weekly and monthly, `/schedule?now=1` fires it on demand for the demo | `/schedule`, cron on the Mac |

## Every tool, how we use it, what wins the prize

| Tool | How we use it | What "done well" looks like to that judge | Proof on Devpost |
|---|---|---|---|
| Capital One Nessie | Simulated bank. Seed a student with a month of history, checking and savings, a rent bill due in 4 days, a family payee, merchants. Purchases post on real confirmation. Transfers on "send home." Deposits on "save." Bills feed "rent in 4 days." Spent is this week's want tagged purchases, recomputed every call. | Many resources used for a real reason, not a token call. Customers, accounts, purchases, deposits, transfers, bills, merchants: seven. The budget math reads from the ledger every time. | "Seven Nessie resources" with one line each on what they do. Screenshot of the seeded account. |
| Photon iMessage kit | Her second home. Event text on Gele down. Sunday 7pm statement. Two way: "how much do I have left" answered from the same month function the card uses. Actions by text: "move $40 to savings," "send 50 home." | An agent, not a notification. Present in the conversation, answers, acts. Their words: "attuned to context, trusted to act with taste." | 30 second clip of the two way exchange. The schedule code. |
| ElevenLabs | Her voice on Shocked and Gele down only. One warm older female voice per grandma. Cached mp3 per line so the demo never waits. | Their own rubric: working prototype, real world impact, conversational agent focus. Voice that sounds like a person, used sparingly. | The voice in the demo video. Note that she speaks only when it matters. |
| Claude API | Three jobs, one file. Extract items from cart text into JSON (structured output). Write her line from a verdict, in character, under the anti cringe rules. Learn an adapter from a DOM outline, once per new store. Never decides need or want. | Judges in 2026 punish "the model decides everything." Our split is the technical story. | One paragraph in the README: what the model does and does not do. |
| WXT + TypeScript | The extension. `<all_urls>` with a 5ms detector gate, lazy loaded UI, one shadow root host, service worker for our API, offscreen doc for audio and the six cue sounds, popup for onboarding and home. | Technical complexity: MV3 done right, service worker lifecycle handled, permission justified. | Architecture section in README, link to ARCHITECTURE.md. |
| Hono on Node | The API that holds every key. Idempotent writes, fixture fallback, health endpoint, adapter registry. | Reliability. The API degrades, never dies. | `/health` screenshot, DEMO_MODE explained. |
| The 50 case harness | node:test, frozen cases, frozen rules v1, mothers' labels, merchant baseline. Plus detector tests (shopping and non shopping pages) and reader tests on saved real cart HTML. One command prints the score. | Judged by an LLM reads this. Real tests, real numbers, honest denominators. | `npm run score` output pasted on Devpost. |
| Cart readers | Four layers, first hit wins: platform JSON, site adapters (Amazon and Target hand written, every other store learned once and shared), product JSON-LD on add to cart, cart text to the model. Purchases recorded from real confirmation pages. | She works on any store, and gets faster on each one she has seen. Judges pick the site. | Video shows Amazon, Target and a store the judge names. README lists the layers. |
| Figma | Rebuild the faces and the six cart states from design/screens as a Figma file, two hours max, or skip. | Best Design judges want a Figma file, not PNGs. | Figma link. |
| The site | design/screens 20 to 27 lifted to one static page, deployed to Vercel, privacy section included because `<all_urls>` needs one. | Real world use: a product page that exists. | mamabudget.com live. |
| .tech domain | mamabudget.tech pointing at the same site. | Registered and used during the hackathon. | Both URLs on Devpost. |
| Notability | Two sketch screenshots of the early plan plus a note. | Two screenshots and a sentence. | Attach to Devpost. |
| Design screens | design/screens, 27 states, lifted as HTML and CSS. Home panel, settings and paused state are built straight from DESIGN.md rules. | Usability: the card looks like the screens. | Screenshots on Devpost. |

## The split

Praise: everything people see. Extension (detector, readers, Amazon and Target adapters, badge, card, popup onboarding, home, settings, faces, animation), her lines and voice, mothers' labels, the site, Figma, Devpost page, video, pitch.

Ugonna: everything underneath. API (`/extract`, `/judge`, `/learn`, `/adapters`, `/buy`, `/transfer`, `/deposit`, `/month`, `/inbound`, `/schedule`, `/tts`, `/health`), Nessie seed and client, Shopify dev store, Photon process on the demo Mac, statements and two way, scoring harness, tests, README, DNS for both domains, DEMO_MODE fixtures, second laptop mirror.

If the brief's split (Ugonna on design, Praise on code) is what you two agreed, swap the two columns. The blocks below do not change.

## Hour by hour

**7:50pm to 9:00pm. Set up and read real carts.**
Both: `npx wxt@latest init` into apps/extension, Hono into apps/api, workspaces root, `.gitignore` with `.env` and `.output` before the first commit, `npm run dev` runs both. First commit after the opening ceremony timestamp.
Praise: `readers/platform.ts` first, the cheapest win: on allbirds.com add anything (gymshark.com is headless, /cart.js 404s), `fetch('/cart.js')` from the console, confirm the JSON, write the reader. Then Amazon cart in DevTools: the active cart container (not Saved for later), item row, title, price, quantity, subtotal, `readers/sites/amazon.ts` logging `{items, subtotal}`. Then Target. Save the cart HTML of each as a reader fixture and the `innerText` as an extract fixture. Note the confirmation page URL shape on all three. Turn off Amazon 1-Click on the demo account and remove the default card.
Ugonna: Nessie key, hit customers and accounts, confirm bills and transfers endpoint paths. Photon kit installed on the demo Mac, Full Disk Access, spare Apple ID signed in, one test send to the demo iPhone. Create the free Shopify dev store with one $0.50 product.
Checkpoint 9:00: the console prints the right items and prices on a Shopify store and on amazon.com. If not, Praise stays on it and Ugonna takes the badge mount.
Cut line: if Photon does not send a test message by 9:30, Photon becomes stretch and the demo's beat 3 is the card only.

**9:00pm to 10:30pm. The spine.**
Ugonna: seed script is written (`api/nessie/seed.js`): 30 days of history, $50 of a $75 weekly envelope this week, food delivery heavy, rice, a transfer home, $40 to savings this week, rent in 4 days, eleven merchants. `GET /week` returns budget, spent (wants only), left, kept, ratio, bills due, mood, daysLeft. `GET /month` returns the 30 day read: trueLine, watches (top three want merchants), proposedEnvelope. Both already in `nessie/client.js`; wire them into Hono. `/judge` wired to rules v2 with memory, loudness and `now` passed in. `/buy` posting to Nessie with tag need or want and recomputing. `/extract` under a JSON schema, cached by hash. Fixtures recorded for the three carts.
Praise: `detect.ts` gate on `<all_urls>` (two signals, confirmation pages too), lazy import of the UI, shadow host, badge with the meter bar, MutationObserver with hash bail, readers in order, currency parse, `/judge` through the worker, face swap by mood, ask queue (one card, three per session), cross tab dedupe. Add to cart click hook reading JSON-LD on the product page. Logged in Amazon account with a saved cart.
Checkpoint 10:30: rice quiet, AirPods asks, on amazon.com, and she appears on a Shopify store nobody wrote code for. If not, nobody touches anything else until it does.

**10:30pm to 12:00am. The card, the voice, the ledger.**
Praise: the card. Ask state with two buttons, focusable, Tab reachable, `aria-live`. "It's for something" writes memory and closes. "I just want them" writes memory and triggers the reaction: badge shake (skipped under reduced motion), face to Shocked, line, then the Shocked card with "You're right, Mama" and "Buy anyway." Buy anyway closes the card and marks the item decided. Proud bubble when the item leaves the cart. Silent failure: two failed API calls and the badge hides.
Ugonna: `/learn` and `/adapters` (model with JSON schema, zod validated, JSON file store). ElevenLabs route with cache, offscreen document playing the mp3. `/transfer` and `/deposit`. "rent in 4 days" in the sub line. `/health`. Confirmation page on the dev store firing `/buy` with the order id. `chrome.alarms` for the Monday week rollover and the statement check.
Checkpoint 12:00: full demo on amazon.com with voice, plus a real $0.50 order on the dev store moving the Nessie meter from the confirmation page.

**12:00am to 1:30am. Messages and the popup.**
Ugonna: Photon process: inbound to `/inbound`, reply back, "how much do I have left," "move 40 to savings," "send 50 home" handled, anything else answered in one line in character, event text fired from `/buy` on Gele down, Sunday statement on cron from `/schedule`, `/schedule?now=1` for the demo.
Praise: onboarding popup from screens 02 to 09 in order: welcome with the arrival animation and sound, grandma with Hear her (two cached mp3s from `/tts`), connect bank, she reads your month live from `/month`, here is what I saw with `trueLine` and `proposedEnvelope` (her first spoken line, one cached mp3 played on arrival), here is what I'll watch from `watches`, phone, check your phone (real text via `/schedule?now=1`, button disabled with "Texts are off right now" if Photon is down), how loud, go shopping with Kept this week, then the practice tab (screen 01) as the finale. Home panel with Kept this week as the hero, meter, last three lines. Settings (pause on this site, quiet hours, envelope, grandma, loudness, sounds). Six cue sounds under 1.2s each in `public/sounds/`, played from the offscreen document.
Checkpoint 1:30: text her, she answers. The dev store order buzzes the phone.

**1:30am to 3:00am. Score, README, site, Devpost draft.**
Ugonna: third rater's labels in if they arrived, `npm run score` prints the final numbers, detector tests (ten shopping URLs and page texts true, ten non shopping false: Gmail, YouTube, the CMU portal, Wikipedia), reader tests against the saved cart HTML, README with the four criteria as headings, the model split paragraph, seven Nessie resources, the `<all_urls>` justification, how to run, how to load the zip, the honesty lines. RESULTS.md final.
Praise: the site from screens 20 to 27 as one static page with a privacy section, deployed to Vercel. Devpost draft in the README's structure. Score slide drawn.
Both: sleep 3:00 to 6:30. Not optional. Judges can tell.

**6:30am to 8:30am. Target, learner, Figma, mirror.**
Praise: Target adapter finished and verified (Target rerenders the cart on quantity change, re query everything). Then `/learn` on three stores that are not Shopify (Best Buy, Zara, Jumia in naira); second visit to each must be instant from the learned adapter and the naira line must read right. Whatever breaks gets fixed in the detector or the learner, never with a hand written adapter. If Target is not clean by 8:00 it falls through to the text reader and nobody mentions it. Then Figma: faces and the six cart states, two hours cap.
Ugonna: DEMO_MODE end to end (API answers from fixtures if the model or Nessie is down, page stays live). Kill switches. DNS: mamabudget.com and mamabudget.tech both at the Vercel site, confirmed on a phone off WiFi. Notability screenshots. Second laptop: clone, `.env`, build, extension loaded, Amazon logged in. Hotspot tested.

**8:30am to 10:30am. Rehearse, then record.**
Run the demo ten times, different person drives each time, time it. Script the first sentence and the last. Fix only what breaks. Nothing new after 9:30. At 9:30 record the video: 60 to 90 seconds, phone camera on the laptop and the iPhone, no voiceover, her voice is the audio, Amazon then Target then a store the camera operator names.

**10:30am to 11:30am. Submit.**
Devpost: team members added, title, tagline (She grows with you), description, video, public repo with the built zip in Releases, both domains, Figma, Notability, every track and sponsor prize ticked. Submit at 11:30, not 12:00. Open it logged out on a phone.

**11:30am to 12:00pm.** Charge laptops and phones. iPhone off Do Not Disturb, volume up. Open the tabs. Breathe.

## Cut lines, decided now so nobody argues at 4am

- Amazon adapter not clean by 10:30pm: it falls through to the text reader. Slower, survives any markup. Demo keeps going.
- Shopify `/cart.js` blocked on a store (some themes proxy it): text reader catches it. Pick a demo store where it works and know it beforehand.
- Confirmation page detection flaky: "Buy anyway" posts to `/buy` directly as the fallback, behind `ledgerOnConfirm=false`.
- `/learn` not reliable by 8:00am: unknown stores stay on the text reader, the learner is "in progress" in the README, the pitch line about growth is cut to the memory story.
- Photon fails by 9:30pm: texts become a slide, card carries the demo.
- Target reader not working by 8:00am: Amazon is the demo, Target is a README line.
- ElevenLabs flaky: text lines only, "and she speaks" becomes "and in the full version she speaks."
- Nessie down at demo time: cache answers, nobody notices, say "simulated bank" as planned.
- Third rater's labels not in by 1:30am: publish with two raters, say two on Devpost, never pad with the synthetic panel.
- Venue WiFi blocks Amazon or Target: phone hotspot. Tested Saturday night.
- Behind at 12:00am checkpoint: cut onboarding to grandma, bank, here is what I saw (spoken), loud, go. Cut settings to pause only. Keep the practice cart.
- Behind at 1:30am: cut Sunday statement, keep two way. Cut Figma before cutting the site.
- Nana: static faces on the pick screen only. Never animated. Not negotiable.

## The pitch, 90 seconds

Open: "Budget apps tell you after the money is gone. We built someone who says something before." Install in front of them: she reads the month, says the one true line, the phone buzzes. Twenty seconds. Then: "Now name a store." Open whatever they say. Hand the judge the laptop. Beats 1 to 5 from DEMO.md, judge drives, you narrate only the rule being shown. Close on the score slide, say the real numbers, then: "She protects the obvious, asks about the rest, and remembers. She grows with you." Ten seconds on growth: every store one person shops at, she learns and shares, so she gets faster for everyone. Twenty seconds on real world use: international students who send money home, free with a Sunday statement, $2.99 a month (about N4,800) for voice and texts, and she is already headed into a remittance product on WhatsApp. Then stop talking.

Admit one limit before they ask: a simulated bank, one envelope, and on stores she has never seen the model reads the cart, so she asks rather than scolds. On purpose.

## Submission checklist

- [ ] Devpost: team members, four criteria as headings, theme line, named user, quantified score, admitted limit
- [ ] Onboarding in the video: she reads the month, the true line, the three watches, the phone buzzes. Twenty seconds.
- [ ] Video 60 to 90 seconds, shot on amazon.com, target.com and a store nobody wrote code for, her voice audible, phone buzz visible
- [ ] Repo public, `.env` never committed, README runs, `npm test` green (rules, detector, readers), `npm run score` output pasted, built zip in Releases
- [ ] data/ has cases, labels, protocol, synthetic quarantined with its methodology
- [ ] Seven Nessie resources listed
- [ ] Photon two way clip
- [ ] ElevenLabs voice credited
- [ ] Figma link, mamabudget.com and mamabudget.tech live with the privacy section, Notability screenshots
- [ ] Tracks ticked: FinTech, Useless AI, Dumbest Idea, Judged by an LLM, Nessie, Photon, ElevenLabs, Figma, .tech, Notability
- [ ] Second laptop runs the demo
- [ ] Submitted by 11:30am
