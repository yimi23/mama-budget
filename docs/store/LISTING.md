# Chrome Web Store listing, ready to paste

Dashboard: https://chrome.google.com/webstore/devconsole (one time $5 developer fee on the Google account that owns it).
Item zip: build with `npm run build:ext`, then zip the `chrome-mv3` folder (the rolling `latest` release holds the same file as `mama-budget-extension-latest.zip`).
Visibility: **Unlisted** (anyone with the link installs, not searchable, still auto updates).

## Store listing tab

**Name**: Mama Budget

**Summary** (132 characters max):
You set the fun money for the week. She holds you to it, in your cart, before you pay. What you need, she never touches.

**Rejection log**: Oct 6 2026, "Spam and Placement in the Store: excessive keywords in the description" (the sentence listing Amazon, Target, Walmart, Shopify, WooCommerce and BigCommerce). Fixed by removing every store and platform name; resubmit with the text below.

**Description** (rewritten Oct 7 after the "excessive keywords" rejection; no store or platform lists, no third-party names beyond the people who built it):
Every money app tells you after the money is gone. Mama Budget puts someone in your cart.

Pick your grandma: Mama (Nigerian), Nana (US Midwest), Abuela (Mexican American) or Grandma Wong (Cantonese). Set the fun money for the week. From then on she sits in the corner of your cart on the stores you already shop at and speaks before you pay, not after.

Groceries, rent, medicine, money sent home: she says nothing. A new want above a few dollars: she asks what it is for, once, and remembers your answer on every store. A want that blows the week: she tells you what it costs you, in plain words, with the exact amount and what is left. Buy anyway always works. Nothing is ever blocked and no button on the store is ever pressed for you.

She reads the cart on the page you are on, including product pages, where she answers the Add to cart click itself. Her lines are written from your week, your item and your store, so she never says the same thing twice.

Text her too. Send her a question like "should I buy these headphones for $348", or a screenshot of a product page, and she weighs it with the same judge and the same memory as the cart. If the same product is cheaper somewhere else, she sends the link.

How it works under the hood: a tiny local check decides whether a page is a cart before anything loads; rules keep every promise (needs and family money are protected before any model runs, a first sighting is only ever a question, she reacts only to wants you admitted, the week's numbers decide how loud she is); a model only chooses her words.

Needs the companion API running (open source, in the same repository). By default it runs on your own computer; the address can be changed in the popup.

Built at MHacks 2026 by Praise Oyimi and Ugonna Emeka-Inegbu.

**Category**: Shopping (alternative: Productivity)
**Language**: English (United States)

**Store icon**: `docs/store/icon_128.png` (128 by 128)
**Screenshots** (1280 by 800): `docs/store/screenshots/01` to `05`
**Small promo tile** (440 by 280): optional; skip.

## Privacy tab

**Single purpose description**:
Mama Budget watches the shopping cart on the page the user is on and, when a purchase would exceed the weekly fun money the user set, shows and speaks a short message from a grandmother character before the user pays. It never blocks a purchase.

**Permission justifications**:

- `<all_urls>` (content script): Shopping carts exist on every store on the web, so the extension must be able to run on any site. On every page a small local check (under 5 milliseconds, no network, no page changes) looks for the structure of a cart or checkout: a subtotal, a pay button, a cart address. Only when it finds one does the rest of the extension load. On any other page nothing is read, stored or sent.
- `storage`: Keeps the user's settings (which grandma, how loud, the weekly amount) and what the user told her about items, so she asks about an item once and remembers the answer.
- `offscreen`: Plays her spoken line through an offscreen document, which is the Manifest V3 way to play audio from an extension.
- `tts`: Uses the browser's own text to speech as a fallback voice when no ElevenLabs voice is configured, so the spoken line still exists for users who rely on audio.
- Host permission `http://localhost:8787/*`: The extension's companion API (open source, run by the user on their own computer by default). Cart items and the user's answers are sent there to be judged against the week. No other host is contacted by the extension.

**Remote code**: No. All code ships in the package. The API is a separate program the user runs.

**Data usage** (tick these):
- Website content: yes (item names, quantities and prices from the cart area of shopping pages).
- User activity: yes (the user's answers on her cards and typed reasons).
- Personally identifiable information: no. Financial and payment information: no (prices of items only; never card or account data). Authentication information: no. Personal communications: no. Location: no. Web history: no. Health: no.

**Certifications** (tick all three): data is not sold to third parties; not used or transferred for purposes unrelated to the item's core functionality; not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL**: https://yimi23.github.io/mama-budget/privacy.html (GitHub Pages from `/docs`, needs the repository public; until then, the same file at https://github.com/yimi23/mama-budget/blob/main/docs/privacy.html)

## Distribution tab

Visibility: Unlisted. Regions: all. Pricing: the Web Store has no price field; the price is in the description (below) as the
"Accepting Payment From Users" policy asks: the price, the trial, who sells it, and a link to terms with the refund policy.

## Price paragraph (goes at the end of the description once billing is on)
Mama Budget is free for seven days with a card, then $4.99 a month or $39 a year. Cancel in one tap from her popup.
Sold by Praise Oyimi, not Google. Terms and refunds: https://mamabudget.com/terms. Until billing is switched on the
API runs open and this paragraph stays out of the listing.

## After submitting

Review takes hours to a few days; the broad host permission usually draws the longer look. While it is pending, the install path stays the `latest` release zip. Once published, every later version is: bump `version` in `apps/extension/wxt.config.ts` (or package), build, zip, upload in the dashboard, submit; users update automatically within hours.

Known catch for strangers: a fresh install with no API running on their computer shows nothing (the badge hides when the API is down, by design). The description says so; the proper fix is a hosted API with its address as the default.
