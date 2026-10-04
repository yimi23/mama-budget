# Architecture

Built from Chrome's MV3 docs, WXT, Hono, Photon's imessage kit docs and 2026 extension build writeups. Each section says what and why. Unverified items are marked.

## Repo layout (npm workspaces)

```
mama-budget/
  package.json            workspaces, dev = concurrently ext + api
  tsconfig.base.json
  CLAUDE.md
  apps/
    extension/            WXT, Manifest V3
      wxt.config.ts
      entrypoints/
        background.ts     service worker: alarms, fetch proxy, offscreen management, memory
        content.ts        detect gate, then lazy loads readers + shadow root UI (badge, card)
        offscreen/        audio playback
        popup/            onboarding and home panel (400 by 560)
      components/         badge, card, meter, faces
      lib/                dom.ts, observer.ts, audio.ts, flags.ts, sites/
      public/             icons 16 32 48 128, face SVGs
    api/                  Hono on Node 24
      src/index.ts, config.ts
      src/routes/         extract, judge, buy, transfer, deposit, month, inbound, schedule, tts, health
      src/providers/      anthropic.ts, elevenlabs.ts, nessie.ts, fixtures.ts
      src/lines/          mama.ts, nana.ts, statements.ts
      fixtures/           recorded cart texts, extractions, verdicts, mp3s
      .cache/
    imessage/             Photon imessage kit + node-cron, runs on the demo Mac only
  packages/
    shared/               types, messages.ts, zod schemas, flags defaults
    scoring/              judge (pure), rules/v1.json, rules/v2.json, tests, goldens
    store/                storage adapters: chrome.storage wrapper, JSON file for api
  data/                   the 50 cases, labels, protocol, synthetic (quarantined)
  design/                 concept sheets, screens (PNG + HTML per state), DESIGN.md
  docs/                   PLAN, DEMO, RESULTS, this file
```

## The extension (WXT)

Why WXT: file based entrypoints, generated manifest, `npm run dev` opens Chrome with the extension loaded and reloads on change, built in `createShadowRootUi` and `ContentScriptContext` (handles SPA URL changes and orphaned scripts after reload). Plasmo is in maintenance mode. CRXJS is fine if someone already lives in it. Plain Vite costs two hours of manifest wiring.

Service worker (`background.ts`):
- Ephemeral. Chrome kills it after 30 seconds idle. No globals. State in `chrome.storage.local` (durable: memory of answers, settings, month cache) and `chrome.storage.session` (per session: extraction cache by text hash, logs).
- Every listener registered at top level, synchronously.
- Owns all network: content script sends `{type:'CART_READ', items|text}`, worker calls the API, replies. Content scripts cannot escape the page's CORS since Chrome 87.
- `chrome.alarms` for anything scheduled: `week-rollover` Monday 00:05 (new envelope week, memory persists), `statement-check` hourly (asks `/schedule` what is due: Sunday 7pm weekly, month end summary). Recreate alarms on `onInstalled` and `onStartup`.
- Six cue sounds (arrive 1.2s, ask 0.6s, surprised 0.4s, proud 0.9s, text received 0.5s, kept ticked 0.4s) in `public/sounds/`, played through the same offscreen document as the voice. Off in quiet hours and when sounds are off.
- Offscreen document for audio: `chrome.offscreen.createDocument({ reasons: ['AUDIO_PLAYBACK'] })`, check `getContexts` first, one per extension. Worker fetches TTS as ArrayBuffer, posts a data URL, offscreen plays and posts ENDED. Extension origin is not subject to the page's autoplay policy. Content script `Audio` stays behind the `useOffscreenAudio` flag as fallback.

Content script (`content.ts`), matches `<all_urls>`, sleeps until a detector fires:
- The script is two files. `detect.ts` is tiny, runs everywhere, decides in under 5ms whether this page matters. The UI, readers and observer load with a dynamic `import()` only when it does. Nothing visible, nothing heavy, on pages that are not shopping.
- Two moments wake her. **Add to cart**: a click on any button or link whose text matches add to cart, add to bag, add to basket, buy now (case insensitive, any language in `lib/words.ts`). **Cart or checkout**: URL has cart, checkout, bag, basket or order, or the page shows Subtotal or Order total near a Checkout control, or three or more currency amounts in one column. Two signals wake her, one does not.
- One host element on `document.documentElement` (not body, Amazon rerenders it), `position: fixed; z-index: 2147483647; all: initial`, open shadow root, `:host { all: initial; font-size: 16px }`, px units only. System font inside the shadow. `stopPropagation` on key and wheel events inside the widget.
- MutationObserver on body, childList and subtree, debounced 400ms trailing, bail if the cart text hash is unchanged. Re query the DOM every tick, never cache nodes. Read in one pass, write UI in one requestAnimationFrame. Diff against the previous read: new items are judged, removed items trigger Proud once, quantity changes re judge only that item.
- Accessibility: the card is a `role="dialog"` with focus moved to it on open and returned on close, buttons reachable by Tab, the line in an `aria-live="polite"` region, every animation skipped under `prefers-reduced-motion`.
- SPA navigation: `ctx.addEventListener(window, 'wxt:locationchange')`, plus `webNavigation.onHistoryStateUpdated` in the worker.
- After an extension reload, old content scripts are orphaned: check `chrome.runtime?.id` before messaging, wrap in try/catch (`ctx.isValid`).

## Reading any cart (lib/readers)

Readers are tried in order, first one that returns items wins. Every reader returns the same `CartRead { items: {name, qty, unitPrice}[], subtotal, source, confidence }`. The judge never knows which reader fired.

1. **Platform JSON** (`readers/platform.ts`). Same origin fetch from the content script, allowed because it is the page's own origin. Shopify: `GET /cart.js` (detect via `window.Shopify` or `<link href*="cdn.shopify.com">`). WooCommerce: `GET /wp-json/wc/store/v1/cart`. BigCommerce: `GET /api/storefront/carts`. Exact items, exact prices, zero selectors, and Shopify alone is millions of stores. This is the reader that makes "works anywhere" true.
2. **Site adapters** (`readers/sites/`). Selector fast path for sites on their own stack. Two kinds, same shape (`AdapterSpec { host, row, name, price, qty, subtotal }`, run by one generic `runAdapter(spec)`):
   - **Hand written**: Amazon and Target, from DevTools in hour one, because they are the demo and must be instant. Walmart and Best Buy if time.
   - **Learned** (`readers/learned.ts`). First visit to an unknown store, the text reader (layer 4) answers and she appears. In the background the worker sends a trimmed DOM outline of the cart region (tag, classes, data attributes, text, capped at 8k) once to `POST /learn`. The model returns an `AdapterSpec`. The content script runs it against the same page; if it reproduces the text reader's items within a dollar, the spec is saved to `chrome.storage.local.adapters[host]` and pushed to `POST /adapters`. Second visit, zero model calls. A spec that fails validation (markup changed) is dropped, text answers, and she relearns. `GET /adapters` on startup pulls what other users taught her. One shopper on a store teaches her that store for everyone. This is "Build something that grows" in the code.
3. **Structured data** (`readers/jsonld.ts`). On product pages, parse `<script type="application/ld+json">` for `@type: Product` (also `og:price:amount` and `itemprop="price"`). Used by the add to cart moment: the clicked product's name and price are known before the cart updates.
4. **Text to model** (`readers/text.ts`). Walk up from the Subtotal node to the nearest ancestor containing the item list, take its `innerText`, collapse whitespace, cap at 6k chars, hash it, send `{text}` through the worker to `/extract`. The model returns items under a JSON schema. Cached by hash in `storage.session`. Slow (one to two seconds) but survives any markup on any site. This is the floor, never the plan.

Confidence: platform and adapter reads are 1.0; JSON-LD 0.9; text reads carry the model's confidence and she only asks, never scolds, below 0.7.

**Recording a purchase.** Not a button. `detect.ts` also recognises order confirmation pages: URL has thank-you, thankyou, order-confirmation, order-placed or confirmation, or the page shows an order number pattern near "Thank you". On detection the last `CartRead` for that origin (kept in `storage.session`) is posted to `/buy` with the order id as `requestId`, so a refresh never double posts. The Nessie ledger moves from a purchase that happened. "Buy anyway" on the card only closes the card and marks the item as decided; the ledger waits for the real confirmation. Amazon and Target confirmation pages are confirmed in hour one too.

**Ask queue.** One card at a time. New asks queue in `storage.session.queue[tabId]`; the next shows when the current closes. Three asks per session, the rest stay silent and are logged. Reactions are deduped by normalised item name across tabs through `storage.session.reacted`.

**Currency.** Readers return `currency` from the symbol or code (`$ £ € ₦ NGN GBP EUR`). `packages/shared/currency.ts` holds a fixed table (USD base, NGN from `.env`) and `toUSD()`. The envelope is in USD; the line shows the store currency first and the USD after; Mama adds the naira when the store is not already in naira.

**Store identity.** `storeKey(url)` returns the registrable domain (eTLD+1, small suffix list, no dependency). `lastCart` is kept per store for 30 minutes so a Shopify confirmation on `checkout.shopify.com` or `shop.app` matches the cart from `allbirds.com` through the `Referer` or the previous tab URL in `storage.session`.

**Amazon scope.** The adapter reads only inside the active cart container and skips Saved for later, Buy it again and recommendation rails. Fixture test asserts a saved for later item never appears.

**Silent failure.** The worker retries a failed API call once. On the second failure in a row the badge hides and nothing is drawn on the page until `/health` answers. No error UI ever appears on a store. The shopping page must behave as if she was never installed.

**Memory across sites.** Item memory is keyed by a normalised name (lowercase, strip brand noise and sizes, first four significant words) so AirPods admitted as a want on Amazon are remembered as a want on Best Buy.

**Privacy.** Only the cart region text ever leaves the page, never the full page, never the URL beyond the hostname, never anything from a page that is not a cart. Hashes, not text, are logged.

Popup (`popup/`): onboarding, home panel and settings at 400 by 560, state in `chrome.storage.local`. Settings: grandma, loudness (same three names apply to both grandmas), weekly envelope, quiet hours, sounds on or off, pause on this site (`paused[storeKey]`), panic hide. Home panel and settings have no PNG; build them from DESIGN.md rules and the onboarding screens' components. Side panel is the alternative if a persistent panel is wanted; the popup matches the screens as designed.

Permissions: `storage`, `alarms`, `offscreen`, `webNavigation`. Content script matches `<all_urls>` because she has to work on any store, with `detect.ts` as the gate so the cost on other pages is one function call. Host permission `http://localhost:8787/*` for the worker to reach the API. No `tabs`, no `scripting`.

## The API (Hono)

- `@hono/node-server`, `cors` with a function origin: allow `chrome-extension://*` only. Pin the extension id via `key` in the manifest when it matters.
- Routes: `GET /week` (this week's envelope: budget, spent, left, kept, ratio, mood, bills, daysLeft), `GET /month` (the 30 day read: trueLine, watches, proposedEnvelope), `POST /extract` (page text in, items out, cached by hash), `POST /learn` (DOM outline in, `AdapterSpec` out), `GET /adapters` and `POST /adapters` (shared learned specs, JSON file store, validated by zod), `POST /judge` (items plus memory in, verdicts, mood, line, audio url out), `POST /buy`, `POST /transfer`, `POST /deposit` (Nessie writes, idempotent by `requestId`), `GET /month` (budget, spent, ratio, bills due, mood), `POST /inbound` (iMessage text in, reply out), `GET /schedule` (what the Mac process should send and when), `POST /tts`, `GET /health` (per provider status).
- Config: one `config.ts`, zod validated at boot, crash loudly on a missing key. `DEMO_MODE=1` routes every provider to `fixtures.ts`.
- Nessie client: customers, accounts, purchases, deposits, transfers, bills, merchants. Local JSON cache mirrors every write; on timeout or error the cache answers. "Fun money spent" is recomputed from the ledger every call, never incremented in the UI. Bills due within 7 days feed the mood ("rent in 4 days").
- Model use is confined to `providers/anthropic.ts`: structured output for extraction (JSON schema, validate again with zod), and the line writer with the persona system prompt. The judge never calls the model.
- TTS: ElevenLabs, mp3 cached to `.cache/` by text hash. Failure returns 204 and the extension shows text only.
- Logging: `hono/logger` plus one JSON line per request with `requestId`. Worker keeps the last 200 log entries in `storage.session`.

## The judge (packages/scoring)

- `judge(items, month, memory, rules, { now, loudness })` pure, no Date.now inside, no I/O. `loudness` 1.0, 0.6 or 0.3 scales the ask line (15, 25, 40 dollars) and how far past the envelope a want must go before Gele down. Quiet hours come from `now`: between 23:00 and 07:00 local the verdict carries `silent: true` and the UI shows badge state only. Output stamps `rulesVersion`.
- The envelope is weekly, Monday 00:00 to Sunday 23:59 local. `week.spent` is the sum of Nessie purchases tagged `want` since Monday. Need tagged purchases never move the meter. The tag is set by the verdict at `/buy` time. `month()` is the 30 day read used in onboarding only (true line, watches, proposed envelope).
- `rules/v1.json` is frozen: it produced the 50 case score and must keep producing it. `rules/v2.json` is ask and remember: protected list, memory lookup, $15 ask line, admitted wants react, envelope decides volume.
- Tests with `node --test`: five hand written assertions for the demo path (rice quiet, family quiet, AirPods asks first, admitted want reacts, mixed receipt asks one at a time) plus snapshot goldens over `fixtures/carts/*.json`. Detector tests: ten shopping URL and text samples must wake her, ten non shopping pages (Gmail, YouTube, Wikipedia, the CMU portal, a news site, a bank) must not. Reader tests: saved cart HTML from Amazon, Target and one Shopify store run through the adapters in jsdom and match the expected items. Currency and `storeKey` unit tests. `npm run test:update` regenerates goldens; review the diff.

## iMessage (apps/imessage)

- Photon imessage kit (open source, MIT): runs on the Mac, Node 20+, Full Disk Access granted to the terminal, Messages signed in to a spare Apple ID, Mac awake and unlocked. Reads by polling the Messages database, sends via AppleScript. Long running process.
- It is a dumb pipe: inbound DM to `POST /inbound`, send back the reply; `node-cron` pulls `GET /schedule` from the API for the Sunday 7pm statement and the monthly one. The API is the brain. If the Mac process dies, the extension still works.
- Dedupe inbound by message id in a small JSON file. Rate limit outbound to one per contact per few minutes; AppleScript sends are slow.
- Spectrum (Photon's hosted framework, no Mac needed) exists; signup turnaround unverified, do not bet the demo on it.

## Demo hardening

- Flags in `packages/shared/flags.ts`, overridable from `chrome.storage.local.flags`: `useOffscreenAudio`, `useLLMExtract`, `useSelectorFastPath`, `imessageEnabled`, `demoMode`, `panic` (hides the widget).
- Fixtures: three recorded cart texts from the real Amazon and Target pages, their extractions, verdicts and mp3s. Record them tonight. `DEMO_MODE=1` serves by nearest hash so the API still answers if the model or Nessie is down. The page in the demo is always the live site.
- Kill switches: `/health` dots in the popup debug tab; API falls back to fixtures after two consecutive provider failures; `chrome.tts.speak` if `/tts` fails; last good extraction from session storage if `/extract` fails; selector fast path if the model is down.
- Reload procedure: `npm run dev`, reload at chrome://extensions, hard refresh the Amazon tab.

## Ten do nots
1. No state in worker globals.
2. No listeners inside async code or conditionals.
3. No fetch from content scripts.
4. No async `onMessage` listeners.
5. No `setTimeout` over 30 seconds in the worker.
6. No injecting into body, no touching host DOM nodes.
7. No cached DOM references across observer ticks.
8. No API key in the extension bundle.
9. No model deciding need or want.
10. No permissions you do not use. `<all_urls>` is used, by the detector; nothing runs behind it until it fires.

## Confirm in hour one
Shopify `/cart.js` on any Shopify store (allbirds.com works; gymshark.com is headless and 404s) logging items in the console. Then Amazon cart selectors, then Target. All three logging before anything else is built. Confirmation page URLs for all three. Nessie bills and transfers endpoint paths. Photon kit install on the demo Mac and a test send to a second phone. Whether the venue WiFi blocks localhost traffic from Chrome (it does not, but check).

Sources: Chrome MV3 service worker lifecycle, offscreen, messaging, permissions, alarms, storage, webNavigation docs; Chromium content script fetch policy; WXT guides; Hono CORS; Claude structured outputs; Node test runner; Photon imessage kit docs.
