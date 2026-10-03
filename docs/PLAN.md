# Mama Budget: the plan, locked

MHacks 2026. Team: Praise Oyimi, Ugonna Emeka-Inegbu. Due Sunday Oct 4, 12:15pm EDT.

## The aim, one sentence

Stop people from wasting money at the moment it happens, by giving them someone who cares enough to say something.

Everything below serves that sentence. The cart reader, the bank, the texts, the voice are how she gets to the moment. They are not the product. If a feature does not make the pause at checkout more likely, or the praise after saving more real, it is cut.

The unit of success is money kept, not money tracked. Her hero number is "Kept this week," and it only goes up when you put something back, move money to savings, or send it home.

## What hooks people, and how she does each one

Learned from the one app that made ours feel mundane. Six hooks, each with Mama's version and where it lands in the build.

1. **Setup is an experience, not a form.** She should know you before you have typed anything. The moment the bank connects she reads your last 30 days from the ledger and says one true thing: "Last month: $212 on food delivery. Rice was $14. We need to talk." Then she proposes your weekly fun envelope from what she saw (a week of your wants plus room to breathe, $75 for the demo student), you adjust it, you do not type it from zero. Grandma and loudness are the only two questions she asks you. Everything else she works out and shows you. (Onboarding, screens 01 to 09 redrawn to this flow.)
2. **Real work on day one.** Before onboarding ends, your phone buzzes. It is her first statement, built from the month she just read, while you are still in the popup. You got value before you shopped once. (Onboarding step "she reads your month" fires `/schedule?now=1`.)
3. **The maker is in the product.** Two real mothers labeled the 50 items she learned from. That is on the pick screen in one line and on the site: "Checked against two actual mothers. She agreed with them 81% of the time. Your bank's categories managed 69%." Not a founder video, a founder's mother.
4. **She is alive.** Three sounds, each under 400ms, no music: a soft tap when she asks, a short inhale when she is shocked, a low warm hum when she is proud. Her voice only on Shocked and Gele down. The badge breathes (2px scale over 4s) while watching and stops when calm. The face blinks every 6 to 9 seconds. Nothing else moves. Silent apps feel dead; noisy apps feel cheap.
5. **One clear magic moment.** You add something you do not need. She asks. You admit it. She speaks, and your phone buzzes in your pocket at the same time. One action, two places, obvious payoff. The whole demo is built to land this once, cleanly.
6. **She lives where you already are.** In the cart and in Messages. The popup is for settings and the Kept number, nothing else. You never go to her, she is where the money leaves.

## What this changes in the build

- Onboarding order becomes: Welcome (she arrives, then speaks), Who's checking on you (grandma, with Hear her), Connect the bank, She reads your month (live, from the ledger, 3 seconds), Here is what I saw (one true line, spoken, her first words out loud, plus the proposed weekly envelope), Here is what I'll watch (three watches from her own month), Your phone, Check your phone (first statement already there), How loud, Go shopping (Kept this week), then the practice cart as the finale. The Clicky study behind this is docs/research_clicky_onboarding.md.
- The home panel hero is "Kept this week" in large tabular digits, then the meter, then the last three things she said. No charts.
- Praise is designed as carefully as scolding. Put an item back and she says one line and the Kept number ticks up on screen. Move money to savings by text and she replies with the new Kept number. The proud sound plays on both.
- The site leads with the why in three word headlines: "Before, not after." "Rice is fine." "Kept, not spent." The reader layers go in a technical section at the bottom, not the hero.
- Pitch opens on the aim, not the tech: "Budget apps tell you after the money is gone. We built someone who says something before."

## One line

Mama watches your fun money. In your cart before you pay, and in your Messages after.

## The problem

Budget apps sort money by store, so a Target run is "shopping" whether you bought rice or AirPods. They alert you after the money is gone, in a chart nobody opens. What is missing is someone who cares enough to say something at the moment it happens. For a lot of us, that was our mum.

## Who it is for

International and first generation students living on a student budget in one currency while thinking in another. Money sent home is family, not spending. Mama treats it that way, and when she scolds a $7 coffee she tells you what that $7 is in naira.

## In budget app terms

A one envelope budget (fun money for the week, Monday to Sunday), item level categorization, a pre purchase alert, and a character instead of a dashboard.

- Protect the needs. Rent, food, school, medicine, money home. Never counted, never scolded.
- Watch the wants envelope. One number: how much of this week's fun money is gone. Quiet under 75%, watching above, loud when a purchase would blow it.
- Celebrate the savings. Money left in the envelope, moved to savings, or sent home gets praised.

Cut on purpose: reports, charts, bill tracking, shared budgets, real bank linking, multiple categories.

## Where she lives

1. **The cart.** A small badge in the corner of the cart page, Grammarly style. Face shows mood, a thin bar shows the gele meter. Needs never open anything. A want at severity 2 or higher opens her card: face, one line, one sub line with the number, two buttons. "You're right, Mama" removes the item with the site's own button. "Buy anyway" posts the charge to the bank and she reacts. On a Depends item the card asks instead, and the second button reads "It was for a reason."
2. **Messages (Photon iMessage).** Weekly statement Sunday 7pm, four lines, closes the week. Monthly statement last day of the month, a summary. One text when a purchase is bought anyway or the budget blows. A proud text when earned. Two way: text her "how much do I have left" and she answers with the number, days left, and one line.

Rules for Messages: one unprompted text a day plus the Sunday statement, quiet hours 11pm to 7am, statements are numbers with one line of her at the end, every text names the amount, and if you go silent two weeks she sends one line and stops.

## Pick your grandma, then how loud

First run she asks two questions and never defaults either. Mama (Nigerian, gele is the meter, naira line on) or Nana (Midwestern, glasses are the meter, no conversion). Then Gentle Auntie, Mama, or Full Nigerian Mother. The dial changes her mouth, never her math. Statements go out at every setting.

## Three house rules

1. Need never sets her off.
2. You choose your grandma and how loud.
3. Every scolding ends with love.

## How she talks (the anti cringe rules)

Scold the receipt, never the person: every loud line names the amount and the item. Her enemy is the price, not you. One cultural marker per line at most. Accent is never the joke; Pidgin only when emotion peaks. No slipper, no "you always," no scammer or prince tropes. She remembers: if you said an Uber was for a reason last week she does not ask again. Praise states outnumber loud states. Lines come from real mothers (our own) shaped, not invented. Sources: Cleo roast mode is opt in; Duolingo's hard stop; Nass on Clippy; Breines and Chen on compassion after failure; Taaooma and Folagade Banks on writing one real mother.

Her lines live in api/lines/writer.js.

## Is she right? The 50 case test

50 purchases frozen before any rule was written. Three mothers label each privately: Need, Want, Depends. The frozen judge runs against their majority. A frozen merchant category map is the baseline, the way a bank app labels the same purchases. Reported: agreement on clear cases, need safety breaches (target zero), ask rate on unclear cases, rater split count, and the baseline on the same denominator. Said on stage as "agreement with our participating mothers," never "objectively correct." A synthetic 50 rater panel exists in data/synthetic for dry runs only and is never quoted as mothers.

Development results after two raters: Mama 26/32 on clear cases, baseline 22/32, zero need breaches, 15 of 50 split. Both mothers labeled money sent home as Depends or Want, against our hard rule. We report that, we do not hide it. Rules stay frozen for v1. A v2 may be written from what the mothers taught us and tested on a fresh set only.

## The demo (about 90 seconds, the judge drives)

1. Judge adds rice and soap on amazon.com. Badge stays calm. "She reads the item, not the store."
2. Judge adds AirPods. Badge shakes, card opens, gele climbs, she speaks. Let the room hear her.
3. Judge taps Buy anyway. Charge posts to Nessie, gele falls. Their iPhone buzzes with her text.
4. Judge texts her "how much do I have left." She answers live.
5. Judge taps Send $50 home. Nothing. Then Proud.
6. One slide: Mama vs our mothers vs the bank's category map. Real numbers.

If the Target.com reader is working by Sunday 8am, beats 1 to 3 happen on Target.com instead. Same component. If not, nobody knows.

## How it is built

- **Mama component.** One UI, badge plus card plus face animation, mounted in our store page first. The extension wraps the same component for Target and Amazon and is the last thing attempted.
- **Judge.** Deterministic rules: label, severity, react, mood, reason. The model never classifies. Tested.
- **Bank layer.** Capital One Nessie. Seeded 30 days leave the student at $50 of a $75 weekly envelope, with $102 on food delivery over the month as the true line. Buy anyway posts a purchase. Fun money spent is recomputed from the ledger, never incremented in the UI. Local cache fallback.
- **Her line.** Fixed line bank, or the model writing in character from the verdict. Spoken through ElevenLabs. The card never waits on audio.
- **Messages.** Photon on a dedicated Mac, spare Apple ID. Statements on a schedule, event texts from the judge, two way replies from the same "what's left" function the card uses so they never disagree.

## Prizes

FinTech track ($2,500). Capital One Nessie. Photon iMessage Agents. Useless AI. Dumbest Idea. Judged by an LLM (README, tests, the score, this plan).

## Split

Praise: store page, Mama component and animation, her lines and voice, mothers' labels, Devpost page, pitch. Ugonna: API, judge, Nessie, Photon two way and statements, scoring script, tests, README.

## After MHacks

Mama becomes the personality inside Tsends. WhatsApp instead of iMessage (that also covers Android), naira, remittances and family contributions. The hackathon is a free test of whether a room of students laughs and says they would use her.

## Cut

Plaid. Twilio. Real purchases on real sites. Nana animation (static art, pick your grandma screen only). Any third retailer. Reports. Bill tracking.

## Merge with Ugonna's brief (docs/BRIEF_from_ugonna.md), Oct 3 evening

Taken in: balance and upcoming bills from Nessie in the mood rules ("rent is due in four days"); generic cart detection (URL and page text, model extracts items, no per site selectors) with our store as the guaranteed fallback; setup panel (grandma, loudness, bank, budget, savings goal, phone); extra prizes: Figma Best Design, MLH .tech domain, ElevenLabs track, Notability. Useless AI stays in.

To settle between Praise and Ugonna tonight:
1. The split. Brief says Praise codes, Ugonna owns design, faces, voice, lines. Board says the reverse.
2. Labeling. Resolved as: model extracts items from page text, rules label them, unknown items become Ask. The model never decides want.
3. Blocking checkout. Resolved as: card may sit over the button, Buy anyway always works. The voice argument is stretch.
4. Messages. Statements and two way replies added to the brief's after charge text.

Deadline: work to 12:00, submit before 12:15 PM EDT.

## Domains
mamabudget.com (owned) is the home: landing page, Devpost link. mamabudget.tech is registered during the hackathon for the MLH Best .Tech Domain prize and points at the same page.

## How she knows need from want (decided Oct 3, 4:20pm)

She does not. Nobody does: our two mothers disagreed on 15 of 50 purchases. So Mama never claims to know. She does what a real mother does:

1. **Protects the obvious.** Rent, bills, groceries, medicine, school, money home. The cases where both mothers and the bank agreed. Never counted, never scolded.
2. **Asks about the rest, once.** A new item above $15 gets a neutral question: "AirPods? What for?" Two answers. "It's for something" makes it a need for you, forever. "I just want them" gives her the right to react. She only scolds wants you admitted yourself.
3. **Remembers.** Your answer becomes a standing rule. She never asks about the same item twice. A quiet "not this time" handles the week you buy a TV at Target without reopening the question.
4. **The envelope decides if she speaks.** Even an admitted want is fine if it fits the fun money. The label only picks the pile. The number decides the volume.

At setup she asks what you are saving for. Planned buys never set her off.

Why: YNAB, Warren's 50/30/20 and Ramit Sethi all leave need vs want to the person. Plaid admits merchant categories are a guess. Reflection prompts reduce impulse buying where timers and warnings do not (Moser; Rice). If then rules have a medium to large effect (Gollwitzer). Autonomy supported choices stick (Deci and Ryan). The ask must be neutral: no gele movement, no roast, or people answer to pass the test.

Rules: v1 (api/judge/rules.js) stays frozen for the 50 case score. v2 (api/judge/rules_v2.js) is the ask and remember model, tested only on a fresh set. The slide says: where mothers agreed, Mama agreed 26 of 32 times. Where mothers disagreed, Mama asks.

Pitch line: she protects the obvious, asks about the rest, and remembers.

## Rubric check (Oct 3, 5pm)

MHacks theme is "Build something that grows." Theme line: **She grows with you.** Every answer you give her, she keeps. Your savings grow. Say it on Devpost, the site, the first slide.

MHacks criteria, equal weight: Innovation (item level, ask once, remember, a character not a dashboard), Technical Complexity (rules judge, Nessie seven resources, generic cart extraction, ElevenLabs, Photon two way, runnable scoring harness), Usability (two buttons, text and voice so it works with sound off and screen readers, 44px targets, 4.5 to 1 contrast), Theme (she grows with you).

Sponsors: Nessie uses customers, accounts, purchases, deposits, transfers, bills, merchants. Photon: two way plus one action ("move $40 to savings" by text). ElevenLabs scores Real World Impact and conversational agents: spoken lines qualify, voice reply at checkout is stretch. MLH judges: Technology, Design, Completion, Learning, equal, gut allowed. Completion means the demo works first try.

Real world use: a named user (international and first gen students at Michigan who send money home), a quantified claim (the 50 case score), an admitted limit (two retailers, simulated bank, one envelope, on purpose).

Money, one line each: Free (cart plus Sunday statement). Full $2.99 a month, about N4,800 (voice, texts, two way, Nana, Full Nigerian Mother). Tsends (WhatsApp, naira, the real business). Later: your bank's Mama, licensed to credit unions on their own data. Judges score path to users, not revenue. Twenty seconds, then back to the demo.
