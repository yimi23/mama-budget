# Messages: how she texts, and how to set up the Mac

She lives in two places: the cart and your Messages. The Photon iMessage kit (`@photon-ai/imessage-kit`, open source, MIT) runs on a Mac signed into Messages. It sends through Messages.app by AppleScript and reads new texts from the Messages database. The API is the brain and runs on that same Mac; `apps/imessage` is the pipe that forwards incoming texts to it.

## What she texts

| When | What | Where it comes from |
|---|---|---|
| A want is bought anyway (`POST /v2/buy`) | Her line, then the numbers: amount, item, gone this week, left. Gele down past the envelope. | `buyText` in `api/lines/writer.js`, sent by `api/photon/text.js` |
| Sunday 7pm | Four lines: gone and left, kept, the bill due or the biggest one, one line of her. Closes the week. | `weeklyStatement`, sent by the ticker in `api/photon/schedule.js` |
| Last day of the month 7pm | A summary: spent and kept, needs covered, sent home, against last month. | `monthlyStatement`, same ticker |
| You text her | She answers from the same `week()` the badge and the card read, so the two never disagree. | `api/photon/inbound.js` |

What she understands when you text: "how much do I have left" (and "what's left", "left?", "wetin remain"), "move 40 to savings" (and "save 25", "put 10 away"), "send 50 home" (and "send $50 to mum", "transfer 30 to family"), a greeting, a thank you. Anything else gets one line in character telling you the two things she does. A verb with no amount asks for the amount. Saving more than what is left is refused with the number. Money home is never capped and never scolded. Every action carries the message id as `requestId`, so a redelivered text never moves money twice.

House rules, enforced in `text.js` so no caller can forget them:
- Quiet 11pm to 7am for anything she starts herself. Replies and the onboarding tap always go.
- One unprompted text per person every three minutes (`PHOTON_GAP_MS`). AppleScript sends are slow.
- One unprompted text a day per person on top of the statements (`PHOTON_DAILY_CAP`; `0` turns it off for rehearsals).
- `PHOTON_TO` unset means she never texts anyone, whatever a caller passes. The UI reads `texted: false` and `ok: false` and says "Texts are off right now". Never a fake sent state.

## Routes

```
POST /inbound          { id, from, text }                 -> { reply, intent, action, texted, week }
GET  /schedule                                            -> what is due, next weekly and monthly, last sent, grandma
GET  /schedule?now=1&grandma=nana                         -> send the weekly statement now; remembers who texts
POST /schedule         { now: true, grandma?, kind?, to? } -> same, for callers that would rather post
GET  /photon/health                                       -> { configured, kit, db, ready, inbound, quiet, reason }
```

`ready` means she can send. `inbound` means the kit can also read this Mac's database, which the pipe needs. Onboarding screen 07 calls `/schedule?now=1` and shows the `text` it returns only when `ok` is true.

## The Mac, once

1. Node 20 or newer. `npm install` at the repo root pulls the kit and `better-sqlite3`.
2. Messages signed in. The plan says a spare Apple ID; a personal one works and texts come from that number.
3. Full Disk Access for the terminal app you run the API from: System Settings, Privacy and Security, Full Disk Access. Quit and reopen the terminal after.
4. First send pops an Automation prompt ("Terminal wants to control Messages"). Allow it.
5. Mac awake and unlocked for the whole demo. Caffeinate it: `caffeinate -dims`.
6. `api/.env`: `PHOTON_TO=+1XXXXXXXXXX` (the judge's iPhone, E.164). `PHOTON_ALLOW` defaults to that number; set `*` to answer anyone who texts the Mac.

## Run and check

```
npm run api                                   # the brain, with the statement ticker
npm run imessage                              # the pipe: watches Messages, posts to /inbound
node apps/imessage/index.js --status          # can she text, what is due
node apps/imessage/index.js --test            # sends the weekly statement to PHOTON_TO now
PHOTON_DRY=1 npm run api                      # rehearse: everything decided and logged, Messages never touched
```

Check before judging: `--status` shows `ready: true` and `inbound: true`. `--test` buzzes the phone. Text the Mac "how much do I have left" and watch the pipe log the reply.

## Known edges

- Kit 3.0 queries `message.ck_chat_id`, a column macOS 15 does not have, so it sends but cannot read. Pinned to 2.1.2, which does both on macOS 15.7. Try 3.0 again only on a newer macOS.
- `send()` resolves when Messages.app accepts the AppleScript, not on delivery. A number that is not on iMessage shows as sent here and fails in Messages (error 22). Only iPhones get the text.
- The pipe only answers direct messages, never groups, never reactions. It dedupes by message guid in `data/photon-seen.json`.
- If the pipe dies the extension and the API keep working; only two way stops. If the API dies the pipe retries on the next text.
- Photon Spectrum (their hosted framework) needs no Mac but signup turnaround is unverified. Not for the demo.
