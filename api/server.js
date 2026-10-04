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
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { judge } = require('./judge/rules');
const v2 = require('./judge/rules_v2');
const nessie = require('./nessie/client');
const { lineFor, ackLine, buyLine, smallLines, subLine, setHome } = require('./lines/writer');
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
  const who = query.grandma === 'nana' ? 'nana' : 'mama';
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
  'GET /health': async () => ({ ok: true }),
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
    const who = body.grandma === 'nana' ? 'nana' : 'mama';
    const memory = body.memory && typeof body.memory === 'object' ? body.memory : {};
    setHome(body.home);
    const items = (body.items || []).map((it) => ({ item: String(it.name || ''), price: Number(it.unitPrice || 0) * Number(it.qty || 1), storePrice: it.storeUnitPrice != null ? Number(it.storeUnitPrice) * Number(it.qty || 1) : null, merchant: it.store || '', currency: body.currency || 'USD', home: body.home || null }));
    // The rules judge the full title (the protected word is often at the end: "...Fragrant Rice"); her line gets the short name.
    const judged = items.map((item) => ({ item, v: v2.judge(item, w, memory, { loudness: body.loudness, now: new Date() }) }));
    const verdicts = judged.map(({ item, v }) => {
      const spoken = { ...item, item: shortName(item.item) };
      return { name: item.item, short: spoken.item, price: item.price, ...v, line: lineFor(v, spoken, w, who), ack: ackLine(v, spoken, who), sub: subLine(w) };
    });
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
    const who = body.grandma === 'nana' ? 'nana' : 'mama';
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
    const line = tag === 'need' ? smallLines(who).agreed : buyLine(w, it, who);
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
    const who = body.grandma === 'nana' ? 'nana' : 'mama';
    const mood = ['shocked', 'down'].includes(body.mood) ? body.mood : 'calm';
    const who = body.grandma === 'nana' ? 'nana' : 'mama';
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
    const seed = require('./nessie/seed');
    await seed.main();
    watch.resetState();
    clearMessages();
    require('./notify/memory').reset();
    return { ok: true, week: await month() };
  },

  'GET /messages': async () => getMessages(),

  'POST /messages/incoming': async (body) => {
    const { reply, mood, intent } = await chat.handleIncoming(String(body.text || ''), 'mama', body.from, body.id);
    const out = await notify(body.from, reply, mood, { prompted: true });
    return { ok: true, reply, intent, texted: !!(out && out.sent) };
  },

  'GET /photon/health': async () => ({ sender: require('./notify').senderName(), spectrum: !!photon.credentials(), imessage: await kit.status() }),

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
photon.listen(async (text, fromId, messageId) => {
  const { reply, mood } = await chat.handleIncoming(text, 'mama', fromId, messageId);
  if (reply) require('./notify/log').push({ to: fromId || 'them', text: reply, mood, sender: 'photon', sent: true, direction: 'out', at: Date.now() });
  return reply;
});
// The Mac kit listens the same way when it is the live sender: texts to this Mac's Messages, the same
// handleIncoming(), and the reply goes back through notify() (prompted: replies skip the gate), so it is
// sent and logged exactly like every other text.
if (!photon.credentials() && kit.available()) {
  kit.listen(async (text, from, messageId) => {
    const { reply, mood } = await chat.handleIncoming(text, 'mama', from, messageId);
    if (reply) await notify(from, reply, mood, { prompted: true });
  });
}
if (photon.credentials()) {
  photon.connected().then((ok) => console.log(ok ? '[photon] connected, listening for replies' : '[photon] credentials set but connection failed (see error above)'));
} else if (kit.available()) {
  kit.status().then((st) => console.log(`[imessage] Mac kit is the sender${process.env.PHOTON_DRY === '1' ? ' (dry run)' : ''}: texting ${st.to}, ${st.db ? 'listening for replies' : 'cannot read Messages (Full Disk Access?)'}`));
} else {
  console.log('[photon] no Spectrum credentials and no PHOTON_TO in api/.env: using the log sender only');
}
