// Two way. A text comes in, she answers from the same numbers the card uses, and acts when asked.
// The pipe (apps/imessage) posts { id, from, text } here and we reply to `from` through text.js.
// parse() is pure so the understanding is tested without Messages. Acting goes through nessie/client.js
// with the message id as requestId, so a redelivered message never moves money twice.

const nessie = require('../nessie/client');
const { whatsLeft } = require('../lines/writer');
const { textLine } = require('../lines/texts');
const { text, readState } = require('./text');

const NUM = '\\$?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:dollars?|bucks|usd)?';

/**
 * What did they ask for? One of:
 *   { intent: 'left' } | { intent: 'save', amount } | { intent: 'home', amount } |
 *   { intent: 'save' | 'home', amount: null } (verb without a number) | { intent: 'hello' } | { intent: 'thanks' } | { intent: 'unknown' }
 */
function parse(raw) {
  const t = String(raw || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) return { intent: 'unknown' };
  if (/\b(how much|what'?s|what is|wetin|how far)\b.*\b(left|remain|have|dey)\b/.test(t) || /\b(left|remaining|balance)\b\s*\??$/.test(t) || /^(left|balance)\??$/.test(t)) return { intent: 'left' };
  const amt = (m) => (m ? Number(m[1]) : null);
  if (/\b(sav(e|ings)|keep|put\b.*\baway|stash)\b/.test(t) && !/\bhome\b/.test(t)) {
    return { intent: 'save', amount: amt(t.match(new RegExp(NUM))) };
  }
  if (/\b(home|mum|mom|mama|mummy|dad|papa|family|village|send)\b/.test(t) && /\b(send|transfer|home|family|village)\b/.test(t)) {
    return { intent: 'home', amount: amt(t.match(new RegExp(NUM))) };
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|mama|nana)\b/.test(t)) return { intent: 'hello' };
  if (/\b(thank|thanks|thx|ok|okay|yes ma|noted)\b/.test(t)) return { intent: 'thanks' };
  return { intent: 'unknown' };
}

// Decide the reply and do the deed. { reply, action } with action one of null | 'saved' | 'sent home'.
async function respond({ id, text: body }, { who = grandma(), now = new Date() } = {}) {
  const p = parse(body);
  const w = nessie.week(now);
  const left = Math.max(0, w.budget - w.spent);
  if (p.intent === 'left') return { reply: whatsLeft(w, who), action: null, intent: p.intent };
  if (p.intent === 'save' || p.intent === 'home') {
    if (!(p.amount > 0)) return { reply: textLine('nothing', { who }), action: null, intent: p.intent };
    // Money to family is never waste and never capped. Savings comes out of fun money, so it cannot pass what is left.
    if (p.intent === 'save' && p.amount > left) return { reply: textLine('tooMuch', { amount: p.amount, left, who }), action: null, intent: p.intent };
    const requestId = id ? `imsg-${id}` : undefined;
    if (p.intent === 'save') { await nessie.moveToSavings(p.amount, requestId); return { reply: textLine('saved', { amount: p.amount, left, who }), action: 'saved', intent: p.intent, amount: p.amount }; }
    await nessie.transferHome(p.amount, requestId);
    return { reply: textLine('home', { amount: p.amount, left, who }), action: 'sent home', intent: p.intent, amount: p.amount };
  }
  return { reply: textLine(p.intent, { left, who }), action: null, intent: p.intent };
}

// Which grandma answers texts. The extension tells us on the first statement (/schedule?now=1&grandma=nana); mama until then.
function grandma() { return readState().grandma === 'nana' ? 'nana' : 'mama'; }

// Route body: the pipe's message. Replies are prompted, so quiet hours and caps do not apply.
async function handleInbound(body) {
  const from = String(body.from || body.participant || '').trim();
  const id = String(body.id || '');
  if (!from || !body.text) throw new Error('from and text are required');
  const out = await respond({ id, text: body.text });
  const sent = await text(out.reply, { to: body.chatId || from, prompted: true });
  return { ...out, texted: !!sent, week: nessie.week() };
}

module.exports = { parse, respond, handleInbound, grandma };
