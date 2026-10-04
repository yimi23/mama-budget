# Mama Budget

**You set the fun money for the week. She holds you to it, in your cart, before you pay, not after.**

Budget apps sort your money by store, so a Target run is just "shopping," and they tell you after the money is gone. Mama is a Chrome extension that sits in the corner like a spell checker. Add rice, nothing happens. Add AirPods, her gele rises and she speaks up before checkout. Money sent home to family never sets her off.

Built at MHacks 2026 by Praise Oyimi and Ugonna Emeka-Inegbu. Tracks: FinTech (main), Useless AI, Dumbest Idea, Judged by an LLM. Sponsors used: Capital One Nessie, Photon, ElevenLabs.

## How it works

1. **Extension** (`extension/`) reads the cart on amazon.com and target.com.
2. **Judge** (`api/judge/rules.js`) decides need, want or ask, and how bad. Deterministic rules. The model never classifies.
3. **Bank layer** (`api/nessie/`) is Capital One's Nessie. It holds a month of history, posts the charge when you tap Buy anyway, and returns how much of the fun budget is gone. Falls back to a local cache so the demo never stalls.
4. **Her line** (`api/lines/`) is written in character, spoken through ElevenLabs (`api/voice/`), and texted to your iPhone through Photon (`api/photon/`) when the budget blows.
5. **Her face** animates inside the badge card. Gele height is the meter.

## Three house rules

1. Need never sets her off. Rent, food, school, medicine, money home.
2. You pick how loud, from Gentle Auntie to Full Nigerian Mother.
3. Every scolding ends with love.

## Is she right? The 50 case test

We froze 50 anonymized purchases before writing any rules, had three mothers label each one privately (Need, Want, Depends), and ran the frozen judge against their majority. We compare against a frozen merchant category map, the way a bank app would label the same purchases. Protocol and raw labels are in `data/`. Run it:

```
npm run score
```

Reported as agreement with our participating mothers, not objective truth. Development results from the first rater are in `docs/RESULTS.md`.

## Run it

```
cp .env.example .env        # keys are optional, everything degrades gracefully
npm run seed                # seeds the demo student with a month of history
npm run api                 # http://localhost:8787
npm test
```

Load `extension/` as an unpacked extension in Chrome (chrome://extensions, Developer mode, Load unpacked). Open amazon.com/cart or target.com/cart, logged in. Add things to the cart.

## Judging criteria, mapped

- **Innovation:** item level need versus want, judged before payment, delivered by a character you already know. The bank sees one Target charge; Mama sees rice and AirPods.
- **Technical complexity:** live cart reading on two real retailers, a deterministic judge with a published test, a simulated bank layer with fallback, voice and iMessage delivery, animated mascot.
- **Usability:** zero setup for the user. She shows up where you already shop. Two buttons.
- **Adherence to theme:** FinTech that changes behavior at the moment it matters, with a measured claim.

## What is not here

Plaid. Real bank linking. Real purchases on real sites (Buy anyway posts to the simulated bank). A phone call. Any third retailer.
