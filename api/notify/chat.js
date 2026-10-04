// The two-way conversation. One entry point, handleIncoming(), used by both the real Photon
// listener and POST /messages/incoming (the log-sender test path), so the logic is identical
// whether or not iMessage is actually wired up.
//
// "send N home" / "move N to savings" do the real Nessie operation and she confirms with the new
// numbers (reusing notifyText, the same text the bank watcher would send for that transfer -- see
// notify/watch.js markSeen(), which keeps the watcher from also notifying the very withdrawal this
// just made). Anything else goes to the model if ANTHROPIC_API_KEY is set, else a fallback that
// still answers from the live numbers, detects an apology, and stores a promise when one is made.

const nessie = require('../nessie/client');
const writer = require('../lines/writer');
const { textLine } = require('../lines/texts');
const { parse } = require('./parse');
const memory = require('./memory');
const notify = require('./index');
const watch = require('./watch');
const schedule = require('../photon/schedule');
const { weigh } = require('./weigh');

const APOLOGY = /\b(sorry|my bad|you.?re right|i.?m sorry|i apologi[sz]e|forgive me)\b/i;

function extractPromise(text) {
  const m = /no more\s+(.+)/i.exec(text) || /not going to\s+(.+)/i.exec(text) || /not gonna\s+(.+)/i.exec(text) || /i promise\s+(.+)/i.exec(text);
  if (!m) return null;
  const subject = m[1].replace(/\s+this week\b.*$/i, '').replace(/[.!]+$/, '').trim();
  return subject ? `no more ${subject} this week` : null;
}

function bankOf(who) {
  return who === 'nana' ? writer.NANA : writer.MAMA;
}

function fallbackReply(text, { week, who, apology, storedPromise, intent }) {
  const bank = bankOf(who);
  const tail = `\n${writer.subLine(week)}`;
  const left = Math.max(0, week.budget - week.spent);
  if (intent === 'hello' || intent === 'thanks') return textLine(intent, { left, who });
  if (storedPromise) {
    const open = apology ? (bank.down && bank.down[1]) || bank.down[0] : (who === 'nana' ? "Okay, hon. I'll hold you to that." : 'Okay. I will hold you to that.');
    return `${open} I will remember: "${storedPromise}."${tail}`;
  }
  if (apology) {
    return (who === 'nana' ? "Okay, hon. I hear you. I love you anyway." : 'Okay. I hear you. I still love you o.') + tail;
  }
  if (/how much|left|budget/i.test(text)) return writer.whatsLeft(week, who);
  return bank.calm[0] + tail;
}

async function handleIncoming(text, who = 'mama', from, messageId, { images = [] } = {}) {
  notify.logIncoming(from, images.length ? `${text || ''} [photo]`.trim() : text);
  const mem = memory.read();
  memory.addHistory(mem, 'user', text);
  mem.lastInboundAt = Date.now(); // the two week silence rule in photon/schedule.js reads this
  schedule.heardFrom();

  // Commands first (notify/parse.js understands the shapes people actually type). A verb with no amount asks
  // for the amount. Saving past what is left is refused with the number. Money home is never capped and never
  // scolded. Every move carries the message id as requestId, so a redelivered text never moves money twice.
  const cmd = parse(text);
  const before = nessie.week();
  const left = Math.max(0, before.budget - before.spent);
  const requestId = messageId ? `imsg-${messageId}` : undefined;
  const say = (reply, mood) => { memory.addHistory(mem, who, reply); memory.write(mem); return { reply, mood, intent: cmd.intent }; };
  if (cmd.intent === 'left') return say(writer.whatsLeft(before, who), before.mood);
  if (cmd.intent === 'save' || cmd.intent === 'home') {
    if (!(cmd.amount > 0)) return say(textLine('nothing', { who }), 'calm');
    if (cmd.intent === 'save' && cmd.amount > left) return say(textLine('tooMuch', { amount: cmd.amount, left, who }), 'watching');
    const rec = cmd.intent === 'home' ? await nessie.transferHome(cmd.amount, requestId) : await nessie.moveToSavings(cmd.amount, requestId);
    if (rec.nessieId) watch.markSeen(rec.nessieId);
    const week = nessie.week();
    const line = textLine(cmd.intent === 'home' ? 'home' : 'saved', { amount: cmd.amount, left: Math.max(0, week.budget - week.spent), who });
    return say(`${line}\n$${week.kept} kept this week. $${Math.max(0, week.budget - week.spent)} left.`, 'proud');
  }

  // A purchase, by words or by photo: reader five. Same judge as the cart, same memory keys, one bubble.
  const weighed = await weigh({ text, images, who, mem, week: before }).catch(() => null);
  if (weighed) {
    memory.addHistory(mem, who, weighed.reply || `(${weighed.react || 'nod'})`);
    memory.write(mem);
    return { reply: weighed.reply, mood: weighed.mood, intent: weighed.intent, react: weighed.react, verdicts: weighed.verdicts };
  }

  const week = nessie.week();
  const apology = APOLOGY.test(text);
  const promiseText = extractPromise(text);

  let reply = await writer.modelReply({ who, userText: text, week, history: mem.history, promises: memory.activePromises(mem) }).catch(() => null);
  if (!reply) reply = fallbackReply(text, { week, who, apology, storedPromise: promiseText, intent: cmd.intent });

  if (promiseText) memory.addPromise(mem, promiseText);
  memory.addHistory(mem, who, reply);
  memory.write(mem);
  return { reply, mood: apology ? 'calm' : week.mood, intent: cmd.intent };
}

module.exports = { handleIncoming };
