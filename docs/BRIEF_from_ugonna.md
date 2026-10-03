# Mama Budget: build brief

From Ugonna, for Praise. Paste this whole file into your AI as the spec.
MHacks 2026. Submissions close Sunday 12:00 PM. Team: Praise (code), Ugonna (design, faces, voice, lines).

## 1. What it is

A Chrome extension. An AI grandma (Mama, a Nigerian mother; or Nana, a Midwestern grandma) watches your spending and reacts at two moments:

- **Situation 1, before you pay:** you are on a shopping cart or checkout page. She reads the items, checks your bank, and reacts on the page. If it is bad enough she blocks checkout.
- **Situation 2, after you pay:** a charge lands in your bank account. She texts you in iMessage.

Target user: international and first-gen students. Money sent home always counts as a need.

## 2. Pieces

| Piece | What it is | Runs where |
|---|---|---|
| Extension | Content script (reads carts, shows Mama on the page) and a popup panel (setup, settings, her home) | Chrome on the laptop |
| Server | Small Node/TypeScript server. Holds all API keys. The extension only ever talks to this. | Laptop for the demo, or any always-on host |
| iMessage listener | Photon Spectrum loop. Always-on process, so it lives in the server, not on a serverless host. | Same as server |

No database. Nessie is the source of truth for purchases, balance and bills. User settings live in `chrome.storage`.

## 3. Tools and what each one is for

| Tool | Used for | Prize it enters |
|---|---|---|
| Capital One Nessie (api.nessieisreal.com) | Demo student, checking and savings accounts, purchase history, bills, posting charges, transfers | Best Use of Nessie; FinTech track |
| ElevenLabs | Mama's and Nana's voices. Spoken reactions, and the voice argument at checkout (conversational agent in the page, no phone number needed) | Best Project Built with ElevenLabs; MLH Best Use of ElevenLabs |
| Photon Spectrum (`spectrum-ts`) | Her iMessage texts after a charge, and replies in character | Photon iMessage Agents |
| LLM (Praise's choice) | Pull items and prices out of cart text, label each need or want with a reason, write her lines in character | none |
| Figma | Five mood faces per grandma, the panel and overlay screens | Figma Best Design |
| Notability | Early sketches and wireframes. Need 2 screenshots and a note on the Devpost. | Best Use of Notability |
| .tech domain | mamabudget.tech (or the new name) pointing at a landing page | MLH Best .Tech Domain |

Also entering: FinTech (main track), Judged by an LLM, Dumbest Idea. Not using: Gemini, Neon, Spacetime, FetchAI, Relay, Twilio.

## 4. Setup (first time the panel opens)

1. Pick your grandma: Mama or Nana.
2. Pick how loud: slider from gentle nudge to full volume.
3. Connect your bank: for the demo, one button that selects the seeded Nessie student.
4. Set a monthly budget and a savings goal.
5. Phone number for texts.

After setup the same panel is her home: face, meter (Mama's gele, Nana's glasses), budget left, bills coming up.

**Settings (gear icon in the panel):** change grandma, loudness, budget, savings goal, phone number, voice on or off, and turn her off for a site.

## 5. Situation 1: in a cart

### How she knows you are in a cart
Like Grammarly waking up when a text box is focused. The content script runs on every page but stays asleep until it sees a trigger:

1. **URL check:** path contains `cart`, `checkout`, `basket`, `bag` or `order`.
2. **Page check:** visible text contains phrases like "Subtotal", "Order total", "Proceed to checkout", "Place order".
3. **Change watch:** once awake, a `MutationObserver` re-reads the cart when items or the total change (debounced, about 1 second).
4. **Checkout click:** a click listener on buttons whose text matches checkout or place order, so she can step in before the page moves on.

When awake, the script sends the page's visible cart text to the server. The LLM returns structured items: name, price, quantity, need or want, one-line reason. This avoids per-site selectors, so it works on most stores.

### What she looks at
- Each item: need or want.
- **Cart total against checking balance.** Can you afford it at all?
- Cart total against what is left of the monthly budget.
- **Bills coming up** (rent and others from Nessie) against the balance after this cart.
- **Recent habits:** how many want purchases in the last 7 days.

### What she does
Severity comes from arithmetic on those numbers, not from the model. The model only labels items and writes the line.

| Mood | Rule | What happens |
|---|---|---|
| Calm | All needs, or wants are small and budget stays under 75% | Small icon in the corner, meter low, silent |
| Watching | Budget would pass 75% | Meter rises, one short comment |
| Shocked | A big want item, or third want this week | Meter high, she complains item by item, spoken aloud |
| Blocked (gele down) | Cart pushes over budget, or leaves less than upcoming bills, or exceeds the balance | Overlay covers the checkout button. To continue you argue with her by voice, or type. She offers a deal: remove an item, or move money to savings. |
| Proud | Sending money home, or the week ends under budget | Proud face and line |

Meter height = cart total divided by budget remaining, clamped 0 to 1.

## 6. Situation 2: a charge hits the bank

Nessie has no notifications as far as we know, so the trigger in the demo is an **"I bought it anyway"** button in her panel that posts the cart to Nessie as a purchase. (A slow poll of Nessie purchases is the real-world version.)

### What she looks at
- Store and amount.
- Budget used this month after the charge.
- Balance left against bills due (rent first).
- Whether it matches a cart she just blocked.
- Whether it is money sent home (always need).

### What she does
Text tone depends on budget used:

| Budget used | Text |
|---|---|
| Under 75% | Calm note with what is left |
| 75% to 100% | Warning, mentions the next bill |
| Over 100% | Angry, gele-down face attached, then ends with love |
| Money sent home or a good week | Proud |

Each text carries her face image for that mood. The user can text back and she answers in character with their real numbers. Optional line: what the amount means in naira.

## 7. Talk to her from the panel

A command box in the panel: "Mama, move $50 to savings" or "send $50 home." The LLM turns it into an action, the server does a Nessie transfer, and she confirms with the new balances. Same action is available during the checkout argument.

## 8. Server endpoints

- `POST /cart` : cart text in; items, labels, mood, meter, line, audio out.
- `POST /charge` : post purchase to Nessie; returns new mood; fires the text.
- `GET /state` : balance, budget used, bills due, recent wants, current mood.
- `POST /transfer` : move money between accounts (savings, send home).
- `POST /chat` : typed fallback for arguing with her.
- Seed script: one demo student with a month of history, a rent bill due in 4 days, checking and savings accounts.

Cache the labels and audio for the demo items so nothing goes off script. If Nessie is slow, fall back to a cached copy.

## 9. Build order

1. Extension wakes on a cart page and reads the items. Everything depends on this.
2. Server labels items and returns a mood; face and meter show on the page.
3. Nessie seed; budget, balance and bills in the mood rules; block at checkout.
4. "I bought it anyway" posts the charge; face updates.
5. Setup panel and settings.
6. Voice: spoken lines, then the argument.
7. Photon text after a charge.
8. Transfer command, naira line, Nana.

Steps 1 to 4 are the demo. Stop and test on two real stores after step 2.

## 10. Demo (judge drives, about 60 seconds)

1. Rice and soap in a real store's cart. She stays calm.
2. Judge adds AirPods. Gele climbs: "rent is due in four days."
3. Judge clicks checkout. She blocks it; judge argues with her out loud.
4. Judge presses "I bought it anyway." Charge hits the bank, gele comes down, the phone buzzes with her text.
5. Send $50 home. She goes Proud.
6. One slide: Mama against real mums against bank categories.

Backup: product pages pre-opened in tabs, a saved copy of a full cart page, and a recorded video.

## 11. Not verified yet, check first

- Nessie: exact endpoints for bills and transfers, and that there are no notifications. Ask the Capital One booth.
- Photon: whether the agent can text first, whether hackers get a cloud line or need a Mac, whether the receiver needs an iPhone. Workshop is at 5:00 PM.
- ElevenLabs: that the in-page conversational agent can call our server mid-conversation to do the transfer.
- Which real stores let you fill a cart without logging in.
- The need-versus-want score: the 50 items our mums label must be items we did not tune on.
