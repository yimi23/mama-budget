// Texting her about a purchase before it happens. "I want to buy AirPods for $249", a screenshot of a product page,
// "should I get this?" with a photo. Reader five: the message is the cart. The judge is the same rules_v2 the
// extension uses, with the same promises: a need gets a nod and no words, a first sighting gets one question and
// then she drops it, an admitted want is weighed against the week, a planned occasion is left alone. What she
// learns here is remembered in memory.items, keyed like the cart's memory, so her later texts can quote it.
//
// Shape of a turn (what the evidence says works in a thread): one bubble, the number first, nothing about the
// person; a want that fits is a thumbs up and a short line; at most one follow up question, then silence.

const v2 = require('../judge/rules_v2');
const model = require('../lines/model');
const writer = require('../lines/writer');
const reasons = require('../judge/reasons');
const { textLine } = require('../lines/texts');

const PRICE = /(?:\$|usd\s?|₦|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)\b|\b(\d[\d,]*(?:\.\d{1,2})?)\s?(?:dollars|bucks|usd|naira)\b/i;
const VERB = /\b(buy|buying|bought|get|getting|cop|copping|order|ordering|want|wanna|should i|can i|could i|thinking (of|about)|how about|what about|worth it|treat myself|splurge|grab|pick up)\b/i;
const YES = /^(yes|yeah|yep|ya|yh|correct|right|that'?s it|exactly|y|ok|okay|sure)\b/i;
const NO = /^(no|nope|nah|wrong|not that|n)\b/i;
const PENDING_MS = 30 * 60 * 1000;
const CONFIRM_BELOW = 0.8;
const CHEAPER_FROM = 25;

/** { text, url } when the same product is cheaper somewhere she fetched, else null. */
async function cheaper(it, who) {
  const c = await model.cheaperOption({ name: it.item, price: it.price, store: it.store }).catch(() => null);
  if (!c || !c.found || !(c.price < it.price - 1) || !c.url) return null;
  return { text: textLine('cheaper', { who, item: it.item, price: c.price, store: c.store, left: it.price - c.price }), url: c.url };
}

/** Could this text be about a purchase? Cheap, so chat.js can ask before any model call. */
function looksLikePurchase(text) {
  return PRICE.test(text) || VERB.test(text);
}

/** "I want to buy AirPods Pro for $249" -> [{ item: 'AirPods Pro', price: 249 }]. Text only, no model. */
function fallbackItems(text) {
  const out = [];
  const re = new RegExp(PRICE.source, 'gi');
  let m;
  let from = 0;
  while ((m = re.exec(text))) {
    const price = Number((m[1] || m[2] || '').replace(/,/g, ''));
    let name = text.slice(from, m.index);
    from = re.lastIndex;
    name = name.replace(/^.*\b(buy|buying|get|getting|cop|copping|order|ordering|want|wanna|grab|pick up|about|of|should i|can i|could i|how about|what about)\b/i, '')
      .replace(/\b(for|at|@|is|costs?|around|about|only|like|priced|price|,)\s*$/i, '')
      .replace(/^\s*(and|also|plus|or)\b/i, '')
      .replace(/^\s*(a|an|the|some|this|these|those|that|myself|me)\b/i, '')
      .replace(/[,;:\-–]+\s*$/, '')
      .replace(/\s+/g, ' ').trim();
    if (price > 0 && name) out.push({ item: name, price });
  }
  return out;
}

const keyOf = (item) => v2.keyOf({ item });

/**
 * The reply to a text (and photos) about a purchase. Returns null when there is nothing to weigh, so chat.js can
 * carry on with the ordinary conversation. `mem` is notify/memory (items, pending); `week` is nessie.week().
 * { reply, mood, react?: 'like', intent: 'weigh' | 'confirm' | 'answer' }
 */
async function weigh({ text = '', images = [], who = 'mama', mem, week, now = Date.now() }) {
  const w = { budget: week.budget, spent: week.spent };
  const left = Math.max(0, w.budget - w.spent);
  mem.items ||= {};
  const pending = mem.pending && now - mem.pending.at < PENDING_MS ? mem.pending : null;

  // 1. She asked something last time and this is the answer: "is this the one?" or "what is it for?"
  if (pending && !images.length && !PRICE.test(text)) {
    mem.pending = null;
    if (pending.kind === 'confirm') {
      if (NO.test(text)) return { reply: textLine('wrongOne', { who }), mood: 'calm', intent: 'confirm' };
      if (!YES.test(text)) return weigh({ text, who, mem, week, now }); // they typed the item themselves
      return judgeItems([pending.item], { who, mem, w, left, now });
    }
    if (pending.kind === 'ask') return answer(pending.item, text, { who, mem, w, left });
  }

  // 2. Items in the text or the photo. The model reads both; without it, the price in the text is the reader.
  if (!images.length && !looksLikePurchase(text)) return null;
  let read = null;
  if (model.ready() && (images.length || looksLikePurchase(text))) {
    read = await model.extractItems(text || 'What is this and how much is it?', images).catch(() => null);
  }
  let items = read && read.items && read.items.length
    ? read.items.map((i) => ({ item: i.name, price: i.unitPrice * i.qty, period: i.period, variant: i.variant, store: i.store, wasPrice: i.wasPrice }))
    : fallbackItems(text);
  if (!items.length) {
    if (images.length) return { reply: textLine('cannotSee', { who }), mood: 'calm', intent: 'weigh' };
    return null;
  }
  items = items.slice(0, 3);

  // 3. A photo she is not sure of is confirmed before it is weighed: a struck price, several products, low confidence.
  if (images.length) {
    const unsure = (read && read.confidence < CONFIRM_BELOW) || items.length > 1 || items.some((i) => i.wasPrice);
    if (unsure) {
      const it = items[0];
      mem.pending = { kind: 'confirm', item: it, at: now };
      return { reply: textLine('isThisIt', { who, item: it.item, price: it.price, store: it.store }), mood: 'calm', intent: 'confirm' };
    }
  }
  return judgeItems(items, { who, mem, w, left, now });
}

async function judgeItems(items, { who, mem, w, left, now }) {
  const judged = await Promise.all(items.map(async (it) => {
    let necessity = null;
    if (model.ready()) {
      const c = await model.classifyItem({ name: it.item, price: it.price, store: it.store || 'a text from them' }).catch(() => null);
      necessity = c && Number(c.confidence) >= 0.8 && c.kind === 'necessity' ? true : c && Number(c.confidence) >= 0.8 && c.kind === 'discretionary' ? false : null;
    }
    return { it, v: v2.judge(it, w, mem.items, { loudness: 'mama', now: new Date(now), necessity }) };
  }));

  // One bubble. The loudest thing first: a blown admitted want, then a question, then the quiet ones.
  const react = judged.find((j) => j.v.react);
  const ask = judged.find((j) => j.v.label === 'ask');
  const fits = judged.filter((j) => j.v.label === 'want' && !j.v.react);
  const needs = judged.filter((j) => j.v.label === 'need');
  const lines = [];
  let mood = 'calm';
  let tapback;

  if (react) { lines.push(writer.lineFor(react.v, react.it, w, who)); mood = 'shocked'; }
  if (ask && !react) {
    mem.pending = { kind: 'ask', item: ask.it, at: now };
    lines.push(textLine('whatFor', { who, item: ask.it.item, price: ask.it.price }));
    mood = 'watching';
  } else if (ask) {
    lines.push(textLine('andThat', { who, item: ask.it.item, price: ask.it.price }));
  }
  for (const j of fits) lines.push(textLine('fits', { who, item: j.it.item, price: j.it.price, left: Math.max(0, left - j.it.price) }));
  if (!react && !ask && needs.length && !fits.length) {
    // Needs alone: a thumbs up, no words. Taste is silence.
    tapback = 'like';
    if (needs.length > 1 || !items.length) lines.push(textLine('needs', { who }));
  } else if (needs.length) {
    lines.push(textLine('needs', { who }));
  }
  if (!react && fits.length && !ask) tapback = 'like';
  // The dearest want she is talking about may be cheaper elsewhere. Found after the verdict goes out, never before,
  // and only a price she fetched. Said as cash back in the week, which is the framing that moves people.
  const dear = (react || ask || fits[0] || {}).it;
  const followUp = dear && dear.price >= CHEAPER_FROM && model.ready() ? () => cheaper(dear, who) : null;
  const reply = lines.length === 1 ? await writer.fresh(who, lines[0], { situation: `$${left} fun money left this week` }) : lines.join('\n');
  return { reply, mood, react: tapback, intent: 'weigh', followUp, verdicts: judged.map((j) => ({ item: j.it.item, price: j.it.price, label: j.v.label, react: j.v.react })) };
}

/** The answer to "what is it for?": an occasion plans it, a need is remembered, a want is weighed now. */
async function answer(it, text, { who, mem, w, left }) {
  const k = keyOf(it.item);
  let kind = null;
  let occasion = null;
  if (reasons.isJustWant(text)) kind = 'want';
  else if (model.ready()) {
    const c = await model.classifyReason({ reason: text, name: it.item, price: it.price }).catch(() => null);
    if (c && c.kind !== 'unsure') { kind = c.kind; occasion = c.occasion; }
  }
  if (!kind) { occasion = reasons.occasionOf(text); kind = occasion ? 'occasion' : 'need'; }

  if (kind === 'occasion') {
    mem.items[k] = 'planned';
    mem.reasons = { ...(mem.reasons || {}), [k]: text };
    return { reply: await writer.fresh(who, textLine('planned', { who, item: it.item, price: it.price, occasion: occasion || text, left }), { situation: `they said it is for ${occasion || text}` }), mood: 'calm', intent: 'answer' };
  }
  if (kind === 'need') {
    mem.items[k] = 'need';
    mem.reasons = { ...(mem.reasons || {}), [k]: text };
    return { reply: await writer.fresh(who, textLine('needNoted', { who, item: it.item }), { situation: `they said: ${text}` }), mood: 'calm', react: 'like', intent: 'answer' };
  }
  mem.items[k] = 'want';
  const v = v2.judge(it, w, mem.items, { loudness: 'mama' });
  if (v.react) return { reply: await writer.fresh(who, writer.lineFor(v, it, w, who), { situation: 'they admitted it is just a want and it blows the week' }), mood: 'shocked', intent: 'answer' };
  return { reply: await writer.fresh(who, textLine('fits', { who, item: it.item, price: it.price, left: Math.max(0, left - it.price) })), mood: 'calm', react: 'like', intent: 'answer' };
}

module.exports = { weigh, looksLikePurchase, fallbackItems, PRICE };
