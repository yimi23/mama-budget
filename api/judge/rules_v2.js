// Judge v2. Protect the obvious, ask about the rest once, remember the answer.
// v1 (rules.js) stays frozen for the 50 case score. v2 is tested only on a fresh set.
//
// Three layers:
//   1. Protected needs: the cases where both mothers and the bank agreed. Never counted, never scolded.
//   2. Everything else: ask the first time (above the price line), then remember. She only scolds
//      wants the user admitted ("I just want them"), or items already remembered as wants.
//   3. The envelope decides whether she speaks at all. A want that fits gets a nod.
//
// memory: { [itemKey]: 'need' | 'want' | 'planned' }  per user, persisted by the server.

const PROTECTED = ['rent', 'electric', 'bill', 'phone bill', 'prescription', 'medicine', 'insurance', 'tuition', 'lab fee',
  'textbook', 'bus pass', 'laundry', 'rice', 'eggs', 'milk', 'bread', 'soap', 'toothpaste', 'toilet paper', 'detergent',
  'palm oil', 'crayfish', 'stockfish', 'groceries', 'beans', 'chicken', 'tomato', 'onion'];
const FAMILY_MERCHANTS = ['remitly', 'sendwave', 'wise', 'western union', 'worldremit', 'moneygram', 'lemfi', 'afriex'];
const ASK_LINE = 15; // below this she never asks, a small want is a nod at most

const key = (it) => String(it.item || '').toLowerCase().replace(/,.*$/, '').replace(/[^a-z0-9 ]/g, '').trim();
const has = (t, words) => words.some((w) => String(t).toLowerCase().includes(w));

function judge(it, month = { budget: 75, spent: 0 }, memory = {}) {
  const k = key(it);
  const ratio = month.budget ? month.spent / month.budget : 0;
  const base = ratio >= 0.75 ? 'watching' : 'calm';
  const out = (label, react, mood, reason, tags = []) => ({ label, react, mood, reason, tags, key: k });

  // Family money is protected. Both mothers called it Depends or Want; we keep it protected and say so.
  if (has(it.merchant || '', FAMILY_MERCHANTS)) return out('need', false, base, 'Money to family. Protected.', ['family']);

  // Layer 1: the obvious.
  if (has(k, PROTECTED)) return out('need', false, base, 'Protected need. She never reacts.', ['protected']);

  // Layer 2: what you told her.
  if (memory[k] === 'need') return out('need', false, base, 'You told her this is a need for you.', ['remembered']);
  if (memory[k] === 'planned') return out('need', false, base, 'You said you were saving for this.', ['planned']);

  const price = Number(it.price || 0);
  const blown = month.spent + price > month.budget;

  if (memory[k] === 'want') {
    // She has the right to react: you said it yourself.
    const react = price >= ASK_LINE || blown;
    return out('want', react, blown ? 'down' : react ? 'shocked' : base, 'An admitted want.', ['remembered', ...(blown ? ['blown'] : [])]);
  }

  // Unknown item. Small: a nod. Otherwise: ask, neutral face, nothing moves.
  if (price < ASK_LINE) return out('want', false, base, 'Small. A nod, nothing more.', ['small']);
  return out('ask', false, 'watching', 'First time. She asks, she does not scold.', ['ask']);
}

// Called when the user answers the card. Returns the updated memory.
function remember(memory, it, answer) {
  const k = key(it);
  if (answer === 'need' || answer === 'want' || answer === 'planned') return { ...memory, [k]: answer };
  return memory;
}

// "Not this time": one purchase treated as the other label without reopening the question.
function once(it, label, month) {
  return judge(it, month, { [key(it)]: label });
}

module.exports = { judge, remember, once, PROTECTED, ASK_LINE };
