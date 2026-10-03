# How Clicky makes onboarding feel like an experience, and what Mama takes from it

Source: the HeyClicky.app bundle on Praise's Mac, Oct 3 2026. Page sequence from the Swift view names, rules from the model prompts compiled into the binary, sound cues from the resource folder with measured lengths, intro video sampled at one frame per six seconds. Not an article about Clicky; the thing itself.

## 1. The sequence, in order

| Step | What Clicky does | Evidence |
|---|---|---|
| Hatch | The character hatches and flies into the notch before a word is said | `IntroHatchFlightView`, `hatching.wav`, `HatchPowerUpWiggleValues` |
| Founder intro | Two minute single take of the founder talking to camera, progress bar along the bottom, background music with a toggle, skippable | `onboarding-intro-v2.mp4` 117s, `musicToggleButton`, `ff.m4a` |
| Interview | A voice conversation, about five questions. One fixed opener, one fixed closer, everything between comes from what you just said. Pulls out one real goal. Skip at any point with one friendly line | `OnboardingInterviewStage`, prompt text below |
| Squad | A prebuilt starter set of helpers. "Use this squad for your Clickys. You can customize them later." | `OnboardingSquadPicker` |
| Tutorial | Voice hello, mic check, speaker check, dictation, text mode, draw to ask, draw demo (it points at your screen), email draft. Each page is one action with an immediate payoff | `OnboardingTutorialView` pages |
| Reveal | Each helper is introduced with a line that quotes you: "You said your goal is that first hundred dollars, so this one finds the people who'll buy your first shirt." | `clickyRevealPage`, `reveal_line` |
| Finale | "You're all set. Ready for your Clickys." then "Try it out! Hover your Mac's notch up top and you'll see me in my new home." | `finalePage`, `home-reveal.wav` |
| Next morning | One good morning bubble with suggested work, once a day, only if you are at the keyboard and not busy | `MorningGreeting`, greeting bail rules |

Order matters: it learns you first, teaches you second, and only shows what it made for you at the end, in your own words.

## 2. The rules inside its prompts, verbatim where it counts

- "Never ask for or expect their name; if they shared it, greet them by it and have a tiny bit of fun with it."
- "HARD RULE: do NOT introduce yourself on this turn in any form... saying it twice sounds broken."
- "Every turn after the opener is NOT a script... Each question comes FROM what they just said: react to their actual words first, specifically, then ask the one thing that answer makes you curious about."
- "be more pushy to find a real goal; it doesn't have to be a number, it could be a thing, an event, anything."
- "if at ANY point they ask to skip... ONE short friendly line with no question in it, then call skip."
- "Never say it is working, starting, or on it." The new helper's chat opens with tappable first messages; it never claims progress it has not made.
- "one playful, specific quip about what they said (never generic assistant pleasantries, never forced jokes; charming over comedian)."
- Names: "two friendly words that say the job... never the user's own name... never a dash."
- Founder notes with dates are compiled into the prompts: "(Farza 2026-09-09)". The person who built it is literally in the product's instructions.

## 3. Sound

Seventeen short cues, all between 0.5 and 1.8 seconds, each tied to one moment. A global toggle. Music only during the tour, with its own toggle.

| Moment | File | Length |
|---|---|---|
| She appears | hatching, reveal-boot, home-reveal | 1.4s to 1.8s |
| She asks | clicky-question | 0.85s |
| She is surprised | clicky-surprised | 0.50s |
| A helper starts, finishes, needs you, closes | agent-launch, agent-done, agent-needs-you, agent-close | 0.8s to 1.1s |
| Text open, close, send, receive | clicky-text-* | 0.5s to 0.85s |
| Something got better or worse | skill-up, skill-down | 0.8s |
| A thumbs up | tapback-thumbs-up | short |

The surprise sound is the shortest. The arrival sounds are the longest. That is the right ratio: big moments get room, reactions get a blink.

## 4. What Mama takes, and what she inverts

Mama is not a voice assistant and the pattern is not copied wholesale. Seven moves.

**1. Arrival before words.** Clicky hatches. Mama's badge arrives: on the welcome screen the gele badge slides in from the bottom right with the arrival sound before any copy. Same on the first cart of a session, a quiet version.

**2. The interview, inverted.** Clicky asks five questions to learn you. Mama asks two and reads the rest from the ledger. That is the whole pitch of screen 05: "Give me a second" while she reads 19 purchases. We say it out loud on screen 03: "You don't need to tell me. I'll look."

**3. The reveal line formula.** "You said X, so this one does Y." Mama's version uses what she saw, not what you said. New screen 06b, "Here's what I'll watch," three rows built from the top want merchants:
- "You spent $102 on food delivery, so when DoorDash is open I'll say something."
- "$55 on a hoodie, so new clothes get one question first."
- "$20 on coffee. That one I'll leave alone unless it grows."
Three watches, personal, from data, in one sentence each. This is Clicky's squad reveal with the ledger as the interviewer.

**4. Hear her before you pick her.** Clicky ships 25 voice preview mp3s. Screen 03 gets a small "Hear her" under each grandma that plays one cached line in her ElevenLabs voice. Cheap, and it makes the pick a feeling instead of a radio button.

**5. The practice is the finale, not the preface.** Clicky teaches after it knows you, then ends on "Try it out." The practice cart (screen 01) moves to the end: "Go shopping" opens it, she asks about the AirPods there, and the page ends with "Now open a real one." Welcome stops saying "That was me" and becomes the hatch.

**6. The first time you hear her, she says something true.** Clicky's tutorial has you hear it for the first time and it says something back about you. Mama's first spoken line is the true line on "Here is what I saw," played once on arrival from a cached mp3: "Last 30 days: one hundred and two dollars on food delivery. Rice was twenty four. We need to talk." Hear her on the pick screen covers the voice setup, so by this screen the speaker is already working.

**7. Six sounds, not seventeen.** Arrive 1.2s, ask 0.6s, surprised 0.4s, proud 0.9s, text received 0.5s, kept ticked up 0.4s. No music; her voice is the music. One toggle in settings. Nothing plays during quiet hours.

Rules adopted into `lines/writer.js` and the onboarding copy:
- Never ask the user's name. Nessie gives us the first name; use it once on the "Here is what I saw" screen and never again.
- Never introduce her twice. Welcome introduces; no later screen says "I'm Mama."
- Never claim she did something she did not. "Text me what you saw" sends a real text; if Photon is down the button is disabled with "Texts are off right now," not a fake sent state.
- Skip is one line, no question. Every onboarding step after grandma has "Not now" and it never argues.
- React to their numbers first, then ask. The true line before the envelope.

## 5. What we do not take

The two minute founder video. Our maker moment is the two mothers who labeled the cases, stated in one line on the pick screen. A video of us would be a video of us.

Morning greetings. Mama's one unprompted text a day plus the Sunday statement is already the rule; a daily hello would make her a notification.

The music. A budget tool with a soundtrack is a toy.

## 6. Changes this makes to the build

- Onboarding gains one screen (06b, what I'll watch) and reorders the practice cart to the end. Ten popup frames plus the practice tab.
- `GET /month?history=30` already returns `topWants`; the three watch lines are written from it in `lines/writer.js` as `watchLines(topWants)`.
- Six cue sounds in `apps/extension/public/sounds/`, generated or recorded tonight, under 50 KB each. Played from the offscreen document like the voice.
- Arrival animation on welcome and first cart: 600ms, decelerate in, from 24px below, with the arrive sound. Reduced motion skips the slide and keeps the sound.
- "Hear her" needs two cached mp3s before 11:30pm, one per grandma, from the ElevenLabs route.
