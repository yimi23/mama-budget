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
//   POST /v2/judge  { items:[{name,qty,unitPrice,store}], memory, grandma } -> v2 verdict per item (ask, remember), lines, week
//   GET  /health

const http = require('node:http');
const { judge } = require('./judge/rules');
const v2 = require('./judge/rules_v2');
const nessie = require('./nessie/client');
const { lineFor, subLine } = require('./lines/writer');
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
      const item = { item: String(it.name || ''), price: Number(it.unitPrice || 0) * Number(it.qty || 1), merchant: it.store || '' };
      const v = v2.judge(item, w, memory);
      const spoken = { ...item, item: shortName(item.item) };
      return { name: it.name, short: spoken.item, price: item.price, ...v, line: lineFor(v, spoken, w, who), sub: subLine(w) };
    });
    const loud = verdicts.find((v) => v.react) || verdicts.find((v) => v.label === 'ask');
    return { week: w, mood: loud ? loud.mood : w.mood, verdicts };
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

// "Fujifilm Instax Mini 99 Instant Camera Vintage Black. + Value Pack (40 Sheets)..." -> "Fujifilm Instax Mini 99".
// Store titles run long; her lines need the noun a person would say.
function shortName(name) {
  const head = String(name || '').split(/\s[|(\[–-]\s?|[,|(\[.]\s/)[0].replace(/^\[[^\]]*\]-?/, '').trim();
  return head.split(/\s+/).slice(0, 4).join(' ');
}

function rank(mood) { return ['calm', 'proud', 'watching', 'shocked', 'down'].indexOf(mood); }

http.createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
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
