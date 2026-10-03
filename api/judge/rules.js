// The judge. Deterministic. Decides need, want or ask, and how bad.
// The model never classifies. It only writes her line afterwards.
// If you change a rule after seeing the mums' labels, the 50 case results
// become development results and you need a fresh set. Protocol step 1.

const NEED_WORDS = [
  'rice', 'soap', 'rent', 'bill', 'electric', 'phone bill', 'textbook', 'bus pass',
  'prescription', 'eggs', 'milk', 'bread', 'laundry', 'lab fee', 'tuition', 'insurance',
  'palm oil', 'crayfish', 'stockfish', 'toilet paper', 'groceries', 'medicine', 'detergent',
  'toothpaste', 'charger', 'coat',
];

const WANT_WORDS = [
  'airpods', 'jordans', 'hoodie', 'video game', 'game', 'concert', 'subscription', 'streaming',
  'phone case', 'energy drink', 'bubble tea', 'boba', 'crypto', 'led', 'nails', 'trip', 'bar tab',
  'haul', 'latte', 'coffee', 'doordash', 'delivery', 'sneakers', 'tattoo', 'monitor', 'playstation',
];

// Context that turns a plain want into a question. She asks, she does not scold.
const ASK_WORDS = [
  'cracked', 'slow', 'years old', '11pm', 'alone', 'no food at home', 'missing home',
  'first trip', 'gift', 'every two weeks', 'gym', 'offering', 'haircut', 'spotify',
  'planned for a year', 'friends going', 'once a month',
];

// Context that makes a need stick even when the item looks like a want.
const NEED_CONTEXT = ['stopped working', 'broke', 'owns no', 'no coat', 'only way', 'required', 'on the syllabus'];

// Context that makes a want worse.
const REPEAT_WORDS = ['third', 'fourth', 'second time', 'already pays', 'owns four', 'this week', 'today'];

const FAMILY_MERCHANTS = ['remitly', 'sendwave', 'wise', 'western union', 'worldremit', 'moneygram', 'lemfi', 'afriex'];
const FAMILY_WORDS = ['family', 'parents', 'sibling', 'school fees', 'mum', 'mom', 'dad', 'home'];

function has(text, words) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

/**
 * @param {{item:string, price:number, context?:string, merchant?:string}} c
 * @param {{budget:number, spent:number}} month  how much of the fun budget is used
 * @returns {{label:'need'|'want'|'ask', severity:0|1|2|3, react:boolean, mood:string, reason:string, tags:string[]}}
 */
function judge(c, month = { budget: 75, spent: 0 }) {
  const item = c.item || '';
  const ctx = c.context || '';
  const merchant = c.merchant || '';
  const both = `${item} ${ctx}`;
  const tags = [];

  // 1. Money to family is never waste. Rule 01, hardest form.
  if (has(merchant, FAMILY_MERCHANTS) || (has(both, FAMILY_WORDS) && /sent|send|transfer|fees/i.test(both))) {
    tags.push('family');
    return out('need', 0, false, calmOrWatching(month), 'Money to family. She stays quiet.', tags);
  }

  // 2. One receipt with a need and a want on it: she cannot scold the receipt. She asks.
  const mixed = /\band\b|,/.test(item) && has(item, NEED_WORDS) && has(item, WANT_WORDS);
  if (mixed) {
    tags.push('mixed');
    return out('ask', 1, false, 'watching', 'Mixed receipt. She asks which item was for what.', tags);
  }

  // 3. Needs. Context can save an item that looks like a want.
  if (has(item, NEED_WORDS) || has(ctx, NEED_CONTEXT)) {
    tags.push('need');
    return out('need', 0, false, calmOrWatching(month), 'A need. Rule 01: she never reacts.', tags);
  }

  // 4. Context that makes it a judgment call. She asks.
  if (has(ctx, ASK_WORDS)) {
    tags.push('context');
    return out('ask', 1, false, 'watching', 'Depends on the story. She asks, she does not scold.', tags);
  }

  // 5. Wants. Severity from price, bumped by repetition and by the month.
  if (has(item, WANT_WORDS) || c.price > 0) {
    let severity = c.price < 10 ? 1 : c.price < 60 ? 2 : 3;
    if (has(ctx, REPEAT_WORDS)) { severity = Math.min(3, severity + 1); tags.push('repeat'); }
    const blown = month.spent + c.price > month.budget;
    if (blown) tags.push('blown');
    const react = severity >= 2 || blown;
    const mood = blown ? 'down' : react ? 'shocked' : calmOrWatching(month);
    return out('want', severity, react, mood, react ? 'A want she will speak up about.' : 'A small want. A nod, nothing more.', tags);
  }

  return out('ask', 1, false, 'watching', 'She does not know this one. She asks.', tags);
}

function calmOrWatching(month) {
  return month.budget > 0 && month.spent / month.budget >= 0.75 ? 'watching' : 'calm';
}

function out(label, severity, react, mood, reason, tags) {
  return { label, severity, react, mood, reason, tags };
}

// The frozen merchant only baseline. Bank category in, label out. Nothing else.
function merchantOnly(bankCategory, baseline) {
  return baseline.need.includes(bankCategory) ? 'need' : 'want';
}

module.exports = { judge, merchantOnly };
