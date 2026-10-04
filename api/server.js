// Mama Budget API. One small server the extension talks to.
// Run: node api/server.js   (port 8787)
// Endpoints:
//   POST /judge     { items:[{item,price,merchant,context}] }  -> per item verdict + mood + her line
//   POST /buy       { item, price, merchant }                   -> posts the purchase to Nessie, returns new month
//   POST /transfer  { amount, to }                              -> posts a transfer to the family account
//   POST /deposit   { amount }                                  -> savings deposit, triggers Proud
//   GET  /week                                                  -> this week's envelope: budget, spent, left, kept, mood, bills
//   GET  /month                                                 -> the 30 day read for onboarding: true line, watches, proposed envelope
//   GET  /month?grandma=nana                                     -> same, her lines in Nana's words; carries firstName and lines { trueLine, watches } with spoken forms
//   POST /envelope  { amount }                                   -> sets the weekly envelope (onboarding 06)
//   POST /v2/judge  { items:[{name,qty,unitPrice,store}], memory, grandma, currency } -> v2 verdict per item (ask, remember), lines, week
//   POST /v2/buy    { name, short, price, store, requestId, tag?, memory?, grandma, currency } -> charge posted (idempotent by requestId), week, her line
//   POST /reset                                                 -> fresh student, fresh cache, clears watcher/messages/memory
//   GET  /messages                                               -> the transcript of everything she has sent or received (log sender)
//   POST /messages/incoming { from, text }                       -> test the two-way conversation without iMessage; replies go through GET /messages too
//   GET  /bank                                                   -> demo card terminal: recent purchases, week budget, preset charge buttons
//   POST /bank/charge { preset }                                 -> posts a preset purchase straight to Nessie (preset: airpods|groceries|latte)
//   POST /bank/charge-last-cart                                  -> posts the most recent cart the extension reported, item by item
//   GET  /schedule, POST /schedule { now, kind?, to?, grandma? } -> her weekly/monthly statement, see photon/schedule.js
//   GET  /photon/health                                          -> which sender is live (log | photon | imessage) and whether the Mac kit can send and read
//   GET  /health
//
// After-purchase notifications are NOT sent from /buy or /v2/buy: the bank watcher (notify/watch.js)
// polls Nessie every 3s and is the only thing that calls notify(), so a purchase posted anywhere
// (our own routes, the /bank terminal, or straight to Nessie) produces exactly one text.

const http = require('node:http');

// Any grandma in the family (api/lines/character.js); Mama when unknown.
const whoOf = (g) => (g && require('./lines/character').GRANDMAS[g] ? g : 'mama');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { judge } = require('./judge/rules');
const v2 = require('./judge/rules_v2');
const nessie = require('./nessie/client');
const { lineFor, ackLine, buyLine, smallLines, subLine, setHome, contextLine, backHome, planLine, fundedLine } = require('./lines/writer');
const reasons = require('./judge/reasons');
const model = require('./lines/model');
const extractCache = new Map();
const { speak } = require('./voice/elevenlabs');
const { notify, getMessages, clearMessages } = require('./notify');
const chat = require('./notify/chat');
const watch = require('./notify/watch');
const photon = require('./photon/spectrum');
const kit = require('./photon/kit');
const bankPage = require('./bank/page');
const schedule = require('./photon/schedule');
const onboarding = require('./lines/onboarding');
const { watchLines } = require('./lines/writer');

const PRESETS = {
  airpods: { item: 'AirPods Pro', price: 179, tag: 'want', merchant: 'Apple Store' },
  groceries: { item: 'Groceries', price: 28, tag: 'need', merchant: 'Kroger' },
  latte: { item: 'Latte', price: 7, tag: 'want', merchant: 'Starbucks' },
};

function html(body) {
  return { __raw: true, contentType: 'text/html; charset=utf-8', body };
}

const PORT = process.env.PORT || 8787;
// The envelope is weekly. Every number comes from the ledger sums in nessie/client.js, never from a balance field.
async function month() { return nessie.week(); }
// The 30 day read for onboarding. ?grandma=nana changes the wording of her lines, nothing else. firstName is the one
// time her name is used (screen 06); null when Nessie is unreachable, and the screen simply leaves it out.
async function reading(query = {}) {
  const who = whoOf(query.grandma);
  const m = nessie.month();
  const tl = nessie.trueLine(m);
  const watches = nessie.watches(m);
  const firstName = await nessie.customerName().catch(() => null);
  const watchTexts = watchLines(watches, who).map((w) => ({ ...w, spoken: onboarding.spokenNumbers(w.line) }));
  return { ...m, firstName, trueLine: tl, watches, proposedEnvelope: nessie.proposeEnvelope(m), lines: { trueLine: onboarding.trueLineText(tl, who), watches: watchTexts } };
}

// GET /schedule?now=1&grandma=nana or POST /schedule { now, kind?, to?, grandma? }: a query string and
// a JSON body mean the same thing here, so both call paths share this.
async function scheduleRoute(body, query) {
  const q = { ...query, ...body };
  const now = q.now === 1 || q.now === '1' || q.now === true || q.now === 'true';
  if (!now) return schedule.overview();
  return schedule.send(q.kind === 'monthly' ? 'monthly' : 'weekly', { to: q.to || undefined, grandma: q.grandma });
}

const routes = {
  'GET /health': async () => ({ ok: true, model: model.ready() ? model.MODEL : null }),
  'GET /week': month,
  'GET /month': (body, query) => reading(query),
  // Onboarding screen 06: the weekly envelope she proposed, adjusted. Whole dollars, 25 to 500. The badge reads it next tick.
  'POST /envelope': async (body) => { const envelope = nessie.setEnvelope(body.amount); return { ok: true, envelope, week: nessie.week() }; },

  'POST /judge': async (body) => {
    const m = await month();
    const items = (body.items || []).map((it) => {
      const v = judge(it, m);
      return { ...it, ...v, line: lineFor(v, it, m) };
    });
    // The loudest item decides the face.
    const worst = items.reduce((a, b) => (rank(b.mood) > rank(a.mood) ? b : a), { mood: m.mood });
    return { items, month: m, mood: worst.mood, line: worst.line || '' , audioUrl: worst.react ? await speak(worst.line).catch(() => null) : null };
  },

  // v2 for the extension: protect the obvious, ask once, remember. Memory lives in the extension and comes with each call;
  // verdict.key is what the extension stores the answer under, so the key logic stays in rules_v2 only.
  'POST /v2/judge': async (body) => {
    const w = nessie.week();
    const who = whoOf(body.grandma);
    const memory = body.memory && typeof body.memory === 'object' ? body.memory : {};
    const saidReasons = body.reasons && typeof body.reasons === 'object' ? body.reasons : null;
    setHome(body.home);
    const items = (body.items || []).map((it) => ({ item: String(it.name || ''), price: Number(it.unitPrice || 0) * Number(it.qty || 1), storePrice: it.storeUnitPrice != null ? Number(it.storeUnitPrice) * Number(it.qty || 1) : null, merchant: it.store || '', currency: body.currency || 'USD', home: body.home || null, period: ['week', 'month', 'year'].includes(it.period) ? it.period : null }));
    // The rules judge the full title (the protected word is often at the end: "...Fragrant Rice"); her line gets the short name.
    // A merchant she promised to watch (the month's top wants) by host token: "doordash" in doordash.com.
    const store = (body.items || [])[0]?.store || '';
    const host = String(store).toLowerCase();
    const watched = (nessie.watches(nessie.month()) || []).find((wt) => { const t = String(wt.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return t.length >= 4 && host.includes(t); }) || null;
    // Knowledge from context: for items she has no memory of, the model says whether it is an obvious necessity (item
    // plus store plus habits). Confident answers decide; unsure or slow answers fall back to the rules' own list.
    const habits = (nessie.month().topWants || []).slice(0, 3).map((t) => `$${t.amount} at ${t.merchant}`).join(', ');
    const known = (item) => memory[v2.keyOf(item)] != null;
    const kinds = await Promise.all(items.map(async (item) => {
      if (known(item)) return undefined;
      const c = await model.classifyItem({ name: item.item, price: item.price, store, habits }).catch(() => null);
      if (!c || c.kind === 'unsure' || Number(c.confidence) < 0.7) return undefined;
      return c.kind === 'necessity';
    }));
    const judged = items.map((item, i) => ({ item: { ...item, watched }, v: v2.judge(item, w, memory, { loudness: body.loudness, now: new Date(), watched, necessity: kinds[i] }) }));
    // Cards only (an ask or a reaction) get a line written from context, three at most per call, in parallel, each
    // falling back to the fixed pool on timeout. Low confidence reads (the text reader) ask rather than scold.
    const monthNow = nessie.month();
    let budgetLeft = 3;
    const verdicts = await Promise.all(judged.map(async ({ item, v }) => {
      if (body.confidence != null && Number(body.confidence) < 0.7 && v.react) { v = { ...v, react: false, label: 'ask', mood: 'watching', reason: 'Read from page text, so she asks rather than scolds.', tags: [...v.tags, 'lowconfidence'] }; }
      // "ChatGPT Plus, 20 dollars a month": the period is part of the name she says, and the first charge is what the week judges.
      const spoken = { ...item, item: item.period ? `${shortName(item.item)} at $${Math.round(item.price)} a ${item.period}` : shortName(item.item) };
      let line = lineFor(v, spoken, w, who);
      let ack = ackLine(v, spoken, who);
      if (ack) {
        const written = await contextLine({ kind: 'ack', who, verdict: v, it: spoken, week: w, month: monthNow, memory, store }).catch(() => null);
        if (written) ack = written;
      }
      const isCard = v.label === 'ask' || v.react;
      if (isCard && budgetLeft-- > 0) {
        const kind = v.react ? 'react' : 'ask';
        const written = await contextLine({ kind, who, verdict: v, it: spoken, week: w, month: monthNow, memory, reasons: saidReasons, store }).catch(() => null);
        if (written) line = v.react ? written + backHome(item.price, item) : written;
      }
      if (v.label === 'ask') {
        // The person is reading the question. Write what she says if they admit it, so that card is instant and hers.
        const blown = w.spent + item.price > w.budget;
        const next = blown ? { label: 'want', react: true, mood: 'shocked', tags: ['remembered', 'blown'] } : { label: 'want', react: false, mood: w.mood, tags: ['remembered', 'fits'] };
        void contextLine({ kind: blown ? 'react' : 'ack', who, verdict: next, it: spoken, week: w, month: monthNow, memory, store, warm: true }).catch(() => null);
        void contextLine({ kind: 'ack', who, verdict: { label: 'need', react: false, mood: w.mood, tags: ['remembered'] }, it: spoken, week: w, month: monthNow, memory, store, warm: true }).catch(() => null);
      }
      return { name: item.item, short: spoken.item, price: item.price, ...v, line, ack, sub: subLine(w) };
    }));
    const loud = verdicts.find((v) => v.react) || verdicts.find((v) => v.label === 'ask');
    // What the bank watcher matches a later purchase against ("a cart the extension reported in the
    // last 10 minutes"). This is the only place the extension's cart reaches the API at all.
    watch.recordCart(body.items?.[0]?.store, body.items);
    return { week: w, mood: loud ? loud.mood : w.mood, verdicts, lines: smallLines(who) };
  },

  // A charge lands: "Buy anyway" on the card, or a real order confirmation page. Idempotent by requestId, so a
  // reload of a confirmation page or a double tap never posts twice. The tag comes from the caller (an admitted
  // want from the card) or from the rules over the caller's memory (a confirmation page lists needs too).
  'POST /v2/buy': async (body) => {
    const who = whoOf(body.grandma);
    const name = String(body.name || '');
    const short = body.short || shortName(name);
    const price = Number(body.price || 0);
    if (!name || !(price > 0) || !body.requestId) throw new Error('name, price and requestId are required');
    let tag = body.tag;
    if (tag !== 'need' && tag !== 'want') {
      const memory = body.memory && typeof body.memory === 'object' ? body.memory : {};
      tag = v2.judge({ item: name, price, merchant: body.store || '' }, nessie.week(), memory).label === 'need' ? 'need' : 'want';
    }
    await nessie.purchase({ item: short, price, merchant: body.store || 'Store', tag, requestId: String(body.requestId) });
    const w = nessie.week();
    setHome(body.home);
    const it = { item: short, price, storePrice: body.storePrice != null ? Number(body.storePrice) : null, merchant: body.store || '', currency: body.currency || 'USD', home: body.home || null };
    let line = tag === 'need' ? smallLines(who).agreed : buyLine(w, it, who);
    if (tag === 'want') {
      const written = await contextLine({ kind: 'bought', who, verdict: { label: 'want', react: w.ratio >= 1, tags: [] }, it, week: w, month: nessie.month(), memory: body.memory, store: body.store }).catch(() => null);
      if (written) line = written + backHome(price, it);
    }
    const left = Math.max(0, w.budget - w.spent);
    const sub = `$${Math.round(price)} on ${short}. $${w.spent} of $${w.budget} gone this week. $${left} left.`;
    // The bank watcher (notify/watch.js) picks this purchase up on its next tick and texts if it
    // warrants one -- not here, so a purchase from any source only ever produces one text.
    return { week: w, mood: w.mood, line, sub, texted: false, tag };
  },

  // Her voice, on the Shocked card and Gele down only. Cached mp3 per line so the demo never waits twice; with no
  // ElevenLabs key the reply is JSON {audio:false} and the card shows text alone. The card never waits on audio.
  'POST /tts': async (body) => {
    const text = String(body.text || '').trim();
    if (!text) throw new Error('text is required');
    const mood = ['shocked', 'down'].includes(body.mood) ? body.mood : 'calm';
    const who = whoOf(body.grandma);
    const voice = (who === 'nana' ? process.env.ELEVEN_VOICE_ID_NANA : null) || process.env.ELEVEN_VOICE_ID || 'default';
    const dir = path.join(__dirname, '.cache', 'tts');
    const file = path.join(dir, `${crypto.createHash('sha1').update(`${voice}\n${who}\n${mood}\n${text}`).digest('hex')}.mp3`);
    let mp3 = null;
    if (fs.existsSync(file)) mp3 = fs.readFileSync(file);
    else {
      const url = await speak(text, who, mood).catch(() => null);
      if (url) {
        mp3 = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, mp3);
      }
    }
    if (!mp3) return { __raw: true, status: 204, contentType: 'text/plain', body: '' };
    return { __raw: true, contentType: 'audio/mpeg', body: mp3 };
  },

  // "You're right, Mama" and the item leaves the cart: the money stays in the week and Kept goes up. Idempotent by
  // requestId. The record lives in the local ledger (Nessie has no notion of a purchase that did not happen).
  'POST /v2/putback': async (body) => {
    const name = String(body.name || '');
    const amount = Math.round(Number(body.price || 0));
    if (!name || !(amount > 0) || !body.requestId) throw new Error('name, price and requestId are required');
    const c = nessie.readCache();
    c.putBack = c.putBack || [];
    if (!c.putBack.some((p) => p.requestId === body.requestId)) {
      c.putBack.push({ item: name, amount, date: new Date().toISOString().slice(0, 10), requestId: String(body.requestId) });
      nessie.writeCache(c);
    }
    return { ok: true, week: nessie.week() };
  },

  // Reader 4: the visible text of a cart region -> items, through the model, cached by text hash. The judge never knows.
  'POST /extract': async (body) => {
    const text = String(body.text || '').trim();
    if (!text) throw new Error('text is required');
    const key = crypto.createHash('sha1').update(text).digest('hex');
    extractCache.has(key) || extractCache.set(key, await model.extractItems(text));
    const out = extractCache.get(key);
    return out ? { ok: true, ...out } : { ok: false };
  },

  // The reason behind an answer, on any store. An occasion makes the item a plan (rules v2: planned, never scolded);
  // if it beats what is left and savings can cover it, she offers to fund the week from savings. Nothing moves here.
  'POST /v2/plan': async (body) => {
    const who = whoOf(body.grandma);
    const name = String(body.name || '');
    const price = Number(body.price || 0);
    const reason = String(body.reason || '').trim();
    if (!name || !(price > 0) || !reason) throw new Error('name, price and reason are required');
    setHome(body.home);
    const w = nessie.week();
    const left = Math.max(0, w.budget - w.spent);
    const savings = nessie.savingsBalance();
    const short = body.short || shortName(name);
    // What the reason means, from the model; the word list only when it is off or unsure.
    const c = await model.classifyReason({ reason, name: short, price }).catch(() => null);
    let occasion = null;
    // A need says the reason back ("For my photography class. Okay..."); an occasion says the occasion.
    if (c && Number(c.confidence) >= 0.6) occasion = c.kind === 'occasion' ? (c.occasion || reasons.occasionOf(reason) || reason) : c.kind === 'need' ? reason : null;
    else occasion = reasons.isJustWant(reason) ? null : reasons.occasionOf(reason);
    const need = Math.ceil(price - left);
    const proposal = occasion && price > left && savings >= need && need > 0 ? { kind: 'fund', amount: need } : null;
    const it = { item: short, price, merchant: body.store || '', currency: body.currency || 'USD', home: body.home || null, occasion: occasion || undefined };
    let line = occasion ? planLine(who, it, w, proposal) : null;
    if (occasion) {
      const written = await contextLine({ kind: 'plan', who, verdict: { label: 'need', react: false, mood: w.mood, tags: ['planned'] }, it, week: w, month: nessie.month(), memory: body.memory, reasons: body.reasons, store: body.store, reason, proposal, savings }).catch(() => null);
      if (written) line = written;
    }
    return { occasion, answer: occasion ? 'planned' : null, line, proposal, savings, week: w };
  },

  // "From savings": the money moves in Nessie and this week's envelope grows by that much. Idempotent by requestId.
  'POST /v2/fund': async (body) => {
    const who = whoOf(body.grandma);
    const amount = Math.round(Number(body.amount || 0));
    if (!(amount > 0) || !body.requestId) throw new Error('amount and requestId are required');
    await nessie.fundFromSavings(amount, String(body.name || 'this week'), String(body.requestId));
    const w = nessie.week();
    let line = fundedLine(who, amount, w);
    const written = await contextLine({ kind: 'funded', who, verdict: { label: 'need', react: false, mood: w.mood, tags: ['funded'] }, it: { item: String(body.short || body.name || 'this'), price: amount }, week: w, month: nessie.month(), memory: body.memory, store: body.store }).catch(() => null);
    if (written) line = written;
    return { ok: true, week: w, line, savings: nessie.savingsBalance() };
  },

  'POST /buy': async (body) => {
    await nessie.purchase(body);
    const m = await month();
    const v = judge(body, m);
    return { month: m, verdict: v };
  },

  'POST /transfer': async (body) => {
    await nessie.transferHome(body.amount);
    return { month: await month(), mood: 'proud', line: lineFor({ label: 'need', mood: 'proud', tags: ['family'] }, { item: 'money home' }, await month()) };
  },

  'POST /deposit': async (body) => {
    await nessie.deposit(body.amount);
    return { month: await month(), mood: 'proud', line: lineFor({ label: 'need', mood: 'proud', tags: ['saved'] }, { item: 'savings' }, await month()) };
  },

  'POST /reset': async () => {
    require('./lines/pick').reset();
    const seed = require('./nessie/seed');
    await seed.main();
    watch.resetState();
    clearMessages();
    require('./notify/memory').reset();
    return { ok: true, week: await month() };
  },

  'GET /messages': async () => getMessages(),

  'POST /messages/incoming': async (body) => {
    const images = Array.isArray(body.images) ? body.images.filter((i) => i && i.data && /^image\//.test(i.mediaType || '')).slice(0, 3) : [];
    const { reply, mood, intent, react, verdicts, followUp } = await chat.handleIncoming(String(body.text || ''), 'mama', body.from, body.id, { images });
    const out = reply ? await notify(body.from, reply, mood, { prompted: true }) : null;
    const follow = followUp ? await followUp().catch(() => null) : null;
    if (follow) await notify(body.from, `${follow.text}\n${follow.url}`, mood, { prompted: true });
    return { ok: true, reply, intent, react, verdicts, follow, texted: !!(out && out.sent) };
  },

  'GET /photon/health': async () => ({ sender: require('./notify').senderName(), spectrum: photon.live(), spectrumKeys: !!photon.credentials(), imessage: await kit.status() }),

  'GET /bank': async () => {
    const cache = nessie.readCache();
    return html(bankPage.page({ week: nessie.week(), purchases: cache.purchases || [], messages: getMessages() }));
  },

  'POST /bank/charge': async (body) => {
    const preset = PRESETS[body.preset];
    if (!preset) throw new Error('unknown preset');
    await nessie.purchase(preset);
    return { ok: true };
  },

  'POST /bank/charge-last-cart': async () => {
    const cart = watch.latestCart();
    if (!cart) return { ok: true, posted: 0 };
    const w = nessie.week();
    let posted = 0;
    for (const it of cart.items) {
      const price = Number(it.unitPrice || 0) * Number(it.qty || 1);
      const v = judge({ item: it.name, price, merchant: cart.store }, w);
      await nessie.purchase({ item: it.name, price, merchant: cart.store, tag: v.label === 'need' ? 'need' : 'want' });
      posted++;
    }
    return { ok: true, posted };
  },

  'GET /schedule': (body, query) => scheduleRoute({}, query),
  'POST /schedule': (body) => scheduleRoute(body, {}),
};

// "Fujifilm Instax Mini 99 Instant Camera Vintage Black. + Value Pack (40 Sheets)..." -> "Fujifilm Instax Mini 99 Instant Camera".
// Store titles run long; her lines need the noun a person would say. Up to six words, never ending on a filler word.
const FILLER = new Set(['about', 'for', 'with', 'and', 'the', 'of', 'to', 'in', 'a', 'an', 'by', 'on', 'from', '&']);
function shortName(name) {
  // Cut at the first separator a title uses: " - ", "- ", ",", ":", "|", "(", "[", "–", ". ". A hyphen inside a word ("35-150mm") stays.
  const head = String(name || '').replace(/^\[[^\]]*\]\s*-?\s*/, '').split(/\s+-\s*|-\s+|[,:|(\[–]|\.\s/)[0].trim();
  const words = head.split(/\s+/).slice(0, 6);
  while (words.length > 1 && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(' ');
}

function rank(mood) { return ['calm', 'proud', 'watching', 'shocked', 'down'].indexOf(mood); }

http.createServer(async (req, res) => {
  // Only the extension (and local tooling) may call from a browser. A store's own page scripts get no CORS grant,
  // so nothing on the web can post to /buy or /transfer through a visitor's browser.
  const origin = req.headers.origin || '';
  const trusted = /^chrome-extension:\/\/[a-z]{32}$/.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const cors = { 'Access-Control-Allow-Origin': trusted ? origin : 'null', 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const [pathname, search] = req.url.split('?');
  const key = `${req.method} ${pathname}`;
  const query = Object.fromEntries(new URLSearchParams(search || ''));
  const handler = routes[key];
  if (!handler) { res.writeHead(404, cors); return res.end('{"error":"no such route"}'); }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const out = await handler(raw ? JSON.parse(raw) : {}, query);
      if (out && out.__raw) {
        res.writeHead(out.status || 200, { 'content-type': out.contentType, ...cors });
        return res.end(out.body);
      }
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
}).listen(PORT, () => console.log(`Mama is listening on http://localhost:${PORT}`));

// The bank watcher is the only source of after-purchase notifications; see notify/watch.js.
watch.start();
schedule.startScheduler();
// Two-way texting over real iMessage, only once SPECTRUM_PROJECT_ID/SPECTRUM_PROJECT_SECRET (or the
// PHOTON_ prefixed fallback) are set -- a no-op otherwise, so this is always safe to call.
// spectrum.js sends the reply itself (same space, continuing the thread), so this just logs that leg
// for GET /messages. handleIncoming() is the exact same function POST /messages/incoming calls.
/** Her line as audio for a voice message: { buffer, mimeType } or null. m4a when afconvert is here (a Mac), mp3 otherwise. */
async function voiceNote(line, who, mood) {
  try {
    const url = await speak(line.replace(/\s+/g, ' ').trim(), who, mood);
    if (!url) return null;
    const mp3 = Buffer.from(url.split(',')[1], 'base64');
    if (process.platform !== 'darwin') return { buffer: mp3, mimeType: 'audio/mpeg' };
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const { execFileSync } = require('node:child_process');
    const src = path.join(os.tmpdir(), `mama-voice-${Date.now()}.mp3`);
    const out = src.replace(/\.mp3$/, '.m4a');
    try {
      fs.writeFileSync(src, mp3);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', src, out], { stdio: 'ignore', timeout: 8000 });
      return { buffer: fs.readFileSync(out), mimeType: 'audio/mp4' };
    } catch {
      return { buffer: mp3, mimeType: 'audio/mpeg' };
    } finally {
      for (const f of [src, out]) try { fs.unlinkSync(f); } catch { /* gone */ }
    }
  } catch {
    return null;
  }
}

photon.listen(async (text, fromId, messageId, { images = [] } = {}) => {
  const { reply, mood, react, followUp } = await chat.handleIncoming(text, 'mama', fromId, messageId, { images });
  if (reply || react) require('./notify/log').push({ to: fromId || 'them', text: reply || `(${react})`, mood, sender: 'photon', sent: true, direction: 'out', at: Date.now() });
  // Gele down arrives in her voice too: the same line as a voice note, after the text (text first, always, for
  // whoever cannot or will not listen).
  const voiceLine = mood === 'shocked' && reply ? () => voiceNote(reply, 'mama', mood) : null;
  return { reply, react, followUp, mood, voiceLine };
});
// The Mac kit listens the same way when it is the live sender: texts to this Mac's Messages, the same
// handleIncoming(), and the reply goes back through notify() (prompted: replies skip the gate), so it is
// sent and logged exactly like every other text.
function startKit() {
  if (!kit.available()) return false;
  kit.listen(async (text, from, messageId) => {
    const { reply, mood, followUp } = await chat.handleIncoming(text, 'mama', from, messageId);
    if (reply) await notify(from, reply, mood, { prompted: true });
    const follow = followUp ? await followUp().catch(() => null) : null;
    if (follow) await notify(from, `${follow.text}\n${follow.url}`, mood, { prompted: true });
  });
  kit.status().then((st) => console.log(`[imessage] Mac kit is the sender${process.env.PHOTON_DRY === '1' ? ' (dry run)' : ''}: texting ${st.to}, ${st.db ? 'listening for replies' : 'cannot read Messages (Full Disk Access?)'}`));
  return true;
}
if (photon.credentials()) {
  // Spectrum first. If the cloud refuses the keys she must not go silent: the Mac kit takes over where it can.
  photon.connected().then((ok) => {
    if (ok) return console.log('[photon] connected, listening for replies');
    console.log('[photon] credentials set but connection failed (see error above)');
    if (!startKit()) console.log('[photon] no Mac kit either: using the log sender only');
  });
} else if (startKit()) {
  // the kit said so itself
} else {
  console.log('[photon] no Spectrum credentials and no PHOTON_TO in api/.env: using the log sender only');
}
