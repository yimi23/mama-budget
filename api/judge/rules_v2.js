// Judge v2. Protect the obvious, ask about the rest once, remember the answer.
// v1 (rules.js) stays frozen for the 50 case score. v2 is tested only on a fresh set.
//
// Three layers:
//   1. What you told her: a remembered need or plan is never reopened, an admitted want is hers to react to.
//   2. Protected needs, from context (the model) or the word list. Never counted, never scolded. Everything else:
//      ask the first time (above the price line), then remember. She only scolds wants the user admitted.
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

// Loudness scales the ask line, never the math: Full Nigerian Mother asks from $15, Mama from $25, Gentle Auntie from
// $40. `now` is injected (not read) so the judge stays pure; it is here for the quiet hours rule when that ships.
const ASK_LINE_FOR = { full: 15, mama: 25, gentle: 40 };

// On a merchant she promised to watch (screen 06b) the ask line drops to $5: nothing new slips by there.
const WATCHED_ASK_LINE = 5;

// `necessity` comes from context (the model, given item and store) when available; the word list below is the fallback
// for when it is not. The promises (family money, first sightings, admitted wants, planned) do not depend on either.
function judge(it, month = { budget: 75, spent: 0 }, memory = {}, { loudness, now, watched, necessity } = {}) {
  void now;
  const askLine = watched ? Math.min(WATCHED_ASK_LINE, ASK_LINE_FOR[loudness] || ASK_LINE) : (ASK_LINE_FOR[loudness] || ASK_LINE);
  const k = key(it);
  const ratio = month.budget ? month.spent / month.budget : 0;
  const base = ratio >= 0.75 ? 'watching' : 'calm';
  const out = (label, react, mood, reason, tags = []) => ({ label, react, mood, reason, tags, key: k });

  // Family money is protected. Both mothers called it Depends or Want; we keep it protected and say so.
  if (has(it.merchant || '', FAMILY_MERCHANTS)) return out('need', false, base, 'Money to family. Protected.', ['family']);

  // Layer 1: what you told her. Memory beats every guess, the model's and the word list's. An admitted want stays a
  // want whatever the context says; a remembered need or plan is never reopened.
  if (memory[k] === 'need') return out('need', false, base, 'You told her this is a need for you.', ['remembered']);
  if (memory[k] === 'planned') return out('need', false, base, 'You said you were saving for this.', ['planned']);

  const price = Number(it.price || 0);
  const blown = month.spent + price > month.budget;

  if (memory[k] === 'want') {
    // She has the right to react: you said it yourself. The envelope decides whether she does.
    // A want that fits the week is a nod. One that blows it gets the Shocked card. Gele down comes later, when a real
    // order lands and the week's ratio passes 1 (that is the week's own mood, not this verdict's).
    if (!blown) return out('want', false, base, 'An admitted want that fits the week. A nod.', ['remembered', 'fits']);
    return out('want', true, 'shocked', 'An admitted want that blows the week.', ['remembered', 'blown']);
  }

  // Layer 2: the obvious. From context when it is known; from the word list only when it is not. Only a clean boolean
  // counts as known: anything else the model returns is treated as no answer, so the word list still stands.
  const known = typeof necessity === 'boolean' ? necessity : null;
  if (known === true) return out('need', false, base, 'A necessity, from what it is and where it is bought. She never reacts.', ['protected', 'context']);
  if (known === null && has(k, PROTECTED)) return out('need', false, base, 'Protected need. She never reacts.', ['protected']);

  // Unknown item. Small: a nod. Otherwise: ask, neutral face, nothing moves.
  if (price < askLine) return out('want', false, base, 'Small. A nod, nothing more.', ['small']);
  return out('ask', false, 'watching', watched ? 'A merchant she watches. She asks about everything here.' : 'First time. She asks, she does not scold.', watched ? ['ask', 'watched'] : ['ask']);
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

module.exports = { judge, remember, once, keyOf: key, PROTECTED, ASK_LINE };
