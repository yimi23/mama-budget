# Demo day runbook. Sunday Oct 4. Submit by 11:30am, hard stop 12:15pm EDT.

Everything below was verified against the code at `2f239da` on Saturday night. The judge drives; you narrate only the rule being shown.

## Before anyone sees it (20 minutes, in this order)

1. **Code.** `git pull --rebase`, then `npm install`, then `npm test` (expect 42 api + 54 extension green) and `npm run build:ext`.
2. **Keys.** `api/.env` holds `NESSIE_KEY`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID` (Mama), `ELEVEN_VOICE_ID_NANA`. For texts, Ugonna adds the Photon credentials and `PHOTON_TO` = the judge's iPhone. Without them she shows "Texts are off right now" and never fakes a send.
3. **Ledger.** Tests pollute it. Reset: `git checkout -- data/nessie-cache.json`, then `npm run api`. Confirm with `curl localhost:8787/week`: budget 75, spent 50, left 25, kept 40, mood calm. If anyone charged the live Nessie account, run `npm run reseed` instead (fresh student) and restart the API.
4. **API running.** `npm run api` in its own terminal, left open. `curl localhost:8787/health` answers `{"ok":true}`.
5. **Chrome profile.** Honey and every other shopping extension OFF. Load unpacked from `apps/extension/build/chrome-mv3` (or reload it). The ring and meter icon appears in the toolbar.
6. **Onboarding once.** Click her icon: Welcome, pick Mama, Connect bank, she reads the month (food delivery $102, rice $24), proposed $75, three watches, phone (skip if Photon is off), loudness, Go shopping, practice cart. This saves grandma, loudness and envelope. Do it on the demo machine before judging, then **Start over** from the popup's home screen right before each judge so the asks are fresh.
7. **Amazon.** Logged in, 1-Click OFF, default card removed. Cart holds rice (protected), dish soap (protected), AirPods Pro or the Instax (over $15, new). Nothing else checked.
8. **Sound.** Mac volume up. It is daytime, so quiet hours (11pm to 7am) do not apply.
9. **Second laptop.** Same steps 1 to 7. Hotspot tested.

## The demo, about 90 seconds

Open: "Budget apps tell you after the money is gone. We built someone who says something before."

1. **Rice and soap.** Judge opens amazon.com/cart with rice and soap. Badge slides in bottom right, calm face, meter two thirds, green. Nothing else. Say: "Rice. Soap. She reads the item, not the store."
2. **Tap her face.** The panel: Kept this week $40, "$25 left. 1 day. Rent in 4 days.", the week's bar. Tap again to close. Say nothing.
3. **AirPods.** Judge adds them (from the cart page's own suggestions, or ticks the box). Within a second: the Ask card, watching face, meter still. "AirPods Pro? Tell me the story first." Say: "First time she sees it, she asks. She never scolds a first sighting."
4. **"I just want them."** Badge shakes, Shocked face, coral card, her voice: "We said 75 dollars for the week. AirPods Pro alone is 179. That is 286,400 naira." Let the room hear her.
5. **"You're right, Mama."** Bubble: "Good. I am watching the cart." Judge removes the AirPods on Amazon. Within a second, proud: "My pikin. Come and hug me." with "$179 stays in the week." Say: "She protects the obvious, asks about the rest, and remembers."
6. **Buy anyway** (second item, the Instax or the book). Meter turns coral, bubble: "154 dollars past the week" with "$255 on Fujifilm Instax Mini 99. $305 of $75 gone this week. $0 left." If Photon is live the judge's phone buzzes with the same numbers three seconds later. Say: "That charge is on a Capital One Nessie account. Simulated bank, real moment."
7. **Name a store.** Ask the judge for any store. allbirds.com, target.com and walmart.com are known to work; on an unknown Shopify store she still reads the cart. Open it, add anything, she is there. Say nothing about how.
8. **The score.** One slide. Say the real numbers.

Close: "She grows with you." Then stop talking.

## Admit before they ask

A simulated bank. One weekly envelope. Two hand written stores plus Shopify; on a store she has never seen she asks rather than scolds, on purpose. Her memory is per item name, so the same AirPods on another store may get asked once more.

## If something breaks

- **No badge.** Open the popup: has a grandma been picked? Is the API running (`curl localhost:8787/health`)? Reload the extension, hard refresh the cart. Console filter `mama` tells you which step stopped.
- **Card but no voice.** Mac volume, then `api/.env` has both ElevenLabs values, then the API log. Text carries the demo; keep going.
- **Amazon misbehaves.** Switch to the Target tab. Same extension, same Mama. Do not explain.
- **Nessie down.** The local cache answers everything. Say "simulated bank" as planned.
- **She asked about this already.** Popup home, Start over. Asks and reactions reset; the ledger does not (see step 3).
