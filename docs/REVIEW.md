# Review: are we on track

Paste this into Claude Code whenever a block finishes, and once more at 8:30am before rehearsal. It reviews, it does not build. Every item is pass or fail with evidence; no "mostly." Anything that fails goes into a list at the end with the one line fix, ranked by what a judge would notice first.

```
Review only, change nothing. Read docs/REVIEW.md and run every check against the current code and screens. For each item say PASS or FAIL with one line of evidence (a file and line, a command's output, or what you saw on the page). End with the FAIL list ranked by what a judge sees first, each with a one line fix and the file to change. Do not fix anything in this run.
```

## 1. The aim shows

- [ ] A fresh install reaches "Here is what I saw" with a true line built from the ledger, not a fixed string. Evidence: change a seed amount, rerun, the line changes.
- [ ] The phone receives a real text before onboarding ends, or the button is disabled with "Texts are off right now." Never a fake sent state.
- [ ] The first number she shows is Kept this week, and it goes up when an item is removed, money moves to savings, or money goes home.
- [ ] Nothing in the product calls her AI, smart, powerful, or magic. `grep -ri "AI\b\|smart\|powerful\|magic" apps/ packages/ design/screens/*.html docs/ONBOARDING.md README.md` returns nothing in her copy.

## 2. Her voice (the seven rules from the Clicky study)

Run over every string a user can read or hear: `apps/api/src/lines/*`, onboarding copy, card copy, statements, README first line, store description.

- [ ] First person. She says "I," never "she" or "Mama" about herself after the welcome.
- [ ] Mid sentence. Openers like "So." "Okay." are allowed; headlines and slogans are not. No line reads like an ad.
- [ ] Place first, shown. Wherever she says where she is, the badge or the thing is on screen in the same beat.
- [ ] Outcomes, not features. No line lists what she can do; every line says what happens to you.
- [ ] She turns to you within two sentences on any screen that asks for something.
- [ ] No adjective about herself anywhere.
- [ ] Every loud line names the amount and the item. Nothing about the person. One cultural marker per line at most. Mama adds the naira, Nana never does.
- [ ] No dashes in any copy. `grep -rn "—\|–\| - " apps/api/src/lines apps/extension/entrypoints design/screens/*.html` returns nothing in copy.
- [ ] Numbers sent to TTS are words, not digits ("one hundred and two dollars").

## 3. Onboarding, against docs/ONBOARDING.md row by row

- [ ] Order: welcome, grandma, bank, give me a second, here is what I saw, what I'll watch, phone, check your phone, how loud, go shopping, practice cart.
- [ ] Only two questions are asked of the user: grandma, loudness. Everything else is read or proposed.
- [ ] Welcome: badge slides in (600ms, decelerate) before the first bubble; three bubbles land with the voice, not before.
- [ ] Grandma: Hear her plays a cached line per grandma; the two mothers line is present.
- [ ] Give me a second: rows tick with real counts from `/month`, minimum 2.5s, maximum 6s then advance anyway.
- [ ] Here is what I saw: her first spoken words are the true line; face Shocked while it plays; `proposedEnvelope` fills the field; the first name appears once and never again.
- [ ] What I'll watch: three rows from `watches()`, first one spoken, Change these removes a row.
- [ ] How loud: picking a tier plays one line at that tier's volume. Same three tiers for Nana under her names.
- [ ] Go shopping: Kept counts up from 0; Try me first opens the practice tab; Open a store instead is the secondary.
- [ ] Practice cart: labeled practice; AirPods added by the page 1.5s after load; dotted line to the badge with "That's me. I live here."; buttons write memory for real; ends with Open a real store.
- [ ] Mute top right from screen 04 on, remembered in settings. No sound in quiet hours when quiet hours are on (opt in for the hackathon).
- [ ] Every step after grandma has a one line skip that never argues.

## 4. The cart

- [ ] Rice, soap, textbook, medicine, money home: nothing. Badge calm, meter still, no card, no sound.
- [ ] Unknown item over $15: one Ask, Watching face, two buttons, no voice.
- [ ] "It's for something" writes need forever; "I just want them" writes want and she may react.
- [ ] She only scolds admitted or remembered wants. Never a first sighting.
- [ ] A want that fits the week: nod. A want that blows the week: Shocked, voice, line with amount and item. Gele down after a real confirmation that blows it.
- [ ] One card at a time, queue the rest, three asks per session, dedupe across tabs.
- [ ] Buy anyway closes the card and never clicks a store button. Nothing is ever blocked.
- [ ] Item removed: Proud once, Kept ticks up with the proud sound.
- [ ] Card is `role=dialog`, focus in and back, Tab reachable, `aria-live="polite"`, animations off under reduced motion.
- [ ] Two failed API calls in a row and the badge hides. No error UI ever appears on a store page.
- [ ] The card matches design/screens/12 to 15 to the pixel: 360 wide, 20px from bottom and right, cream ground, ink buttons, radius 8 inputs 12 lists pill buttons, tabular digits, no gradients, no emoji icons, no uniform radius.

## 5. Readers and the gate

- [ ] `detect.ts` has no imports, no DOM writes, runs under 5ms. On gmail.com, youtube.com, wikipedia.org the Performance tab shows no extension work beyond the gate.
- [ ] Readers run in order: platform JSON, site adapters, JSON-LD, text to model. All return the same `CartRead` with `source` and `confidence`.
- [ ] Shopify: allbirds.com cart reads exactly from `/cart.js`. Amazon: active cart only, Saved for later never appears (test on the saved HTML). Target: quantity change re reads.
- [ ] Currency parsed; a naira store shows the store currency first, USD after.
- [ ] Confirmation page detected; `/buy` posted once with the order id as `requestId`; refresh does not double post.
- [ ] Learned adapters: second visit to an unknown store is instant with no model call; a failed spec is dropped and relearned.
- [ ] Tests green: rules, detector (ten true, ten false), readers on saved HTML, currency, storeKey. `npm test` output pasted.

## 6. The judge and the ledger

- [ ] `judge()` is pure: same input, same output, `now` and `loudness` injected, no I/O. The model never changes a verdict. A test fails if it does.
- [ ] rules v1 still produces the 50 case score it produced on Saturday. `npm run score` matches docs/RESULTS.md.
- [ ] `week.spent` sums want tagged purchases since Monday only. Needs never move the meter. Nessie `balance` is never read.
- [ ] `GET /week` returns envelope, spent, left, kept, ratio, mood, bills, daysLeft. `GET /month` returns trueLine, watches, proposedEnvelope.
- [ ] Every mutating call carries `requestId` and is idempotent. `.env` is not in git. The extension bundle has no key.

## 7. Messages and voice

- [ ] "how much do I have left" answers with this week's numbers from the same `/week` the card uses.
- [ ] "move 40 to savings" and "send 50 home" act on Nessie and reply with the new Kept.
- [ ] Gele down fires one text. One unprompted text a day plus the Sunday statement; quiet 11pm to 7am when PHOTON_QUIET=1.
- [ ] Voice only on Shocked and Gele down and the onboarding lines. Cached mp3 by text hash. `/tts` failing returns 204 and the UI shows text only; `chrome.tts` fallback behind the flag.
- [ ] Six cue sounds exist (files or synthesised) under 1.2s each, play from the offscreen document, obey mute and quiet hours.

## 8. Design, against docs/DESIGN.md

- [ ] Popup 400 by 560. Badge 64 circle, gold ring, gele meter bar. Card 360 wide, 24px from the right, above the badge.
- [ ] Cream ground, ink buttons, color only on her. One primary button per screen. Sentence case. System font for UI, Bricolage Grotesque 800 for headlines only.
- [ ] Motion 150 to 300ms, decelerate in, accelerate out, no bounce, only on user action or mood change. Badge breathes while watching, blinks every 6 to 9s, nothing else moves.
- [ ] She is never on the bank screen. Nana is static on the pick screen, never animated.
- [ ] Toolbar icon is the ring and the meter on the cream tile (icon/mark.svg), the same two shapes as the in page badge.

## 9. Demo and submission

- [ ] The 90 second run works ten times in a row, driven by someone who did not build it. Timed.
- [ ] Beats in order: install and the true line plus the buzz (20s), Amazon rice quiet, AirPods ask, admit, she speaks and the phone buzzes, name a store and she is there, score slide, close on the line.
- [ ] Pitch opener, README first line and store description are the same sentence in the same order: the number, held to, before you pay, what she never touches.
- [ ] Devpost: team members, four criteria as headings, theme line, named user, quantified score with honest denominators, admitted limit, seven Nessie resources, Photon clip, ElevenLabs credited, both domains, Figma, Notability, built zip in Releases, repo public.
- [ ] DEMO_MODE runs the full Amazon demo with the api's internet off. Second laptop runs it too. Hotspot tested.

## How to read the result

Fails in sections 1, 2 and 9 cost the win. Fails in 3 and 4 cost Usability. Fails in 5 and 6 cost Technical Complexity and the LLM judge. Fails in 7 and 8 cost sponsor prizes and Design. Fix in that order.
