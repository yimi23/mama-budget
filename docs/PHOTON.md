# Messages: how she texts, and how to set it up

She lives in two places: the cart and your Messages. Every text goes through one dispatcher, `notify()` in `api/notify/index.js`, which picks a sender and logs the result to `GET /messages` either way. Three senders, picked in this order:

| Sender | When it is live | Needs | Two way |
|---|---|---|---|
| `photon` (Spectrum, Photon's cloud) | `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` set | A project at app.photon.codes. No Mac. | Yes, `api/photon/spectrum.js` |
| `imessage` (Photon iMessage kit on this Mac) | No Spectrum credentials, `PHOTON_TO` set, API running on a Mac signed into Messages | Full Disk Access, one Automation prompt. No signup. | Yes, `api/photon/kit.js` |
| `log` | Nothing set | Nothing | `POST /messages/incoming` tests the conversation |

`GET /photon/health` says which one is live right now.

## What she texts

| When | What | Where it comes from |
|---|---|---|
| A charge lands in the bank | Her line, then the numbers. A want inside the week is a short note. The want that carries the week across 75% gets the Watching line, once. A want past the envelope is Gele down. Savings or money home is Proud. Needs never text. | `notifyText` in `api/lines/writer.js`, levels in `api/notify/watch.js`, fired by the bank watcher |
| Two weeks of silence | One line saying she will stop, then no statements until they text again. | `silence()` in `api/photon/schedule.js` |
| Sunday 7pm | Four lines: gone and left, kept, the bill due or the biggest one, one line of her. Closes the week. | `weeklyStatement`, ticker in `api/photon/schedule.js` |
| Last day of the month 7pm | A summary: spent and kept, needs covered, sent home, against last month. | `monthlyStatement`, same ticker |
| You text her | She answers from the same `week()` the badge and the card read, so the two never disagree. | `api/notify/chat.js` |

What she understands when you text (`api/notify/parse.js`): "how much do I have left" and its shapes ("what's left", "left?", "wetin remain"), "move 40 to savings" ("save 25", "put 10 away"), "send 50 home" ("send $50 to mum", "transfer 30 to family"). A verb with no amount asks for the amount. Saving more than what is left is refused with the number. Money home is never capped and never scolded. Every move carries the message id as `requestId`, so a redelivered text never moves money twice. Greetings and thanks get a one line answer with what is left. Everything else goes to the conversation: apologies, promises ("no more DoorDash this week", remembered and checked against later charges), and the model when `ANTHROPIC_API_KEY` is set, with a fallback that still answers from the live numbers.

House rules, enforced by the gate in `api/photon/gate.js` for every sender:
- Quiet 11pm to 7am for anything she starts herself. Replies, the onboarding tap and the statements always go.
- One unprompted text per person every three minutes (`PHOTON_GAP_MS`).
- One unprompted text a day per person on top of the statements (`PHOTON_DAILY_CAP`; `0` turns it off for rehearsals). Gele down and Proud are important and skip this cap, so a morning note never silences the text that matters. They still respect quiet hours and the gap.
- A held text is still logged with `held: quiet | gap | daily`, so `GET /messages` shows what she bit her tongue on.
- Nothing ever shows a sent state that did not happen. `texted` and `ok` are true only when a sender accepted the text.

## Routes

```
GET  /photon/health                       -> { sender, spectrum, imessage: { configured, dry, kit, db, available, listening, to } }
GET  /messages                            -> the transcript, in and out, with sender and sent
POST /messages/incoming { from, text, id? } -> run the conversation without a phone; { reply, intent, texted }
GET  /schedule                            -> what is due, next weekly and monthly, last sent, grandma
GET  /schedule?now=1&grandma=nana         -> send the weekly statement now; remembers who texts
POST /schedule { now: true, kind?, to?, grandma? }
```

Onboarding screen 07 calls `/schedule?now=1` and shows the returned `text` only when `ok` is true. Otherwise the button is disabled with "Texts are off right now".

## The Mac kit, once

1. `npm install` at the repo root pulls `@photon-ai/imessage-kit` 2.1.2 and `better-sqlite3`.
2. Messages signed in. The plan says a spare Apple ID. A personal one works and texts come from that number.
3. Full Disk Access for the terminal app you run the API from: System Settings, Privacy and Security, Full Disk Access. Quit and reopen the terminal after.
4. The first real send pops an Automation prompt ("Terminal wants to control Messages"). Allow it.
5. Mac awake and unlocked for the whole demo: `caffeinate -dims`.
6. `api/.env`: `PHOTON_TO=+1XXXXXXXXXX`, the judge's iPhone in E.164. `PHOTON_ALLOW` defaults to that number; `*` answers anyone who texts the Mac.

Rehearse first with nothing sent:

```
PHOTON_DRY=1 npm run api
curl -s localhost:8787/photon/health
curl -s -X POST localhost:8787/messages/incoming -H 'content-type: application/json' -d '{"from":"+1XXXXXXXXXX","text":"how much do I have left"}'
curl -s 'localhost:8787/schedule?now=1'
```

Then drop `PHOTON_DRY`, restart, and run the `/schedule?now=1` line once. That is the first real text and it buzzes the phone. Text the Mac "how much do I have left" and watch the log line `[imessage] from ...` and her reply.

## Spectrum, if the signup lands

Create a project at app.photon.codes, copy the two values from its Settings page into `api/.env`, restart. Spectrum then takes over as the sender; the Mac kit steps aside automatically. The plan marked Spectrum's signup turnaround as unverified, so the Mac kit is the demo fallback.

## Known edges

- Kit 3.0 queries `message.ck_chat_id`, which macOS 15 does not have, so it sends but cannot read. Pinned to 2.1.2, which does both on macOS 15.7. Try 3.0 only on a newer macOS.
- `send()` resolves when Messages.app accepts the AppleScript, not on delivery. A number that is not on iMessage shows as sent here and fails in Messages (error 22). Only iPhones get the text.
- The Mac listener answers direct messages only, never groups or reactions, and dedupes by message guid in `data/photon-seen.json`.
- The bank watcher polls Nessie every 3 seconds and is the only source of after-purchase texts. Without `NESSIE_KEY` it has nothing to watch and says so once; the `/bank` page and `/v2/buy` still write the local cache.
- Replies from the Mac kit and from Spectrum both come back through `notify()` with `prompted: true`, so there is one send path, one log, one gate.
