// The one place the model is called. Two jobs, per CLAUDE.md: write her line from a verdict the rules already
// reached, and turn cart text into items. It never decides need or want. No key, or any failure: the caller falls
// back to the fixed lines or the next reader, and nothing on a store ever waits on it past the timeout.

const crypto = require('node:crypto');
let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); Anthropic = Anthropic.default || Anthropic; } catch { Anthropic = null; }

const MODEL = process.env.MODEL || 'claude-opus-5-5';
const LINE_TIMEOUT_MS = Number(process.env.MODEL_LINE_TIMEOUT_MS || 1800);
const WARM_TIMEOUT_MS = Number(process.env.MODEL_WARM_TIMEOUT_MS || 12000);
const EXTRACT_TIMEOUT_MS = Number(process.env.MODEL_EXTRACT_TIMEOUT_MS || 8000);

let client = null;
function ready() {
  if (!process.env.ANTHROPIC_API_KEY || !Anthropic) return false;
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return true;
}

const lineCache = new Map(); // key -> line, so a repeated demo is instant and consistent within a run
function cacheKey(parts) { return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex'); }

/** One line in her voice. Returns null when the model is off, slow, or the line breaks a house rule. */
async function say({ system, prompt, key, mustInclude = [], maxLen = 220, timeoutMs = LINE_TIMEOUT_MS }) {
  if (!ready()) return null;
  const k = cacheKey([MODEL, system, typeof key === 'string' ? key : prompt]);
  if (key && lineCache.has(k)) return lineCache.get(k);
  try {
    const res = await client.messages.create(
      { model: MODEL, max_tokens: 300, system, output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] },
      { timeout: timeoutMs },
    );
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length > maxLen || /[—–]| - |[\u{1F300}-\u{1FAFF}]/u.test(text)) return null;
    for (const m of mustInclude) if (!text.toLowerCase().includes(String(m).toLowerCase())) return null;
    if (key) lineCache.set(k, text);
    return text;
  } catch {
    return null;
  }
}

const ITEMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'subtotal', 'currency', 'confidence'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'qty', 'unitPrice', 'period', 'store', 'wasPrice'],
        properties: { name: { type: 'string' }, qty: { type: 'integer' }, unitPrice: { type: 'number' }, period: { type: 'string', enum: ['once', 'week', 'month', 'year'] }, store: { type: ['string', 'null'] }, wasPrice: { type: ['number', 'null'] } },
      },
    },
    subtotal: { type: ['number', 'null'] },
    currency: { type: 'string', enum: ['USD', 'NGN', 'GBP', 'EUR', 'CAD'] },
    confidence: { type: 'number' },
  },
};

const EXTRACT_SYSTEM = `You read the visible text of a page where someone is about to pay (a cart, a checkout, a plan or subscription page) and return what they are about to pay for.
A subscription or plan is one item: name is the plan ("ChatGPT Plus"), unitPrice is the amount per period, period is month or year (or week). A one time purchase has period "once".
On a pricing page with several plans and one selected or highlighted, return only the selected plan; if none is selected, return nothing.
Rules: only items in the active cart or bag; never "saved for later", "recently viewed", "you may also like" or recommendations.
qty is the quantity shown (default 1). unitPrice is the price of one unit in the store's currency, as a number.
subtotal is the cart subtotal or total if shown, else null. currency from the symbols on the page. confidence is 0 to 1:
how sure you are that these are exactly the cart lines. Return JSON only.`;

/** Cart text -> items. Null when the model is off or unsure past repair. */
async function extractItems(text, images = []) {
  if (!ready()) return null;
  try {
    // A screenshot or photo of a product page reads like cart text: the image blocks go first, the words after.
    const content = [
      ...images.slice(0, 3).map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType || 'image/png', data: i.data } })),
      { type: 'text', text: (text || 'What is for sale here and at what price?').slice(0, 6000) },
    ];
    const res = await client.messages.create(
      {
        model: MODEL, max_tokens: 2000, system: EXTRACT_SYSTEM, output_config: { effort: 'low', format: { type: 'json_schema', schema: ITEMS_SCHEMA } },
        messages: [{ role: 'user', content }],
      },
      { timeout: images.length ? EXTRACT_TIMEOUT_MS * 2 : EXTRACT_TIMEOUT_MS },
    );
    const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(raw);
    if (!Array.isArray(out.items)) return null;
    out.items = out.items.filter((i) => i && i.name && i.unitPrice > 0).map((i) => ({ name: String(i.name).trim(), qty: Math.max(1, Math.round(i.qty || 1)), unitPrice: Number(i.unitPrice), period: ['week', 'month', 'year'].includes(i.period) ? i.period : 'once', store: i.store || null, wasPrice: i.wasPrice > 0 ? Number(i.wasPrice) : null }));
    out.confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
    return out;
  } catch {
    return null;
  }
}

const CLASSIFY_WAIT_MS = Number(process.env.MODEL_CLASSIFY_WAIT_MS || 3500);
const classCache = new Map();
const inFlight = new Map();

// The caller waits CLASSIFY_WAIT_MS at most; the request itself keeps going and lands in the cache, so the next
// judgement of the same cart (a change, an answer) is right and instant even when the first one had to fall back.
async function classifyJSON({ system, prompt, schema, key, waitMs = CLASSIFY_WAIT_MS }) {
  if (!ready()) return null;
  const k = cacheKey([MODEL, 'classify', system, key || prompt]);
  if (classCache.has(k)) return classCache.get(k);
  if (!inFlight.has(k)) {
    const run = client.messages.create(
      { model: MODEL, max_tokens: 200, system, output_config: { effort: 'low', format: { type: 'json_schema', schema } }, messages: [{ role: 'user', content: prompt }] },
      { timeout: 20000 },
    ).then((res) => {
      const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
      classCache.set(k, out);
      return out;
    }).catch(() => null).finally(() => inFlight.delete(k));
    inFlight.set(k, run);
  }
  return Promise.race([inFlight.get(k), new Promise((r) => setTimeout(() => r(null), waitMs))]);
}

const ITEM_SYSTEM = `You help a budgeting companion decide whether a purchase is an obvious necessity for a student living on a fixed
weekly fun money envelope, or discretionary. Necessities: groceries and staple food bought to cook, medicine and prescriptions,
toiletries, rent and utilities and phone bills, tuition, required textbooks and school supplies, transit passes, laundry, money
sent to family. Discretionary: restaurant and delivery food, coffee and drinks out, electronics, fashion, games, subscriptions
for entertainment, decor, gifts to self. Judge by what the item is and where it is bought (takeout at DoorDash is not groceries).
Return JSON only.`;
const ITEM_SCHEMA = { type: 'object', additionalProperties: false, required: ['kind', 'confidence', 'why'],
  properties: { kind: { type: 'string', enum: ['necessity', 'discretionary', 'unsure'] }, confidence: { type: 'number' }, why: { type: 'string' } } };

/** Is this item an obvious necessity? { kind, confidence, why } or null when the model is off or slow. */
async function classifyItem({ name, price, store, habits }) {
  const prompt = `Item: ${name}. Price: $${Math.round(price || 0)}. Store: ${store || 'unknown'}.${habits ? ` This person's recent habits: ${habits}.` : ''}`;
  return classifyJSON({ system: ITEM_SYSTEM, prompt, schema: ITEM_SCHEMA, key: `${name}|${store}` });
}

const REASON_SYSTEM = `You read the one line a person typed when asked what a purchase is for, and say what it means for their budget.
occasion: a dated event or obligation (graduation, wedding, interview, a flight home, exams, a new job) that makes this a plan.
need: a plain necessity (for school, for work, medicine, replacing something broken that they rely on).
want: pleasure or impulse, however it is phrased ("because I want it", "treat myself", "it looks nice", "why not").
unsure: too vague to tell. Return JSON only.`;
const REASON_SCHEMA = { type: 'object', additionalProperties: false, required: ['kind', 'occasion', 'confidence'],
  properties: { kind: { type: 'string', enum: ['occasion', 'need', 'want', 'unsure'] }, occasion: { type: ['string', 'null'] }, confidence: { type: 'number' } } };

/** What a typed reason means. { kind, occasion, confidence } or null. */
async function classifyReason({ reason, name, price }) {
  const prompt = `They were asked what "${name}" ($${Math.round(price || 0)}) is for. They typed: "${reason}".`;
  return classifyJSON({ system: REASON_SYSTEM, prompt, schema: REASON_SCHEMA, key: `${name}|${reason}` });
}

module.exports = { say, extractItems, classifyItem, classifyReason, ready, MODEL, WARM_TIMEOUT_MS };
