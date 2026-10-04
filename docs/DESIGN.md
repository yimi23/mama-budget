# Mama Budget design spec

Built from how Grammarly, Monzo, Cash App, Copilot, Monarch, YNAB, Duolingo and Mailchimp actually do it. Numbers with no public source are the range the teardowns converge on.

## Sizes
- Popup: 400 x 560. Chrome hard cap is 800 x 600; the good ones sit at 360 to 400 wide. Width set on body, min height not height, no vh or vw.
- In page card: 360 wide, max height 480, position fixed, 24px from the right and 112px from the bottom (above the badge, as screens 12 to 15 draw it), inside a shadow root with `all: initial` on the host, z index 2147483647. Card buttons are radius 10, as the screens draw them.
- Badge on the page: 64px circle, 3px gold ring, the gele meter as a 6px bar to its left, 24px from the right and bottom (screens 10 and 11).
- Icons: our own, inline stroke SVG. 16, 32, 48, 128 for the extension icon.
- The product mark (toolbar, Web Store, Devpost) is the ring and the meter on the cream tile (`apps/extension/public/icon/mark.svg`): her presence in the corner, not her face and not a letter. Decided Oct 4 after an M read as Gmail.

## Type
- Brand font for brand moments only: Bricolage Grotesque 800. Headlines in the popup, the wordmark, the pitch.
- System font for everything functional (the phone's own font in app, system ui in the extension).
- Scale: 32 display, 20 title, 16 body (14 in the in page card, 13 floor), 12 caption. Line height 1.25 headlines, 1.45 body.
- Tabular digits on every money number. Numbers inside sentences, never stat tiles.
- Sentence case everywhere. No uppercase section labels.

## Color
- Ground: cream #FBF8F3. Ink: #22172A. Lines: #EADFCB. Muted text: #5E566B.
- Buttons are ink on cream. Brand color never goes on a button.
- The only color on a screen is her: gele green #0F7B5A, gold #E2A12A, coral #D4462C for alarms, mint #DDF1E8 behind Mama, orange #F2854A behind Nana.
- Meter color is state: green under 75%, gold watching, coral when a purchase would blow it.
- No gradients, glows, glass, or gradient text. Real photos where a photo is needed.

## Shape
- 8px grid, 4px half step.
- Radius: 8 inputs, 12 lists and cards, full pill for the one primary button, circle for the badge.
- Inset grouped lists like the phone's Settings. No cards inside cards. No icon tiles on rows.
- One primary button per screen. Secondary action is plain text.

## Motion
- 150ms button states. 250 to 300ms card enter. 300ms badge shake on Shocked. Gele tween 600ms.
- Enter: cubic-bezier(0.05, 0.7, 0.1, 1). Exit: cubic-bezier(0.3, 0, 0.8, 0.15). No bounce.
- Motion only on a user action or a mood change. Nothing idles.

## Mascot rules
- She has a job on every screen she is on, or she is off it. Welcome (introduce), pick your grandma (choose), win (feedback), the cart (feedback). Not on setup forms.
- Never on the bank screen or any screen where money is connected or confirmed. That screen is plainer than the rest on purpose.
- A face change always means a state change. Expressions are feedback, not wallpaper.
- Flat color behind her, never a busy background. Room to breathe at any size.
- Peeking from a corner for small moments, full width scene only for the two big ones (welcome, win).

## Trust
- Name the data source in words, in real time: "Capital One Nessie. Simulated."
- Show the full number before any commitment.
- Status says something: "$94 left. 16 days. Rent in 4 days." Never "processing."
- Copy sounds like something you would say out loud. No "discover," no "unlock," no slogans.

## Slop tells, banned
Purple or blue gradients. Inter, Roboto, Geist as defaults. Centered hero with a pill badge and two buttons. Three identical cards with icon tiles. Uniform rounding and one shadow on everything. Glass and glow. Emoji as icons. Big stat with small label. Copy that fits any company. The same page order every time.

## Patterns we copy
- Grammarly: badge in the corner, underline the exact spot, one card at a time with two actions.
- Honey: first run demo on a real page with a real number.
- Copilot: demo mode before any bank link.
- Revolut: one ask per screen, example text in the field.
- Monzo: left to spend is balance minus committed, as one sentence with a worked example.
- Monarch Flex: one flexible number instead of many categories.
- Cash App: haptic on every tap in the app, canvas carries the color, buttons stay neutral.
