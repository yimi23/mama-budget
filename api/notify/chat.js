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
const memory = require('./memory');
const notify = require('./index');
const watch = require('./watch');

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

function fallbackReply(text, { week, who, apology, storedPromise }) {
  const bank = bankOf(who);
  const tail = `\n${writer.subLine(week)}`;
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

async function handleIncoming(text, who = 'mama', from) {
  notify.logIncoming(from, text);
  const mem = memory.read();
  memory.addHistory(mem, 'user', text);

  let m;
  if ((m = /\bsend\s+\$?(\d+(?:\.\d+)?)\s+home\b/i.exec(text))) {
    const amount = Number(m[1]);
    const rec = await nessie.transferHome(amount);
    if (rec.nessieId) watch.markSeen(rec.nessieId);
    const week = nessie.week();
    const reply = writer.notifyText('proud', week, { item: 'Sent home', price: amount }, who);
    memory.addHistory(mem, who, reply); memory.write(mem);
    return { reply, mood: 'proud' };
  }
  if ((m = /\bmove\s+\$?(\d+(?:\.\d+)?)\s+to\s+savings\b/i.exec(text))) {
    const amount = Number(m[1]);
    const rec = await nessie.moveToSavings(amount);
    if (rec.nessieId) watch.markSeen(rec.nessieId);
    const week = nessie.week();
    const reply = writer.notifyText('proud', week, { item: 'Moved to savings', price: amount }, who);
    memory.addHistory(mem, who, reply); memory.write(mem);
    return { reply, mood: 'proud' };
  }

  const week = nessie.week();
  const apology = APOLOGY.test(text);
  const promiseText = extractPromise(text);

  let reply = await writer.modelReply({ who, userText: text, week, history: mem.history, promises: memory.activePromises(mem) }).catch(() => null);
  if (!reply) reply = fallbackReply(text, { week, who, apology, storedPromise: promiseText });

  if (promiseText) memory.addPromise(mem, promiseText);
  memory.addHistory(mem, who, reply);
  memory.write(mem);
  return { reply, mood: apology ? 'calm' : week.mood };
}

module.exports = { handleIncoming };
