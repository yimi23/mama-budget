// Mama Budget API. One small server the extension talks to.
// Run: node api/server.js   (port 8787)
// Endpoints:
//   POST /judge     { items:[{item,price,merchant,context}] }  -> per item verdict + mood + her line
//   POST /buy       { item, price, merchant }                   -> posts the purchase to Nessie, returns new month
//   POST /transfer  { amount, to }                              -> posts a transfer to the family account
//   POST /deposit   { amount }                                  -> savings deposit, triggers Proud
//   GET  /week                                                  -> this week's envelope: budget, spent, left, kept, mood, bills
//   GET  /month                                                 -> the 30 day read for onboarding: true line, watches, proposed envelope
//   GET  /month?history=30                                      -> same
//   POST /v2/judge  { items:[{name,qty,unitPrice,store}], memory, grandma, currency } -> v2 verdict per item (ask, remember), lines, week
//   POST /v2/buy    { name, short, price, store, requestId, tag?, memory?, grandma, currency } -> charge posted (idempotent by requestId), week, her line, text sent or not
//   GET  /health

const http = require('node:http');
const { judge } = require('./judge/rules');
const v2 = require('./judge/rules_v2');
const nessie = require('./nessie/client');
const { lineFor, ackLine, buyLine, buyText, smallLines, subLine } = require('./lines/writer');
const { speak } = require('./voice/elevenlabs');
const { text } = require('./photon/text');

const PORT = process.env.PORT || 8787;
// The envelope is weekly. Every number comes from the ledger sums in nessie/client.js, never from a balance field.
async function month() { return nessie.week(); }
async function reading() { const m = nessie.month(); return { ...m, trueLine: nessie.trueLine(m), watches: nessie.watches(m), proposedEnvelope: nessie.proposeEnvelope(m) }; }

const routes = {
  'GET /health': async () => ({ ok: true }),
  'GET /week': month,
  'GET /month': reading,

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
    const verdicts = (body.items || []).map((it) => {
      // The rules judge the full title (the protected word is often at the end: "...Fragrant Rice"); her line gets the short name.
      const item = { item: String(it.name || ''), price: Number(it.unitPrice || 0) * Number(it.qty || 1), merchant: it.store || '', currency: body.currency || 'USD' };
      const v = v2.judge(item, w, memory);
      const spoken = { ...item, item: shortName(item.item) };
      return { name: it.name, short: spoken.item, price: item.price, ...v, line: lineFor(v, spoken, w, who), ack: ackLine(v, spoken, who), sub: subLine(w) };
    });
    const loud = verdicts.find((v) => v.react) || verdicts.find((v) => v.label === 'ask');
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
    const it = { item: short, price, merchant: body.store || '', currency: body.currency || 'USD' };
    const line = tag === 'need' ? smallLines(who).agreed : buyLine(w, it, who);
    const left = Math.max(0, w.budget - w.spent);
    const sub = `$${Math.round(price)} on ${short}. $${w.spent} of $${w.budget} gone this week. $${left} left.`;
    // Only an actual send counts as texted. Photon unset or down: the card says nothing about a text.
    const sent = tag === 'want' ? await text(buyText(w, it, who)).catch(() => null) : null;
    return { week: w, mood: w.mood, line, sub, texted: !!sent, tag };
  },

  'POST /buy': async (body) => {
    await nessie.purchase(body);
    const m = await month();
    const v = judge(body, m);
    if (v.react) text(lineFor({ ...v, mood: m.mood }, body, m)).catch(() => {});
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
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (!handler) { res.writeHead(404, cors); return res.end('{"error":"no such route"}'); }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const out = await handler(raw ? JSON.parse(raw) : {});
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
}).listen(PORT, () => console.log(`Mama is listening on http://localhost:${PORT}`));
