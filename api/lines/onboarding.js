// What she says during onboarding that comes from the ledger: the true line and the watches. Two forms of each:
// `text` for the screen (digits, dollar signs) and `spoken` for ElevenLabs (numbers in words, so she never says
// "one oh two"). The fixed onboarding lines are UI copy and live in the extension; only the dynamic ones are here.

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0 to 999,999 in English words. "one hundred and two", "forty", "one thousand two hundred". */
function words(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return 'zero';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '');
  return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
}

/** "$102 on it, so when DoorDash" -> "one hundred and two dollars on it, so when DoorDash". */
function spokenNumbers(text) {
  return String(text || '')
    .replace(/\$(\d[\d,]*)(?:\.\d+)?/g, (_, d) => `${words(Number(d.replace(/,/g, '')))} dollar${Number(d.replace(/,/g, '')) === 1 ? '' : 's'}`)
    .replace(/(\d+)%/g, (_, d) => `${words(d)} percent`)
    .replace(/\b(\d+)\b/g, (_, d) => words(d));
}

/**
 * Screen 06. From nessie.trueLine(): { topCategory, topAmount, contrastItem, contrastAmount }.
 * Null when there is no month to speak of (the bank was skipped or the ledger is empty).
 */
function trueLineText(tl, who = 'mama') {
  if (!tl || !tl.topCategory || !(tl.topAmount > 0)) return null;
  const close = require('./writer').phrase(who, 'trueLineClose');
  const contrast = tl.contrastItem && tl.contrastAmount != null ? ` ${cap(tl.contrastItem)} was $${Math.round(tl.contrastAmount)}.` : '';
  const text = `Last 30 days: $${Math.round(tl.topAmount)} on ${tl.topCategory}.${contrast} ${close}`;
  return { text, spoken: spokenNumbers(text) };
}

function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

module.exports = { words, spokenNumbers, trueLineText };
