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
        type: 'object', additionalProperties: false, required: ['name', 'qty', 'unitPrice'],
        properties: { name: { type: 'string' }, qty: { type: 'integer' }, unitPrice: { type: 'number' } },
      },
    },
    subtotal: { type: ['number', 'null'] },
    currency: { type: 'string', enum: ['USD', 'NGN', 'GBP', 'EUR', 'CAD'] },
    confidence: { type: 'number' },
  },
};

const EXTRACT_SYSTEM = `You read the visible text of a shopping cart page and return the items the person is about to pay for.
Rules: only items in the active cart or bag; never "saved for later", "recently viewed", "you may also like" or recommendations.
qty is the quantity shown (default 1). unitPrice is the price of one unit in the store's currency, as a number.
subtotal is the cart subtotal or total if shown, else null. currency from the symbols on the page. confidence is 0 to 1:
how sure you are that these are exactly the cart lines. Return JSON only.`;

/** Cart text -> items. Null when the model is off or unsure past repair. */
async function extractItems(text) {
  if (!ready()) return null;
  try {
    const res = await client.messages.create(
      {
        model: MODEL, max_tokens: 2000, system: EXTRACT_SYSTEM, output_config: { effort: 'low', format: { type: 'json_schema', schema: ITEMS_SCHEMA } },
        messages: [{ role: 'user', content: text.slice(0, 6000) }],
      },
      { timeout: EXTRACT_TIMEOUT_MS },
    );
    const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const out = JSON.parse(raw);
    if (!Array.isArray(out.items)) return null;
    out.items = out.items.filter((i) => i && i.name && i.unitPrice > 0).map((i) => ({ name: String(i.name).trim(), qty: Math.max(1, Math.round(i.qty || 1)), unitPrice: Number(i.unitPrice) }));
    out.confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
    return out;
  } catch {
    return null;
  }
}

module.exports = { say, extractItems, ready, MODEL, WARM_TIMEOUT_MS };
