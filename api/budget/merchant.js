// Merchant names out of bank descriptions. "POS DEBIT WALMART SUPERCENTER #1700 POWAY CA" is Walmart; "SQ *BLUE OWL
// COFFEE" is Blue Owl Coffee via Square; "AMZN Mktp US*2K4ABC" is Amazon. The key is what groups a person's rows,
// so two Shell stations share one. Pure; docs/BUDGET.md section 2.2.

const CHANNEL = /^(?:POS (?:DEBIT|PURCHASE|WITHDRAWAL)|DEBIT CARD (?:PURCHASE|PAYMENT|WITHDRAWAL)|CHECK ?CARD (?:PURCHASE|PAYMENT)?|VISA (?:DEBIT|PURCHASE)|PURCHASE AUTHORIZED ON \d\d\/\d\d|CARD PURCHASE \d\d\/\d\d|RECURRING (?:DEBIT CARD|PAYMENT)|DIRECT DEP(?:OSIT)?|DIR DEP|ACH (?:DEBIT|CREDIT|PMT|PAYMENT)|ONLINE (?:PAYMENT|PURCHASE)|ELECTRONIC (?:PAYMENT|WITHDRAWAL)|WEB (?:PMT|PAYMENT)|MOBILE (?:PURCHASE|PAYMENT)|CONTACTLESS|CHIP CARD|PENDING|AUTHORIZED)\s+/i;
const ACH_META = /\b(?:ORIG CO NAME|ORIG ID|DESC DATE|CO ENTRY DESCR|TRACE#?|IND ID|IND NAME|SEC|PPD ID|CCD ID|WEB ID|ENTRY CLASS CODE)\s*:?\s*\S+/gi;
const JUNK = [
  /\b(?:REF|AUTH|TXN|TRN|CONF|TRACE|SEQ|CHK|CK)\s*#?\s*:?\s*[A-Z0-9-]{3,}/gi,
  /\bCARD (?:ENDING|NO\.?|NUMBER)?\s*\d{4}\b/gi, /\bX{3,}\d{3,4}\b/gi, /\.{3}\d{3,4}\b/g, /\*\d{3,}\b/g, /\b\d{10,}\b/g,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, /\bSTORE\s*#?\s*\d+\b/gi, /#\s*\d{2,6}\b/g, /\b\d{5}(?:-\d{4})?\b(?=\s*$)/g,
  /\s\b[A-Z]{2}\s+\d{5}\b/g, /\s\b(?:US|USA|NG|NGA)\b\s*$/i, /\bWWW\./gi, /\.COM(?:\/BILL)?\b/gi, /\.NET\b|\.ORG\b|\.NG\b/gi,
  /\b(?:PPD|CCD|WEB|TEL|ARC|POP)\b\s*$/g,
];
const PROCESSOR = [
  [/^SQ\s*\*\s*/i, 'square'], [/^TST\s*\*\s*/i, 'toast'], [/^SP\s*\*\s*/i, 'shopify'], [/^(?:PAYPAL|PP)\s*\*\s*/i, 'paypal'],
  [/^APLPAY\s+/i, 'apple pay'], [/^GOOGLE\s*\*\s*/i, 'google'], [/^PY\s*\*\s*/i, 'payoneer'], [/^IC\s*\*\s*/i, 'instacart'], [/^DD\s*\*\s*/i, 'doordash'],
  [/^STRIPE\s*\*\s*/i, 'stripe'], [/^WPY\s*\*\s*/i, 'wepay'], [/^FLW\s*\*\s*/i, 'flutterwave'], [/^PSTK\s*\*\s*/i, 'paystack'],
];
const ALIASES = [
  [/^(?:AMZN\s*MKTP|AMAZON(?:\.COM)?|AMZN|AMAZON PRIME|PRIME VIDEO)\b.*$/i, 'Amazon'],
  [/^(?:WM SUPERCENTER|WAL-?MART|WALMART)\b.*$/i, 'Walmart'],
  [/^UBER\s*\*?\s*EATS\b.*$/i, 'Uber Eats'], [/^UBER\b.*$/i, 'Uber'],
  [/^KROGER\b.*$/i, 'Kroger'], [/^MEIJER\b.*$/i, 'Meijer'], [/^TARGET\b.*$/i, 'Target'], [/^COSTCO\b.*$/i, 'Costco'],
  [/^CVS\b.*$/i, 'CVS'], [/^WALGREENS\b.*$/i, 'Walgreens'], [/^SHELL\b.*$/i, 'Shell'], [/^SPEEDWAY\b.*$/i, 'Speedway'],
  [/^NETFLIX\b.*$/i, 'Netflix'], [/^SPOTIFY\b.*$/i, 'Spotify'], [/^APPLE(?:\.COM)?(?:\/BILL)?\b.*$/i, 'Apple'],
  [/^(?:CONSUMERS ENERGY|DTE ENERGY|DTE)\b.*$/i, 'Utilities'],
  [/^ZELLE (?:TO|PAYMENT TO)\s+(.+?)(?:\s+CONF.*)?$/i, (m) => `Zelle to ${title(m[1])}`],
  [/^ZELLE (?:FROM|PAYMENT FROM)\s+(.+?)(?:\s+CONF.*)?$/i, (m) => `Zelle from ${title(m[1])}`],
  [/^VENMO (?:FROM|PAYMENT FROM)\s+(.+?)(?:\s+PAYMENT)?$/i, (m) => `Venmo from ${title(m[1])}`],
  [/^VENMO\b.*$/i, 'Venmo'], [/^CASH APP\b.*$/i, 'Cash App'],
  [/^ATM (?:WITHDRAWAL|WD|CASH)\b.*$/i, 'ATM withdrawal'], [/^CHECK\b.*$/i, 'Check'],
  [/^ONLINE TRANSFER (?:TO|FROM)\b.*$/i, 'Transfer'], [/^(?:INTERNAL|MOBILE) TRANSFER\b.*$/i, 'Transfer'],
  [/^PAYMENT THANK YOU\b.*$/i, 'Card payment'], [/^(?:CHASE|AMEX|CAPITAL ONE|DISCOVER|CITI|APPLECARD)\b.*(?:AUTOPAY|E?PAYMENT|CRCARDPMT|PMT)\b.*$/i, 'Card payment'],
];

function title(s) {
  return String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
}

/**
 * The merchant behind a description.
 * Returns { raw, normalized, key, via, person } where key is lower-case and stable, via is the processor if any, and
 * person is true for Zelle, Venmo and Cash App counterparties (people, not shops).
 */
function merchant(description, payee = '') {
  const raw = String(description || '').trim();
  let s = raw.toUpperCase().replace(/\s+/g, ' ');
  let via = null;
  s = s.replace(CHANNEL, '');
  s = s.replace(ACH_META, ' ');
  for (const [re, name] of PROCESSOR) if (re.test(s)) { via = name; s = s.replace(re, ''); break; }
  for (const re of JUNK) s = s.replace(re, ' ');
  // Payroll and ACH descriptors sit mid-string too: "ACME CORP DIR DEP PPD ID: 123 ACME CORP".
  s = s.replace(/\b(?:DIR(?:ECT)? DEP(?:OSIT)?|PAYROLL|PPD|CCD|WEB|ID|ACH|CREDIT|DEBIT)\b\s*:?/g, ' ');
  s = s.replace(/[*|:]+/g, ' ').replace(/\s+/g, ' ').trim();
  // A name repeated twice ("ACME CORP ACME CORP") is the name once.
  const half = s.slice(0, Math.floor(s.length / 2)).trim();
  if (half && s === `${half} ${half}`) s = half;
  let normalized = null;
  for (const [re, name] of ALIASES) { const m = re.exec(s); if (m) { normalized = typeof name === 'function' ? name(m) : name; break; } }
  if (!normalized) {
    // The payee field, when the bank gives one, is cleaner than our own cut.
    const p = String(payee || '').trim();
    normalized = p && !/^(?:payment|transfer|pos|debit|credit)$/i.test(p) ? p : title(s || raw);
  }
  const person = /^(?:zelle|venmo|cash app)\b/i.test(normalized) || /\b(?:to|from) [A-Z][a-z]+ [A-Z][a-z]+$/.test(normalized);
  return { raw, normalized, key: normalized.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(), via, person };
}

module.exports = { merchant, title };
