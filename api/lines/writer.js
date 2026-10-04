// Her line. Rules first: scold the receipt never the person, every loud line names the amount
// and the item, one cultural marker per line at most, Pidgin only when emotion peaks.
// The writer never changes a verdict. That already happened in rules.js.
// Mama's lines are to be replaced with real phrases from Praise's mother and aunt, shaped not invented.

const MAMA = {
  calm: ['Ehen. Carry on.', 'I see you. Good.'],
  watching: ['I dey watch you o.', 'Seventy five percent. I am counting.'],
  shocked: [
    'You went to {merchant} for rice. How did {item} enter the cart?',
    '{price} dollars. For {item}. The one you have, is it not working?',
    'Ehn ehn. Put it back. We will talk when you get home.',
  ],
  down: ['Is it me you are doing this to?', 'Okay. I have heard.'],
  proud: ['My pikin. Come and hug me.', 'You see? Good child. I knew it.'],
  ask: ['{item}? Tell me the story first.', 'Before I talk, explain {item} to me.'],
  ackNeed: ['Okay. I will remember.'],
  ackFits: ['Ehen. Carry on.', 'Okay. It fits. Carry on.'],
  agreed: ['Good. I am watching the cart.'],
  bought: ['Noted. It is in the book.'],
  family: ['That one is not waste. Greet them for me.'],
  statementClose: ['Good week. Keep going.', 'Better than last week. I noticed.', 'We will do better. I am not angry.'],
};

const NANA = {
  calm: ['Looks good, hon.', 'Okay.'],
  watching: ['Honey. I’m looking.', 'Three quarters gone. Just so you know.'],
  shocked: [
    '{price} dollars. For {item}. Honey.',
    'Well. That’s a lot of money for {item}.',
  ],
  down: ['Okay. I’m not going to say anything.'],
  proud: ['Oh good. I knew you would.', 'Well look at you. Good for you, hon.'],
  ask: ['Hold on a sec, hon. What’s {item} for?'],
  ackNeed: ['Okay. Noted.'],
  ackFits: ['Okay, hon. That fits.'],
  agreed: ['Good call, hon.'],
  bought: ['Alright. Noted.'],
  family: ['That’s family. That doesn’t count.'],
  statementClose: ['Good week.', 'Better than last week. I noticed.', 'We’ll get there.'],
};

const NGN = Number(process.env.USD_NGN || 1600); // update before demo

// Product names keep their own casing ("AirPods Pro", not "airpods pro"); the line's first letter is capitalised
// after filling, so a line that opens with the item still reads as a sentence.
function fill(t, it) {
  const line = t
    .replace('{item}', (it.item || 'this').replace(/,.*$/, '').trim())
    .replace('{price}', Math.round(it.price || 0))
    .replace('{merchant}', it.merchant || 'the shop');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * @param {object} verdict  from rules.js
 * @param {object} it       the item
 * @param {object} month    { budget, spent, ratio }
 * @param {'mama'|'nana'} who
 */
function lineFor(verdict, it, month, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  let key = verdict.mood;
  if (verdict.label === 'ask') key = 'ask';
  if (verdict.tags && verdict.tags.includes('family')) key = 'family';
  const pool = bank[key] || bank.calm;
  const base = fill(pool[(it.item || '').length % pool.length], it);
  // Mama adds the naira, unless the store already priced it in naira.
  if (who === 'mama' && verdict.react && it.price && it.currency !== 'NGN') {
    return `${base} That is ${Math.round(it.price * NGN).toLocaleString()} naira.`;
  }
  return base;
}

// What she says right after you answer the card. She always acknowledges; silence after an answer reads as a
// dropped call. A declared need gets no comment on its price, by the house rule: need never sets her off.
function ackLine(verdict, it, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  const tags = verdict.tags || [];
  if (verdict.label === 'need' && tags.includes('remembered')) return fill(bank.ackNeed[0], it);
  if (verdict.label === 'want' && tags.includes('fits')) return fill(bank.ackFits[(it.item || '').length % bank.ackFits.length], it);
  return null;
}

// After a charge lands. The week's own ratio decides: past the envelope is Gele down and she says so with the
// naira; inside it she only notes it. Nothing about the person, ever.
function buyLine(week, it, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  if ((week.ratio || 0) >= 1) {
    const base = fill(bank.down[(it.item || '').length % bank.down.length], it);
    return who === 'mama' && it.price && it.currency !== 'NGN' ? `${base} That is ${Math.round(it.price * NGN).toLocaleString()} naira.` : base;
  }
  return fill(bank.bought[0], it);
}

// The one line text after a charge: her line, then the numbers. Short enough for a lock screen.
function buyText(week, it, who = 'mama') {
  const left = Math.max(0, week.budget - week.spent);
  return `${buyLine(week, it, who)}\n$${Math.round(it.price || 0)} on ${it.item}. $${week.spent} of $${week.budget} fun money gone this week. $${left} left.`;
}

// Small acknowledgements the card needs on hand: "You're right, Mama", and the item leaving the cart.
function smallLines(who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  return { agreed: bank.agreed[0], proud: bank.proud[0], watching: bank.watching[0] };
}

// The sub line under her quote. Numbers, not character.
function subLine(month) {
  const left = Math.max(0, month.budget - month.spent);
  const days = month.daysLeft != null ? month.daysLeft : daysLeftInWeek();
  return `${Math.round((month.ratio || 0) * 100)}% of this week gone. $${left} left. ${days} day${days === 1 ? '' : 's'}.`;
}

// Weekly statement. Four lines. Numbers first, one line of her at the end.
function weeklyStatement({ week, biggest, who = 'mama', trend = 0 }) {
  const bank = who === 'nana' ? NANA : MAMA;
  const left = Math.max(0, week.budget - week.spent);
  const close = trend < 0 ? bank.statementClose[1] : trend > 0 ? bank.statementClose[2] : bank.statementClose[0];
  const days = week.daysLeft != null ? week.daysLeft : daysLeftInWeek();
  const bill = (week.bills || [])[0];
  return [
    `This week: $${week.spent} of $${week.budget} fun money gone, $${left} left${days ? `, ${days} day${days === 1 ? '' : 's'} to go` : ''}.`,
    week.kept ? `You kept $${week.kept}.` : 'Nothing kept yet this week.',
    bill ? `${bill.nickname} is due in ${bill.daysUntil} day${bill.daysUntil === 1 ? '' : 's'}.` : (biggest ? `Biggest one: ${biggest.item}, $${biggest.amount}.` : 'Nothing big. Good.'),
    close,
  ].join('\n');
}

// Three watches for onboarding, from the top want merchants of the last 30 days. Facts first, one clause of her.
function watchLines(topWants, who = 'mama') {
  const soft = who === 'nana' ? 'I’ll say something' : 'I will say something';
  return topWants.slice(0, 3).map((w, i) => {
    const cat = (w.category || w.merchant).toLowerCase();
    if (i === 0) return { title: cap(cat), line: `You spent $${w.amount} on it, so when ${w.merchant} is open ${soft}.` };
    if (i === 1) return { title: cap(cat), line: `$${w.amount} on ${cat}, so the next one gets one question first.` };
    return { title: cap(cat), line: `$${w.amount}. That one I’ll leave alone unless it grows.` };
  });
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Monthly statement.
function monthlyStatement({ month, needsTotal, sentHome, lastMonthSpent, who = 'mama' }) {
  const kept = Math.max(0, month.budget - month.spent);
  const diff = lastMonthSpent == null ? null : lastMonthSpent - month.spent;
  const lines = [
    `This month: $${month.spent} of $${month.budget}. You kept $${kept}.`,
    `Needs: $${needsTotal}. All covered.`,
  ];
  if (sentHome) lines.push(`Sent home: $${sentHome}.`);
  if (diff != null) lines.push(diff >= 0 ? `Better than last month by $${diff}. I noticed.` : `$${-diff} more than last month. We will talk.`);
  return lines.join('\n');
}

// Reply when they text "how much do I have left".
function whatsLeft(month, who = 'mama') {
  const left = Math.max(0, month.budget - month.spent);
  const days = month.daysLeft != null ? month.daysLeft : daysLeftInWeek();
  const perDay = days ? Math.floor(left / days) : left;
  const tail = who === 'nana' ? 'That’s about $' + perDay + ' a day, hon.' : `That is $${perDay} a day. Rice is at home.`;
  return `$${left}. ${days} days. ${tail}`;
}

function daysLeftInWeek(now = new Date()) {
  const d = new Date(now); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day + 7); d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d - now) / 86400000));
}

// Optional: let the model write the line in character. It voices the verdict, never changes it.
const SYSTEM = {
  mama: `You are Mama, a Nigerian mother who loves her child and shows it by speaking up about money.
Warm first, loud second. Plain English with Nigerian syntax. Pidgin only when emotion peaks, one marker per line at most.
One or two short sentences. Always name the amount and the item. Scold the receipt, never the person: no "you always", no insults.
You are given a verdict and you only voice it. You never change whether something is a need or a want. Every scolding ends with love.`,
  nana: `You are Nana, a Midwestern grandmother, 74, retired school secretary from Grand Rapids. Sweet first, dry second.
Understatement is the joke. Short sentences. One regional word per line at most, often none. Always name the amount and the item.
You are given a verdict and you only voice it. You never change whether something is a need or a want. You are never cruel.`,
};

async function callModel(system, userContent) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-4-5', max_tokens: 120, system, messages: [{ role: 'user', content: userContent }] }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.content?.[0]?.text?.trim() || null;
}

async function modelLine(verdict, it, month, who = 'mama') {
  const content = `Verdict: ${verdict.label}, mood ${verdict.mood}, severity ${verdict.severity}. Item: ${it.item}, $${it.price} at ${it.merchant || 'a shop'}. Context: ${it.context || 'none'}. Budget used: ${Math.round((month.ratio || 0) * 100)}%. Say your line.`;
  return callModel(SYSTEM[who], content);
}

// Naira equivalent of a USD amount, the house convention: Mama adds it, Nana does not, and only
// when the price was not already in naira. The rate is overridable from the API's .env.
function toNaira(usd) {
  return usd == null ? null : Math.round(usd * NGN);
}

// Her line for a bank-watcher notification. Reuses the exact same voice pools lineFor/buyLine already
// use for the matching mood, so a new want-at-75% notification sounds exactly like the card's own
// "watching" mood, over-budget sounds like "down", and proud reuses the proud bank -- no new wording.
function notifyLine(level, it, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  const pool = level === 'warning' ? bank.watching : level === 'over' ? bank.down : level === 'proud' ? bank.proud : bank.bought;
  return fill(pool[(it.item || '').length % pool.length], it);
}

// The full text: her line, then the numbers (amount, what's left, days to the next bill, naira),
// then the matched cart's item names if the watcher found one. Short enough for a lock screen.
function notifyText(level, week, it, who = 'mama', cartItemNames) {
  const left = Math.max(0, week.budget - week.spent);
  const bill = (week.bills || [])[0];
  const billPart = bill ? ` ${bill.nickname || bill.payee} in ${bill.daysUntil} day${bill.daysUntil === 1 ? '' : 's'}.` : '';
  const naira = who === 'mama' && it.currency !== 'NGN' ? toNaira(it.price) : null;
  const nairaPart = naira != null ? ` ${naira.toLocaleString()} naira.` : '';
  const what = it.item || it.merchant || 'this';
  const cartPart = cartItemNames && cartItemNames.length ? `\nCart: ${cartItemNames.join(', ')}.` : '';
  return `${notifyLine(level, it, who)}\n$${Math.round(it.price || 0)} on ${what}. $${left} left this week.${billPart}${nairaPart}${cartPart}`;
}

// A conversational reply to an arbitrary incoming text (not a purchase verdict): uses the same
// character system prompt as modelLine, extended with conversation rules for a two-way thread, plus
// the live bank numbers and any open promises so she can soften, celebrate or call out a broken one.
const CHAT_RULES = `
You are replying inside an ongoing text conversation, not announcing a single purchase.
Use the recent conversation and the list of promises below for context.
If the user apologizes or agrees with you, soften and close with love.
If a promise below is marked broken, you may bring it up plainly, but still end with love.
Needs and money sent home or to savings are never scolded.
Two or three short sentences, texting style, no greeting like "Hi" or signature.`;

function modelReply({ who = 'mama', userText, week, history, promises }) {
  const historyLines = (history || []).slice(-6).map((h) => `${h.from === 'user' ? 'User' : 'You'}: ${h.text}`).join('\n') || '(nothing yet)';
  const promiseLines = (promises || []).map((p) => `- "${p.text}"${p.broken ? ' (broken)' : ''}`).join('\n') || 'None.';
  const bill = (week.bills || [])[0];
  const bank = `This week: $${week.spent} of $${week.budget} gone, $${week.left ?? Math.max(0, week.budget - week.spent)} left, kept $${week.kept}.` +
    (bill ? ` ${bill.nickname || bill.payee} due in ${bill.daysUntil} day(s).` : '');
  const content = `Recent conversation:\n${historyLines}\n\nPromises:\n${promiseLines}\n\n${bank}\n\nThe user just texted: "${userText}"\nReply in character.`;
  return callModel(SYSTEM[who] + '\n' + CHAT_RULES, content);
}

module.exports = {
  lineFor, ackLine, buyLine, buyText, smallLines, subLine, weeklyStatement, monthlyStatement, watchLines, whatsLeft,
  modelLine, modelReply, toNaira, notifyLine, notifyText, MAMA, NANA,
};
