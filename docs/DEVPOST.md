# Mama Budget

**You set the fun money for the week. She holds you to it, in your cart, before you pay, not after. What you need, she never touches.**

Mama Budget is a Chrome extension and an iMessage thread. A grandmother (Nigerian Mama, Midwest Nana, Mexican American Abuela or Cantonese Grandma Wong) lives in the corner of your cart, protects needs and money sent home, asks once what a new want is for, and reacts only when an admitted want blows the week's envelope. The bank is Capital One Nessie. Her phone is Photon Spectrum on iMessage. Her voice is ElevenLabs. Claude reads carts, screenshots and typed reasons; rules keep every promise.

**What she is not.** Not a blocker, not a guilt trip, not a concept. Nothing is ever blocked and nobody is shamed: she asks once, reacts only when you said it was a want and it blows the week, and Buy anyway is always there. A working extension with a built zip in Releases, 144 tests, and a live site at mamabudget.com.

## Inspiration

Every money app tells you after the money is gone. The moment that changes behaviour is between the cart and the charge, and nobody lives there. We built her for international and first generation students who send money home: their budget has a line most apps have no category for, family. A bank files a $200 transfer home next to a $200 jacket. She files it under need, before any rule about wants.

## What it does

**Innovation.** She intervenes at the only moment that matters, with a relationship instead of a notification setting. A first sighting is only ever a question. A remembered want gets a reaction sized to the week. A planned purchase is left alone. Put something back and Kept goes up. Text her "should I buy the Sony XM5 for $348" or send a screenshot of the product page, and she weighs it with the same judge and memory as the cart.

**Technical Complexity.** One content script on all URLs, gated by a pure detector under 5 ms that needs two structural signals before loading anything. Five readers, one shape: platform JSON (Shopify, WooCommerce, BigCommerce), hand written adapters (Amazon, Target, Walmart), the product page's JSON-LD so Add to cart is answered before the item is in any cart, cart text to Claude with a JSON schema, and the iMessage thread itself. Rules keep the promises; the model knows the world. A test swaps the model for one that returns garbage and proves all 50 frozen verdicts unchanged, then checks over 10,000 situations that whether she reacts never depends on the model. Every bank write is idempotent. 144 tests.

**Usability.** Nothing is blocked. Buy anyway always works. One card at a time, one reaction per item, three asks per session, then she goes quiet. Every loud line names the price, the item and what is left, never the person. Text accompanies every spoken line, cards are keyboard reachable, reduced motion is honoured. Start over resets her memory and the bank so each judge meets her fresh.

**Adherence to Theme.** She grows with you. Week one she only asks. By week three she knows your haunts, your admitted wants and the reasons you gave, and meets you at the door of the merchant that keeps eating the week. Kept is a record of every time you were right.

## How we built it

WXT and TypeScript for the extension, a plain Node API, node:test. Nessie holds the ledger: `GET /customers/:id`, `POST /customers/:id/accounts`, purchases, deposits, withdrawals and bills. The week, Kept, savings and the watched merchants are computed from what Nessie holds. Photon Spectrum gives her a number of her own: she types while she reads, confirms a photo she is unsure of before judging it, tapbacks instead of words when a want fits, replies in thread, and sends a cheaper listing as a rich link only when the price came from a page the search returned. ElevenLabs gives each of the four grandmas her own voice (Mama, Nana, Abuela, Grandma Wong), moved by mood; each grandma's lines were written from documented speech of real grandmothers, never improvised, with the lines that shame left out. On Gele down her line also arrives as a voice note. The site, mamabudget.com, was lifted from our own design screens.

## Challenges we ran into

Reading any cart on any store without hardcoding stores. Keeping the model out of the decision while letting it read the world. Texting your own number from your own Mac shows her texts as received, so she answered herself in a loop and once moved $50 home from her own reply. She now drops echoes of her own words and never reads a statement as an order.

## Accomplishments that we're proud of

We froze 50 anonymised student purchases before writing any rules and asked our mothers to label each one privately. Two raters, majority over both. Where the mothers agreed, Mama agreed with them 26 of 32 times (81%). The bank's own merchant categories, on the same 32, got 22 (69%). She never scolded a need: 0 of 16. On the unclear cases she asked 6 of 15 times (40%). The two mothers split on 15 of the 50, and on those she did the only honest thing: she asked.

This is agreement with our participating mothers, never objective truth. `npm run score` reproduces it.

## What we learned

The first mother labelled both transfers home as Depends. Our hardest rule says money to family is always a need. We kept the rule and reported the disagreement. Shame drives escape, pride drives repair, so Kept, not spent, is her number.

## What's next for Mama Budget

Three stores have hand written adapters; everything else goes through the model reader, slower and asking rather than judging when unsure. The phone path needs Spectrum keys or a Mac signed into Messages. Two raters so far; the third is pending, and 15 of 50 cases are splits. The API runs on your machine, so a stranger installing from the store sees nothing until it is hosted; that is the first job after the hackathon, with the Chrome Web Store listing (submitted, in review) going live behind it. Then: more raters, a 24 hour hold on put backs with a next day text, the savings brake.

MHacks 2026, University of Michigan. Praise Oyimi (GitHub yimi23) and Ugonna Emeka-Inegbu (GitHub HackUgo). Tracks: FinTech, Judged by an LLM, Useless AI, Dumbest Idea.

## Built With

typescript, wxt, chrome-extensions, node.js, capital-one-nessie, photon-spectrum, imessage, elevenlabs, claude, anthropic-sdk, jsdom, json-schema, github

## Also fill on Devpost

- Table number
- Both teammates added: Praise Oyimi, Ugonna Emeka-Inegbu
- GitHub link: https://github.com/yimi23/mama-budget (repo set to public first)
- Website: https://mamabudget.com and https://mamabudget.tech (same site; both on Netlify)
- Tracks ticked: FinTech, Judged by an LLM, Useless AI, Dumbest Idea; sponsor prizes: Capital One, Photon, ElevenLabs
- Built zip from `npm run build:ext` uploaded to a GitHub Release and linked
- Screenshots: Ask card, Shocked card, iMessage thread, score table
