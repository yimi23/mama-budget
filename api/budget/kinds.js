// Five kinds for every row: income, transfer, bill, need, want. docs/BUDGET.md section 2.5.
// Cascade: the person's correction by merchant key (forever), then the row's own kind from the transfer step, then
// the stream it belongs to (bill or income), then the merchant category code the bank sent, then names and words,
// then the fallback. Rules v2's PROTECTED list sits above all of it. No model in this slice; a model would come last
// and could never override a rule or a correction.

const { merchant } = require('./merchant.js');
const { PROTECTED } = require('../judge/rules_v2.js');

// Merchant category codes (ISO 18245), as SimpleFIN v2 carries them. Needs keep you alive and housed; wants are the rest.
const MCC_NEED = new Set(['5411', '5422', '5441', '5451', '5462', '5499', // groceries, meat, candy/bakery, dairy, bakeries, misc food
  '5912', '8011', '8021', '8031', '8041', '8042', '8043', '8049', '8050', '8062', '8071', '8099', // pharmacy, doctors, dentists, hospitals, labs
  '5541', '5542', '5983', '4111', '4112', '4121', '4131', '4784', '7523', '7512', // fuel, transit, rail, taxi (flipped below), buses, tolls, parking, car rental
  '4900', '4814', '4816', '4899', '4812', // utilities, telecom, internet, cable, phone equipment
  '6300', '6381', '6399', '8211', '8220', '8241', '8244', '8249', '8299', '8351', // insurance, schools, universities, childcare
  '6513', '7349', '5300', '5310', '5331', // rent/property managers, cleaning, wholesale clubs, discount stores, variety stores
]);
const MCC_WANT_OVERRIDE = new Set(['4121', '4899']); // rideshare and cable/streaming are wants unless the person flips them
const MCC_BILLISH = new Set(['4900', '4814', '4816', '4812', '6300', '6381', '6399', '6513']);

const NEED_WORDS = /\b(?:grocer|supermarket|market|foods?|kroger|meijer|aldi|walmart|costco|shoprite|spar|pharmac|chemist|cvs|walgreens|clinic|hospital|doctor|dentist|rent|landlord|lease|electric|energy|power|water|gas|fuel|petrol|shell|speedway|mobil|exxon|bp|chevron|transit|metro|bus|train|amtrak|toll|parking|insurance|tuition|school|daycare|childcare|phone|airtime|data|mtn|airtel|glo|internet|wifi)\b/i;
const WANT_WORDS = /\b(?:restaurant|cafe|coffee|starbucks|bar|pub|lounge|club|cinema|movie|netflix|spotify|hulu|disney|apple\.com|game|steam|playstation|xbox|uber|lyft|bolt|doordash|uber eats|grubhub|chowdeck|boutique|zara|h&m|nike|adidas|sephora|ulta|salon|barber|spa|nails|hotel|airbnb|flight|airline|amazon|jumia|konga|aliexpress|shein|temu|etsy|ebay|bet|lottery|casino)\b/i;

/** The kind for one row, with the reason, after transfers and streams are known. */
function kindOf(row, { streamByRowId = new Map(), corrections = { kinds: {} }, protectedWords = PROTECTED } = {}) {
  const m = row.merchantKey ? { key: row.merchantKey, normalized: row.merchantName || row.merchantKey } : merchant(row.description, row.payee);
  const corrected = corrections.kinds && corrections.kinds[m.key];
  if (corrected) return { kind: corrected, why: 'you said so', merchant: m };
  if (row.kind === 'transfer' || row.kind === 'cash') return { kind: 'transfer', why: row.why || 'transfer', merchant: m };
  if (row.kind === 'refund') return { kind: 'refund', why: 'merchant refund', merchant: m };
  const s = streamByRowId.get(row.id);
  if (s && s.kind === 'income') return { kind: 'income', why: `${s.cadence} pay`, merchant: m };
  if (row.amount > 0) return { kind: /\b(?:venmo|zelle|cash app)\b/i.test(m.normalized) ? 'transfer' : 'income', why: row.amount > 0 && m.person ? 'money from a person' : 'money in', merchant: m };
  if (s && s.kind === 'bill') return { kind: 'bill', why: `${s.cadence} bill`, merchant: m };
  const text = `${m.normalized} ${row.description}`.toLowerCase();
  // The protected words are cart items (rice, beans, medicine). On a bank row they count as whole words, and never
  // over the bank's own category or a known subscription: APPLE.COM/BILL is not an apple.
  if (!row.mcc && !(s && s.kind === 'subscription') && protectedWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))) return { kind: 'need', why: 'protected', merchant: m };
  if (row.mcc) {
    if (MCC_BILLISH.has(row.mcc) && s) return { kind: 'bill', why: 'utility by category', merchant: m };
    if (MCC_WANT_OVERRIDE.has(row.mcc)) return { kind: 'want', why: 'category (you can flip this)', merchant: m };
    if (MCC_NEED.has(row.mcc)) return { kind: 'need', why: 'category', merchant: m };
    if (/^(?:5812|5813|5814|5815|5816|5817|5818|7832|7841|7922|7929|7932|7933|7941|7991|7992|7993|7994|7995|7996|7997|7998|7999|5651|5661|5691|5699|5944|5945|5946|5947|5948|5949|5970|5992|5993|5994|5995|5999|5311|5399|5942|5732|5733|5734|5735|7011|4511|4722|3[0-9]{3})$/.test(row.mcc)) return { kind: 'want', why: 'category', merchant: m };
  }
  if (s && s.kind === 'subscription') return { kind: 'want', why: `${s.cadence} subscription`, merchant: m };
  if (NEED_WORDS.test(text) && !WANT_WORDS.test(text)) return { kind: 'need', why: 'the name', merchant: m };
  if (WANT_WORDS.test(text)) return { kind: 'want', why: 'the name', merchant: m };
  return { kind: 'want', why: 'unknown; a want until you say otherwise', merchant: m, unsure: true };
}

/** Every row with its kind, merchant key and reason. */
function classify(rows, streamsList, corrections) {
  const streamByRowId = new Map();
  for (const s of streamsList) for (const r of s.rows) streamByRowId.set(r.id, s);
  return rows.map((r) => { const k = kindOf(r, { streamByRowId, corrections }); return { ...r, kind: k.kind, why: k.why, merchantKey: k.merchant.key, merchantName: k.merchant.normalized, unsure: !!k.unsure }; });
}

module.exports = { kindOf, classify, MCC_NEED };
