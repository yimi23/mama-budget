# Household and the Sunday report: what the research found (Oct 7 2026)

Sources fetched Oct 7 2026: Honeydue support, Qapital Dream Team, Monarch, YNAB pricing, Goodbudget help, Splitwise
KB, Olson/Rick/Small/Finkel JCR 2023, Gladstone publications (Garbinsky and Gladstone 2019; Gladstone, Garbinsky and
Mogilner 2022; Gladstone et al. "Financial shame spirals" 2021), Dai/Milkman/Riis 2014 (fresh start), Fogg Behavior
Model, Duolingo streak blog, Rocket Money Weekly Snapshot, Thaler 1999. Items the fetcher could not reach (Monarch,
YNAB, Copilot, Apple, Strava, Oura help centers; Snuffed site) are from recall and marked so in the agent's memo.

## A. Household
What the apps do: invites by email (Honeydue), link or member-added (Splitwise), shared login (Goodbudget), one plan
for up to six (YNAB Together). Visibility is full (YNAB, Goodbudget, Monarch, Splitwise), chooser (Qapital, Honeydue)
or walled (Zeta). Nobody treats leaving as a first-class flow. Every budgeting app shares one budget; the two-envelopes
plus shared-pot shape needs money movement, which SimpleFIN cannot do.

Evidence: couples randomised to a joint account kept relationship quality while the others declined (JCR 2023);
pooled money shifts spending toward the justifiable (2019); shame drives withdrawal and worse finances (2021), and
naming the person who overspent is the input to that spiral. Shared visibility of the pot is good; per-person
scorekeeping is the risk.

**Model: one pot, one house.**
1. Join by a six-digit code (readable aloud). Two to four members. The join screen says what others will see.
2. The member who opened the house sets the envelope. A change applies next Monday, never mid-week.
3. Everyone sees the envelope, what is left and the week's count. A purchase shows to others as amount, item and
   day, never the name.
4. A kept moment is credited to the house ("The house kept $40"). Streak, grace and jar belong to the house.
5. Leaving is one tap; a leaver's purchases stay as amounts. One member left turns the house back into a solo envelope.

## B. The Sunday report
What people read: headline number first, three to five numbers, one comparison to last week, streak wording that
never calls a miss a failure (Duolingo: milestone animation +1.7% retention; "slack" motivates more than rigid rules),
and one prompt at the end (Fogg: motivation, ability and a prompt together). Mondays are fresh starts (Dai, Milkman,
Riis 2014). Thaler: segregate gains, integrate losses, cancel a small loss against a larger gain, so the jar always
appears beside an overage.

**Text, at most six lines:** headline (kept or over, with the carry), comparison to last week, the one biggest item
(amount, item, day), streak or grace, the jar, and the Monday prompt (the envelope that goes in Monday plus one small
thing). Her one line closes it.

**Report card in the popup, five fields:** week result with the arrow against last week; biggest item; streak with
the grace mark; kept jar; Monday's envelope. No names anywhere, including in a house.

## What we built from this
`api/lines/writer.js` weeklyStatement rewritten to the six lines from `GET /report` (api/budget/report.js: this week,
last week, biggest item with its day, streak, grace used, jar, Monday's envelope); the popup's report card on home;
the house in `api/house.js` with routes `POST /house`, `POST /house/join`, `GET /house`, `POST /house/leave`,
`POST /house/envelope`, and the week route reading the house envelope for members.
