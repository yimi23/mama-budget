// The one place the model is called. Two jobs, per CLAUDE.md: write her line from a verdict the rules already
// reached, and turn cart text into items. It never decides need or want. No key, or any failure: the caller falls
// back to the fixed lines or the next reader, and nothing on a store ever waits on it past the timeout.

const crypto = require('node:crypto');
let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); Anthropic = Anthropic.default || Anthropic; } catch { Anthropic = null; }

const MODEL = process.env.MODEL || 'claude-opus-5-5';
// Small yes or no jobs (is this a necessity, what does this reason mean) go to a fast model: 1.2 s against 3 s, same
// verdicts on the clear cases, and a higher confidence bar for the rest. Her words, carts, photos and the cheaper search
// stay on the main model.
const FAST_MODEL = process.env.MODEL_FAST || 'claude-haiku-4-5-20251001';
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
const lineInFlight = new Map();

async function say({ system, prompt, key, mustInclude = [], maxLen = 220, timeoutMs = LINE_TIMEOUT_MS }) {
  if (!ready()) return null;
  const k = cacheKey([MODEL, system, typeof key === 'string' ? key : prompt]);
  if (key && lineCache.has(k)) return lineCache.get(k);
  // One request per situation. A line written ahead (warm) and the real call for the same card share it, so the card
  // gets the line the moment it lands instead of starting a second request and timing out on its own.
  if (key && lineInFlight.has(k)) return Promise.race([lineInFlight.get(k), new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
  const run = sayOnce({ system, prompt, k, key, mustInclude, maxLen, timeoutMs });
  if (key) { lineInFlight.set(k, run); run.finally(() => lineInFlight.delete(k)); }
  return run;
}

async function sayOnce({ system, prompt, k, key, mustInclude, maxLen, timeoutMs }) {
  try {
    // The brief is the same for every line she speaks, so it is cached at the API: after the first call, the system
    // block costs a fraction and the request starts faster. Below the cache minimum the flag is simply ignored.
    const res = await client.messages.create(
      { model: MODEL, max_tokens: 300, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] },
      { timeout: timeoutMs },
    );
    if (process.env.MODEL_LOG_USAGE === '1') console.log('[model] usage', JSON.stringify(res.usage));
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length > maxLen || /[—–]| - |[\u{1F300}-\u{1FAFF}]/u.test(text)) return null;
    // Each entry must appear; an entry that is an array is satisfied by any of its words ("Apple AirPods Pro" is said as AirPods).
    for (const m of mustInclude) { const alts = Array.isArray(m) ? m : [m]; if (!alts.some((a) => text.toLowerCase().includes(String(a).toLowerCase()))) return null; }
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
Offers next to an item (protection plans, warranties, "add plans or services", memberships, financing) are not items unless the page shows them as chosen. The first price on an item's row is its current price; a "Was", "reg" or struck price is wasPrice. The cart lines times their quantities add up to the subtotal; if yours do not, you have the wrong lines.
qty is the quantity shown (default 1). unitPrice is the price of ONE unit in the store's currency, as a number: a row with a quantity of 4 and a line total of $476 is qty 4 at unitPrice 119, never qty 1 at 476.
subtotal is the cart subtotal or total if shown, else null. currency from the symbols on the page. confidence is 0 to 1:
how sure you are that these are exactly the cart lines. Return JSON only.`;

/** Cart text -> items. Null when the model is off or unsure past repair. */
const PRICE_RE = '(?:US\\$|CA\\$|C\\$|[$£€₦])\\s?\\d[\\d,]*(?:\\.\\d{1,2})?';
const money = (p) => Number(String(p).replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));

/** What the page itself states: the subtotal (the last "subtotal" with a price after it, else the last total) and the item count ("Subtotal (3 items)", "Items (3)"). */
function pageFacts(text) {
  const t = String(text || '');
  const re = new RegExp(`\\b(subtotal|sub-total|order total|estimated total|cart total|basket total|total)\\b(?:\\s*\\([^)]{0,30}\\))?[^$£€₦\\d]{0,40}(${PRICE_RE})`, 'gi');
  let sub = null, total = null, m;
  while ((m = re.exec(t))) { const n = money(m[2]); if (!(n > 0)) continue; if (/^sub/i.test(m[1])) sub = n; else total = n; }
  const c = /\((\d{1,3}) items?\)|\bitems? \((\d{1,3})\)|\b(\d{1,3}) items? in (?:your )?(?:cart|bag|basket)/i.exec(t);
  const count = c ? Number(c[1] ?? c[2] ?? c[3]) : null;
  return { subtotal: sub ?? total, count: count && count > 0 ? count : null };
}

const NOT_AN_ITEM = /\b(sub-?total|total|cart|bag|basket|checkout|order summary)\b|\(\d+ items?\)/i;
/** Names a model gives when it could not see the item. A "$1 Amazon Grocery" promo line is a name; "item in cart" is not. */
const GENERIC_NAME = /^(items?|products?|cart( items?)?|items? in (your |the )?(cart|bag|basket)|your (items?|order)|order|purchase)$/i;

/**
 * The items add up to the page's own subtotal (never the model's: a wrong read invents the subtotal that fits it)
 * and the quantities match the page's count when it states one; or the page shows no subtotal and the model is
 * sure. No item may be the cart itself. The arithmetic is the check.
 */
function verified(out, facts = {}) {
  if (!out || !Array.isArray(out.items) || !out.items.length) return false;
  if (out.items.some((i) => NOT_AN_ITEM.test(String(i.name || '')) || GENERIC_NAME.test(String(i.name || '').trim()))) return false;
  const sum = out.items.reduce((s, i) => s + Number(i.unitPrice || 0) * Number(i.qty || 1), 0);
  const qty = out.items.reduce((s, i) => s + Number(i.qty || 1), 0);
  if (facts.count != null && qty !== facts.count && out.items.length !== facts.count) return false;
  const subtotal = facts.subtotal ?? (out.subtotal != null && Number.isFinite(Number(out.subtotal)) ? Number(out.subtotal) : null);
  if (subtotal != null) return Math.abs(sum - subtotal) < 0.02;
  return Number(out.confidence) >= 0.85;
}

/**
 * Cart text (and photos) to items. The fast model reads first and is kept only when its items add up to the page's
 * subtotal (or there is no subtotal and it is sure); otherwise the main model reads. Measured on a Zara bag: 3.1 s
 * against 6.5 s with the same six items; on a Target page the fast read invented a protection plan, the sum missed
 * the subtotal, and the main model took over. Arithmetic, not trust.
 */
const RECURRING_PRICE = /(?:US\$|[$£€])\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:\/|per|a)\s*(?:mo\b|month|yr\b|year|wk\b|week)/gi;
const CHOSEN = /\b(current plan|your plan|you'?re on|selected|chosen|order summary|subtotal|total due|due today|billed today|pay now|place order|confirm (?:and )?pay|checkout)\b/i;

/**
 * A pricing page is not a cart. When every line is a plan, the page shows two or more recurring prices and nothing
 * says one is chosen or being paid for, the person is comparing, not buying, and she has nothing to judge. Seen
 * live on a pricing grid: she nodded at the $6 plan, then asked about the $22 plan, then nodded again as the page
 * changed under her. A checkout for a plan (one price, a subtotal or a pay control) still reads.
 */
function comparingPlans(text, out) {
  if (!out || !Array.isArray(out.items) || !out.items.length) return false;
  if (!out.items.every((i) => i.period && i.period !== 'once')) return false;
  if (out.subtotal != null) return false;
  const prices = new Set((String(text).match(RECURRING_PRICE) || []).map((p) => p.replace(/\s+/g, '').toLowerCase()));
  return prices.size >= 2 && !CHOSEN.test(String(text));
}

async function extractItems(text, images = []) {
  if (!ready()) return null;
  const out = await extractItemsRaw(text, images);
  if (comparingPlans(text, out)) return { ...out, items: [], confidence: 0.2, comparing: true };
  return out;
}

async function extractItemsRaw(text, images = []) {
  const facts = pageFacts(text);
  const fast = await extractWith(FAST_MODEL, text, images, true).catch(() => null);
  if (verified(fast, facts)) return fast;
  const out = await extractWith(MODEL, text, images, false);
  // The main model is the fallback, not an oracle: when the page states a subtotal and its lines do not add up to
  // it, or it named a placeholder, the read is unsure and she asks instead of asserting.
  if (out && facts.subtotal != null && !verified(out, facts)) out.confidence = Math.min(Number(out.confidence) || 0, 0.5);
  return out;
}

async function extractWith(model, text, images, plain) {
  try {
    // A screenshot or photo of a product page reads like cart text: the image blocks go first, the words after.
    const content = [
      ...images.slice(0, 3).map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType || 'image/png', data: i.data } })),
      { type: 'text', text: (text || 'What is for sale here and at what price?').slice(0, 6000) },
    ];
    const shape = ' Respond with only a JSON object {"items":[{"name","qty","unitPrice","period":"once|week|month|year","store","wasPrice"}],"subtotal":number or null,"currency":"USD|NGN|GBP|EUR|CAD","confidence":0 to 1}.';
    const res = await client.messages.create(
      {
        model, max_tokens: 2000, system: [{ type: 'text', text: EXTRACT_SYSTEM + (plain ? shape : ''), cache_control: { type: 'ephemeral' } }],
        ...(plain ? {} : { output_config: { effort: 'low', format: { type: 'json_schema', schema: ITEMS_SCHEMA } } }),
        messages: [{ role: 'user', content }],
      },
      { timeout: images.length ? EXTRACT_TIMEOUT_MS * 2 : EXTRACT_TIMEOUT_MS },
    );
    const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(plain ? (raw.match(/\{[\s\S]*\}/) || [raw])[0] : raw);
    if (!Array.isArray(out.items)) return null;
    out.items = out.items.filter((i) => i && i.name && i.unitPrice > 0).map((i) => ({ name: String(i.name).trim(), qty: Math.max(1, Math.round(i.qty || 1)), unitPrice: Number(i.unitPrice), period: ['week', 'month', 'year'].includes(i.period) ? i.period : 'once', store: i.store || null, wasPrice: i.wasPrice > 0 ? Number(i.wasPrice) : null }));
    out.confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
    return out;
  } catch {
    return null;
  }
}

const CLASSIFY_WAIT_MS = Number(process.env.MODEL_CLASSIFY_WAIT_MS || 2500);
const classCache = new Map();
const inFlight = new Map();

// The caller waits CLASSIFY_WAIT_MS at most; the request itself keeps going and lands in the cache, so the next
// judgement of the same cart (a change, an answer) is right and instant even when the first one had to fall back.
async function classifyJSON({ system, prompt, schema, key, waitMs }) {
  waitMs = waitMs == null ? CLASSIFY_WAIT_MS : waitMs;
  if (!ready()) return null;
  const k = cacheKey([MODEL, 'classify', system, key || prompt]);
  if (classCache.has(k)) return classCache.get(k);
  if (!inFlight.has(k)) {
    // The fast model takes no structured output config; the schema goes in words and the JSON is parsed out of the text.
    const shape = `Respond with only a JSON object with keys ${Object.keys(schema.properties).map((x) => `"${x}"`).join(', ')}${schema.properties.kind && schema.properties.kind.enum ? `; "kind" is one of ${schema.properties.kind.enum.map((x) => `"${x}"`).join(', ')}` : ''}; "confidence" is 0 to 1.`;
    const run = client.messages.create(
      { model: FAST_MODEL, max_tokens: 200, system: [{ type: 'text', text: `${system}\n${shape}`, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: prompt }] },
      { timeout: 20000 },
    ).then((res) => {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const m = text.match(/\{[\s\S]*\}/);
      const out = JSON.parse(m ? m[0] : text);
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
async function classifyItem({ name, price, store, habits, waitMs, others }) {
  const prompt = `Item: ${name}. Price: $${Math.round(price || 0)}. Store: ${store || 'unknown'}.${habits ? ` This person's recent habits: ${habits}.` : ''}${others && others.length ? ` Also in the cart: ${others.slice(0, 4).join(', ')}.` : ''}`;
  return classifyJSON({ system: ITEM_SYSTEM, prompt, schema: ITEM_SCHEMA, key: `${name}|${store}`, waitMs });
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

const CHEAPER_SYSTEM = `You check whether the exact same product is sold for less right now, using web search. Report a price only if you saw it
on a page you fetched in this search, for the same product (same model, same variant, new, not refurbished), from a retailer that
ships in the United States. Prefer major retailers. If you cannot find the same product cheaper with a URL to its listing, answer
found=false. Never estimate or recall a price from memory. Return JSON only.`;
const CHEAPER_SCHEMA = { type: 'object', additionalProperties: false, required: ['found', 'store', 'price', 'url', 'product'],
  properties: { found: { type: 'boolean' }, store: { type: ['string', 'null'] }, price: { type: ['number', 'null'] }, url: { type: ['string', 'null'] }, product: { type: ['string', 'null'] } } };
const CHEAPER_TIMEOUT_MS = Number(process.env.MODEL_CHEAPER_TIMEOUT_MS || 20000);

/** The same product for less, from a page fetched now. { found, store, price, url, product } or null. Never a guess. */
async function cheaperOption({ name, price, currency = 'USD', store }) {
  if (!ready()) return null;
  const prompt = `Product: "${name}". Seen at ${store || 'a store'} for ${currency} ${price}. Is the same product sold for less elsewhere today?`;
  try {
    const res = await client.messages.create(
      {
        model: MODEL, max_tokens: 1500, system: CHEAPER_SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: CHEAPER_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: CHEAPER_TIMEOUT_MS },
    );
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    const out = JSON.parse(m ? m[0] : text);
    // The URL must be one the search actually returned: a quoted price with no fetched page behind it is a guess.
    const fetched = new Set();
    for (const b of res.content) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r.url) fetched.add(r.url);
    if (!out.found || !(out.price > 0) || !out.url || !fetched.has(out.url)) return { found: false };
    return out;
  } catch {
    return null;
  }
}

module.exports = {
  verified,
  pageFacts,
  comparingPlans, say, extractItems, classifyItem, classifyReason, cheaperOption, ready, MODEL, FAST_MODEL, WARM_TIMEOUT_MS };
