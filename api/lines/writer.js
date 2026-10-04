// Her line. Rules first: scold the receipt never the person, every loud line names the amount
// and the item, one cultural marker per line at most, Pidgin only when emotion peaks.
// The writer never changes a verdict. That already happened in rules.js.
// Mama's lines are to be replaced with real phrases from Praise's mother and aunt, shaped not invented.

const MAMA = {
  calm: ['Ehen. Carry on.', 'I see you. Good.'],
  watching: ['I dey watch you o.', 'Seventy five percent. I am counting.'],
  // Loud lines name the plan, not the pantry: the price, the item, what is left in the week. Scold the receipt.
  // Picked by the breach, not by chance: [0] the item beats what is left, [1] the item alone beats the whole week.
  shocked: [
    'Ehn ehn. {price}, with {left} dollars left this week. You are sure?',
    'We said {budget} dollars for the week. {item} alone is {price}. Put it back.',
  ],
  down: ['That is the week gone. {over} dollars over, on {item}.', 'Okay. I have heard. {over} dollars past the week.'],
  proud: ['My pikin. Come and hug me.', 'You see? Good child. I knew it.'],
  ask: ['{item}? Tell me the story first.', 'Before I talk, explain {item} to me.'],
  ackNeed: ['Okay. I will remember.'],
  ackFits: ['Ehen. Carry on.', 'Okay. It fits. Carry on.'],
  agreed: ['Good. I am watching the cart.'],
  bought: ['Noted. It is in the book.'],
  askMany: ['{n} new things. What are they for?'],
  family: ['That one is not waste. Greet them for me.'],
  statementClose: ['Good week. Keep going.', 'Better than last week. I noticed.', 'We will do better. I am not angry.'],
};

const NANA = {
  calm: ['Looks good, hon.', 'Okay.'],
  watching: ['Honey. I’m looking.', 'Three quarters gone. Just so you know.'],
  // Dry, never reserved: when the week is blown she says it plainly, then lets the silence do the work.
  shocked: [
    'Well. {price} for {item}, with {left} dollars left this week. I’ll just leave that there.',
    '{price} for {item}, hon. That is the whole week and then some. Put it back.',
  ],
  down: ['That is {over} dollars over the week, hon. I’m not going to say anything. You already know.'],
  proud: ['Oh good. I knew you would.', 'Well look at you. Good for you, hon.'],
  ask: ['Hold on a sec, hon. What’s {item} for?'],
  ackNeed: ['Okay. Noted.'],
  ackFits: ['Okay, hon. That fits.'],
  agreed: ['Good call, hon.'],
  bought: ['Alright. Noted.'],
  askMany: ['{n} new things, hon. What are they for?'],
  family: ['That’s family. That doesn’t count.'],
  statementClose: ['Good week.', 'Better than last week. I noticed.', 'We’ll get there.'],
};

const NGN = Number(process.env.USD_NGN || 1600); // update before demo

// "Back home" money. The person's own currency (settings.home), never the grandma's: a Nigerian student with Nana
// still thinks in naira; an American with Mama does not want a naira figure. Rates per USD, rough, demo grade.
const HOME = {
  NGN: [NGN, 'naira'], GHS: [15.5, 'cedis'], KES: [129, 'shillings'], INR: [84, 'rupees'], PHP: [57, 'pesos'], MXN: [18, 'pesos'],
};
// The last home currency the extension sent (settings.home via /v2/judge, /v2/buy). The bank watcher composes
// texts with no request in hand, so it uses this. One person per API, by design.
let currentHome = null;
function setHome(code) { currentHome = code || null; }

/** " That is 286,400 naira." or '' when there is nothing to add (no home currency, or the store already prices in it). */
function backHome(usd, it) {
  const code = it.home === undefined ? currentHome : it.home;
  if (!code || !HOME[code] || it.currency === code || !usd) return '';
  const [rate, name] = HOME[code];
  return ` That is ${Math.round(usd * rate).toLocaleString()} ${name}.`;
}

// Product names keep their own casing ("AirPods Pro", not "airpods pro"); the line's first letter is capitalised
// after filling, so a line that opens with the item still reads as a sentence.
// "amazon.com" -> "Amazon", "jumia.com.ng" -> "Jumia", "Target" -> "Target". Her lines name the shop the way a person does.
function shopName(merchant) {
  const m = String(merchant || '').trim();
  if (!m) return 'the shop';
  if (!m.includes('.')) return m;
  const label = m.split('.')[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// week gives the plan numbers: {left} before this purchase, {budget}, and {over} once the week is past it.
// Store currency first, USD after (CLAUDE.md): on a naira store "₦286,400 (179 dollars)"; on a dollar store "179 dollars".
const SYMBOL = { NGN: '₦', GBP: '£', EUR: '€', CAD: 'CA$', GHS: 'GH₵', KES: 'KSh ', INR: '₹' };
function priceText(it) {
  const usd = Math.round(it.price || 0);
  if (it.currency && it.currency !== 'USD' && it.storePrice) {
    return `${SYMBOL[it.currency] || `${it.currency} `}${Math.round(it.storePrice).toLocaleString()} (${usd} dollars)`;
  }
  return `${usd} dollars`;
}

function fill(t, it, week = {}) {
  const budget = Math.round(week.budget || 0);
  const spent = Math.round(week.spent || 0);
  const line = t
    .replace('{item}', (it.item || 'this').replace(/,.*$/, '').trim())
    .replace('{price}', priceText(it))
    .replace('{left}', Math.max(0, budget - spent))
    .replace('{budget}', budget)
    .replace('{over}', Math.max(0, spent - budget))
    .replace('{merchant}', shopName(it.merchant));
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
  // Shocked lines are chosen by the breach; the rest vary by the item so repeats do not sound canned.
  const pick = key === 'shocked' ? (Number(it.price || 0) > Number(month.budget || 0) ? 1 : 0) : (it.item || '').length % pool.length;
  const base = fill(pool[Math.min(pick, pool.length - 1)], it, month);
  // The figure back home goes on loud lines only, in the person's own currency (settings.home).
  return verdict.react ? base + backHome(it.price, it) : base;
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
    const base = fill(bank.down[(it.item || '').length % bank.down.length], it, week);
    return base + backHome(it.price, it);
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
  return { agreed: bank.agreed[0], proud: bank.proud[0], watching: bank.watching[0], askMany: bank.askMany[0] };
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
// `here` is what she says the moment that merchant's site opens: the promise from screen 06b, kept.
function watchLines(topWants, who = 'mama') {
  const soft = who === 'nana' ? 'I’ll say something' : 'I will say something';
  const here = (w) => who === 'nana'
    ? `${w.merchant}, hon. I said I’d mention it. $${w.amount} here last month.`
    : `${w.merchant}. I said I would say something. $${w.amount} here last month.`;
  return topWants.slice(0, 3).map((w, i) => {
    const cat = (w.category || w.merchant).toLowerCase();
    const base = { title: cap(cat), merchant: w.merchant, amount: w.amount, here: here(w) };
    if (i === 0) return { ...base, line: `You spent $${w.amount} on it, so when ${w.merchant} is open ${soft}.` };
    if (i === 1) return { ...base, line: `$${w.amount} on ${cat}, so the next one gets one question first.` };
    return { ...base, line: `$${w.amount}. That one I’ll leave alone unless it grows.` };
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
  return `$${left}. ${days} day${days === 1 ? '' : 's'}. ${tail}`;
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
function notifyLine(level, it, who = 'mama', week = {}) {
  const bank = who === 'nana' ? NANA : MAMA;
  const pool = level === 'warning' ? bank.watching : level === 'over' ? bank.down : level === 'proud' ? bank.proud : bank.bought;
  return fill(pool[(it.item || '').length % pool.length], it, week);
}

// The full text: her line, then the numbers (amount, what's left, days to the next bill, naira),
// then the matched cart's item names if the watcher found one. Short enough for a lock screen.
function notifyText(level, week, it, who = 'mama', cartItemNames) {
  const left = Math.max(0, week.budget - week.spent);
  const bill = (week.bills || [])[0];
  const billPart = bill ? ` ${bill.nickname || bill.payee} in ${bill.daysUntil} day${bill.daysUntil === 1 ? '' : 's'}.` : '';
  // The figure back home follows the person's setting (see backHome), not the grandma.
  const nairaPart = backHome(it.price, it);
  const what = it.item || it.merchant || 'this';
  const cartPart = cartItemNames && cartItemNames.length ? `\nCart: ${cartItemNames.join(', ')}.` : '';
  // A transfer is not a thing you bought: "$50 sent home." not "$50 on Sent home."
  const moved = level === 'proud' && /^(sent home|moved to savings)$/i.test(what);
  const amountPart = moved ? `$${Math.round(it.price || 0)} ${what.toLowerCase()}.` : `$${Math.round(it.price || 0)} on ${what}.`;
  return `${notifyLine(level, it, who, week)}\n${amountPart} $${left} left this week.${billPart}${moved ? '' : nairaPart}${cartPart}`;
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
  shopName, backHome, setHome,
  lineFor, ackLine, buyLine, buyText, smallLines, subLine, weeklyStatement, monthlyStatement, watchLines, whatsLeft,
  modelLine, modelReply, toNaira, notifyLine, notifyText, MAMA, NANA,
};
