# Mama Budget: build guide for Claude Code

Read docs/PLAN.md (what we are building and why), docs/DESIGN.md (every size, color and rule), docs/ARCHITECTURE.md (how the code is laid out and why), docs/ONBOARDING.md (what she says and does on every onboarding screen) before touching anything. The screens are in design/screens: numbered PNGs are the source of truth for how every state looks, the HTML next to each is the exact markup and CSS to lift.

## Stack
WXT (Manifest V3, TypeScript) for the extension. Hono on Node 24 for the API. node:test for tests. npm workspaces. No other frameworks without saying why.

## Commands
- `npm run dev` runs the extension and the api together. There is no fake shop. Test on amazon.com, target.com and one Shopify store (gymshark.com), logged in, with saved carts.
- `npm test` runs the rules engine tests. `npm run test:update` regenerates goldens (review the diff).
- `npm run typecheck`.
- Load unpacked from `apps/extension/.output/chrome-mv3`. After reloading the extension, hard refresh the Amazon tab (old content scripts are orphaned).

## Architecture rules
- The service worker is stateless. Every piece of state lives in `chrome.storage` through `packages/store`. Globals die after 30 seconds.
- Every `chrome.*.addListener` is at top level, synchronous. Never inside async code or a conditional.
- All calls to our API go through the service worker. The only fetch a content script makes is to the page's own origin for platform cart JSON.
- All messages are typed in `packages/shared/messages.ts`. Add the case to the union before writing the handler. `onMessage` listeners are never `async`: return true and call `sendResponse`.
- The content script matches `<all_urls>` but `lib/detect.ts` is the gate: under 5ms, no DOM writes, no imports. The UI and readers load by dynamic `import()` only after it fires (add to cart click, or cart/checkout page by two signals).
- Readers in `lib/readers/` all return `CartRead` and are tried in order: platform JSON (Shopify `/cart.js`, WooCommerce, BigCommerce, same origin fetch from the content script is allowed), site adapters (one generic `runAdapter(spec)` over `AdapterSpec`; Amazon and Target hand written, every other store learned once via `/learn` from a DOM outline, validated against the text read, saved per host and shared through `/adapters`), JSON-LD Product on product pages, cart text to `/extract` through the worker. The judge never knows which reader fired. Never add an adapter when fixing the detector or the text reader would do.
- Never cache nodes, re query on every observer tick.
- "Buy anyway" never clicks the store's own buttons. The ledger moves when `detect.ts` sees a real order confirmation page and `/buy` is posted with the order id as `requestId`. Fallback behind `ledgerOnConfirm=false`: post on Buy anyway.
- Item memory is keyed by normalised name so a want admitted on one store is remembered on every store.
- The content script owns exactly one host element on `document.documentElement` with an open shadow root and `all: initial`. It never mutates the host page's DOM. It never caches DOM references across MutationObserver ticks.
- Audio plays from the offscreen document (`offscreen` permission, reason AUDIO_PLAYBACK). Content script `Audio` is a flagged fallback only.
- The judge is a pure function in `packages/scoring`. Same input, same output. Rules are JSON, versioned (`rules/v1.json` frozen for the 50 case score, `rules/v2.json` is ask and remember). A rule change bumps the version and reruns goldens.
- The model lives in one file, `api/lines/model.js`, and does four things: turns cart text into items (JSON schema), says whether an unknown item is an obvious necessity from the item and the store, reads what a typed reason means, and writes her lines from the whole situation. The rules keep the promises and the math and are the fallback when the model is off or slow: money to family never scolded, a first sighting only asked, she reacts only to admitted wants, planned items never scolded, the week's numbers decide the volume. Rules v1 stays frozen for the 50 case score.
- Secrets live only in `apps/api/.env`. The extension bundle is public.
- Every mutating API call carries a client `requestId` and is idempotent.
- `DEMO_MODE=1` serves recorded fixtures for extraction, scoring and TTS. The demo must run with WiFi off.

## Product rules (do not break these in code)
- Need never opens the card. Protected items (rules PROTECTED list) and money to family never react.
- A new item above $15 gets one neutral Ask: Watching face, meter still, no voice. Two answers: "It's for something" (remembered as need forever) and "I just want them" (remembered as want; she may now react).
- She only scolds wants the user admitted, or remembered wants. Never a first sighting.
- The envelope decides volume: a want that fits gets a nod, a want that blows the week gets Gele down. The envelope is weekly, Monday to Sunday, closed by the Sunday 7pm statement.
- Max one reaction per item, three asks per session, one card at a time (queue the rest), quiet 11pm to 7am is opt in for the hackathon (settings.quietHours, PHOTON_QUIET=1; the product default once shipped). Buy anyway always works. Nothing is ever blocked. No store button is ever clicked by us.
- `week.spent` is want tagged purchases this week only. Needs never move the meter. `month()` is the 30 day read used once, in onboarding.
- Loudness scales thresholds in the judge (1.0, 0.6, 0.3). Same three tiers for every grandma under her own names. The family (mama, nana, abuela, wong) is a registry: a brief in `api/lines/character.js`, a bank of lines in writer.js and texts.js under the same keys, a voice id `ELEVEN_VOICE_ID_<WHO>`, five faces, a tile. Lines come from documented speech, never improvised.
- Store currency first, USD after, from `packages/shared/currency.ts`. Mama adds naira unless the store is already in naira.
- If the API fails twice in a row the badge hides. Never show an error on a store page. The page must behave as if she was never installed.
- Amazon adapter reads the active cart only. Saved for later, Buy it again and recommendations are never items.
- Every loud line names the amount and the item. Nothing about the person. One cultural marker per line at most. Lines live in `apps/api/src/lines/`.
- Mama gets the naira line. Nana does not.
- Onboarding asks two questions (grandma, loudness) and reads everything else from the ledger. Never ask the name; Nessie has it, use it once on "Here is what I saw." Never introduce her twice. Never show a sent or done state that did not happen. Every step after grandma has a one line skip that never argues.
- Six sounds, each under 1.2s: arrive, ask, surprised, proud, text received, kept ticked. Synthesised in the offscreen document. One toggle. None in quiet hours when quiet hours are on. No music.

## Design rules (from docs/DESIGN.md, the short version)
Popup 400 by 560. Card 360 wide, 20px from bottom and right. Badge 64 circle, gold ring, gele meter bar on the left. Cream ground, ink buttons, color only on her. System font for UI, Bricolage Grotesque 800 for headlines only. Radius 8 inputs, 12 lists, pill buttons. Tabular digits on money. Sentence case. One primary button per screen. Motion 150 to 300ms, decelerate in, accelerate out, no bounce, only on user action or mood change. She is never on the bank screen.

## Do not
No `innerHTML` with page data. No `async` message listeners. No listeners inside async code. No cross origin fetch from content scripts. No `setTimeout` over 30 seconds in the worker (use alarms). Nothing runs on `<all_urls>` before `detect.ts` says yes. No secrets outside the api. No new dependencies without a reason in the commit. No editing fixtures to make tests pass. No emoji as icons. No gradients. No dashes in any copy.

## Verify
- After each block in docs/BUILD_PLAN.md, run the review in docs/REVIEW.md (review only, no changes) and fix the top ranked fails first.
After any change in `packages/scoring`: `npm test`. After any change in `apps/extension`: `npm run typecheck`, reload the extension, refresh amazon.com/cart, add rice then AirPods and confirm: rice quiet, AirPods asks, "I just want them" reacts. Then open gymshark.com, add anything, confirm she appears with the right item and price from `/cart.js`. Then a test order on the dev store moves the Nessie meter from the confirmation page.
