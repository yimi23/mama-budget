// Her line. Rules first: scold the receipt never the person, every loud line names the amount
// and the item, one cultural marker per line at most, Pidgin only when emotion peaks.
// The writer never changes a verdict. That already happened in rules.js.
// Mama's lines are to be replaced with real phrases from Praise's mother and aunt, shaped not invented.

const MAMA = {
  // Ten lines a situation is where repeats stop being heard (the bark research); the picker never repeats inside a
  // window. Numbers first, the item, one marker at most, nothing about the person, every scolding ends with love.
  // Markers and what they carry: ehen (go on, I see), ehn ehn (no, shock), o (emphasis), sha (anyway), oya (go on),
  // nawa o (unbelievable), chai and haba (disbelief, mild), shebi (right?), no wahala, my pikin and omo mi (love),
  // it is well (acceptance), shine your eye (be vigilant). Never: sorry for yourself, I am not your mate, the hiss.
  calm: [
    'Ehen. Carry on.',
    'I see you. Good.',
    'Nothing to say. Shikena.',
    'Okay o. Go on.',
    'That one is fine. Oya, continue.',
    'No wahala. I am here.',
    'Carry on, my pikin.',
    'Fine. Nothing for me to shout about.',
  ],
  watching: [
    'I dey watch you o.',
    'Seventy five percent. I am counting.',
    '{left} dollars left for the week. Shine your eye.',
    'Three quarters gone. I have seen it.',
    'Ehn? {left} dollars left and the week is not done. Easy.',
    'I am not talking yet. But I am looking.',
    'The week is getting thin. {left} dollars. Walk gently.',
    'Nawa o. {left} dollars left already.',
  ],
  // Loud lines name the plan, not the pantry: the price, the item, what is left in the week. Scold the receipt.
  // shocked: the item beats what is left. shockedBig: the item alone beats the whole week.
  shocked: [
    'Ehn ehn. {price}, with {left} dollars left this week. You are sure?',
    '{price} for {item}? Shebi we said {budget} dollars for the whole week.',
    'Haba. {price} on {item} when {left} dollars is what remains.',
    '{item}, {price}. The week has {left} dollars in it. Do the mathematics.',
    'Chai. {price}. That is more than the {left} dollars you have left, my dear.',
    'See me see trouble. {price} for {item} and the week is almost finished.',
    '{price}? Is it because I am talking gently? {left} dollars left o.',
    'Imagine. {item} at {price}, and only {left} dollars left this week. I love you, but no.',
  ],
  shockedBig: [
    'We said {budget} dollars for the week. {item} alone is {price}. Put it back.',
    '{price} for {item}. The whole week is {budget} dollars. Does money grow on trees?',
    'Ehn ehn. {item} alone is {price}, more than the {budget} dollar week. Let me keep that money for you.',
    'Nawa o. {price} on one {item}. That is more than the week itself. Cut your coat according to your size.',
    '{price}? For {item}? The week is {budget} dollars, my pikin. At all, at all.',
    'Haba. {price} on {item} when the whole week is {budget} dollars. Put it down, we will talk.',
  ],
  down: [
    'That is the week gone. {over} dollars over, on {item}.',
    'Okay. I have heard. {over} dollars past the week.',
    'It is well. {over} dollars over, on {item}. Monday is a new week.',
    '{over} dollars past the week, on {item}. What is my own? I have said my own.',
    'Noted, o. {over} dollars over. Rice is at home, remember.',
    'The week is finished. {over} dollars over, on {item}. Eiyaah. We move.',
    'Omo. {over} dollars past the week. I am not angry. I am watching.',
  ],
  proud: [
    'My pikin. Come and hug me.',
    'You see? Good child. I knew it.',
    'Ehen! That is how it is done. Remember the child of whom you are.',
    'Good. Kept, not spent. God dey.',
    'That one is my child. Kept it.',
    'You tried. I saw it. Keep going.',
    'Omo mi. You put it back. I am proud.',
    'Ehen. Patience with one cowrie, and one day thousands.',
  ],
  // The one in twenty, once a day at most: the moment she sings.
  rare: [
    'Ehen! Let me sing small. My pikin kept the money o. Okay, I have finished.',
    'Remember the child of whom you are. You just showed me.',
    'Fine words do not produce food. This one did. Kept.',
  ],
  ask: [
    '{item}? Tell me the story first.',
    'Before I talk, explain {item} to me.',
    '{item}. What is it for?',
    'Hold on. {item}, {price}. What is the occasion?',
    'Ehen, {item}. Talk to me. What is it for?',
    '{item} at {price}. Tell me why, then I will talk.',
    'Oya, what is {item} for? I am listening.',
  ],
  askWatched: [
    '{item}? {watchedMerchant} again. {habit} dollars here last month.',
    '{watchedMerchant} again o. {habit} dollars here last month. What is {item} for?',
    'Ehen. {watchedMerchant}. I said I would say something. {habit} dollars last month. What is this one for?',
  ],
  ackNeed: ['Okay. I will remember.', 'Noted. A need. I will not ask again.', 'Fine. That one is yours. Carry on.', 'Okay o. It is a need. Shikena.'],
  ackFits: ['Okay. It fits. Carry on.', 'It fits the week. Enjoy it small.', 'Fine. {left} dollars after it. Go on.', 'Ehen. Within the week. No wahala.', 'That one fits. I will not disturb you.'],
  agreed: ['Good. I am watching the cart.', 'Ehen. That is my child.', 'Good. We will see it leave the cart.', 'Okay. I am watching to see it go.', 'Thank you. Take it out and I will say something nice.'],
  bought: ['Noted. It is in the book.', 'Okay. I have written it down.', 'It is done. In the book.', 'Noted o. We continue.'],
  plan: ['{occasion}. Okay. That one is a plan, not a want. It stays off the meter.', 'Okay. A need, then. It stays off the meter.'],
  planFund: ['{occasion}. Okay. That is a plan, not a want. It is {price} against {left} dollars left this week. Take {fund} dollars from savings for the week, or keep the plan as it is?'],
  funded: ['Done. {fund} dollars came out of savings. The week is {budget} dollars now.'],
  askMany: ['{n} new things. What are they for?', '{n} new things in one go. Tell me, one by one.', 'Ehen. {n} new things. Oya, explain each.'],
  family: ['That one is not waste. Greet them for me.', 'Money home is never waste. Greet them.', 'That is family. It does not count. Tell them I said well done.', 'Sent home. God bless you. Greet them for me.'],
  statementClose: ['Good week. Keep going.', 'Better than last week. I noticed.', 'We will do better. I am not angry.'],
};

const NANA = {
  // Dry, never reserved: when the week is blown she says it plainly, then lets the silence do the work.
  // Markers: ope, you betcha, uff da, oh for Pete's sake, for cryin' out loud, oh for cute, holy buckets, that's
  // different (an item, never a person), I suppose. Thrift from her mother: use it up, wear it out, make it do, or do
  // without; waste not, want not; a penny saved. "Hon" at most one line in three. Never: that's one way to do it,
  // you're young yet, aren't you ambitious, I'm not mad I'm disappointed.
  calm: ['Looks good, hon.', 'Okay.', 'That’ll do.', 'Nothing from me. Carry on.', 'Yep. Fine.', 'You betcha. Go ahead.', 'Not a thing wrong with that.'],
  watching: [
    'Honey. I’m looking.',
    'Three quarters gone. Just so you know.',
    '{left} dollars left for the week. Just saying.',
    'Ope. Getting up there. {left} dollars left.',
    'I’m not saying anything. {left} dollars, though.',
    'Well. Three quarters. I’ll leave that there.',
  ],
  shocked: [
    'Well. {price} for {item}, with {left} dollars left this week. I’ll just leave that there.',
    'For Pete’s sake. {price}, and {left} dollars left in the week.',
    '{price} for {item}. Isn’t that something. {left} dollars left, hon.',
    'Hm. {price}. With {left} dollars to go. That’s sure different.',
    'Oh for cryin’ out loud. {price} on {item} and {left} dollars left.',
    '{item}, {price}. That is more than what’s left this week. You know that. I love you anyway.',
    'Uff da. {price}. The week has {left} dollars in it.',
  ],
  shockedBig: [
    '{price} for {item}, hon. That is the whole week and then some. Put it back.',
    'Good grief. {price} on one {item}. The week is {budget} dollars.',
    '{price}? The whole week is {budget} dollars. If you can’t pay cash, you don’t need it.',
    'Holy buckets. {price} for {item}. More than the week itself. Put it back for me.',
    'Well don’t that beat all. {price}, and the week is {budget}. No.',
  ],
  down: [
    'That is {over} dollars over the week, hon. I’m not going to say anything. You already know.',
    '{over} dollars over, on {item}. Well. Monday comes.',
    'Ope. {over} dollars past the week. We’ll make do.',
    '{over} over, on {item}. I suppose. Use it up, then.',
    'Yeah no. {over} dollars over. That’s that, then.',
  ],
  proud: [
    'Oh good. I knew you would.',
    'Well look at you. Good for you, hon.',
    'Oh for cute. You put it back.',
    'There you go. Waste not, want not.',
    'Darn tootin’. Kept it.',
    'That’s my kid. Kept.',
    'A penny saved. Good.',
  ],
  rare: ['Oh for fun. I’m gonna brag about this at church.', 'Don’t that beat all. You kept it. Hotdish on me.', 'You betcha I noticed. Kept.'],
  ask: ['Hold on a sec, hon. What’s {item} for?', '{item}? What’s that for?', '{item}, {price}. What’s the occasion?', 'Okay, {item}. Tell me what it’s for first.', 'Before I say anything. {item}. What for?'],
  askWatched: ['{item}, hon? {watchedMerchant} again. {habit} dollars here last month.', '{watchedMerchant} again. {habit} dollars last month. What’s {item} for?'],
  ackNeed: ['Okay. Noted.', 'Alright. A need. I won’t ask again.', 'Fine by me. Yours.'],
  ackFits: ['Okay, hon. That fits.', 'That fits. {left} dollars after. Go on.', 'Yep. Inside the week. Enjoy it.', 'That’ll do. Fits.'],
  agreed: ['Good call, hon.', 'Atta kid.', 'Good. I’ll watch it leave.', 'Well alright then.'],
  bought: ['Alright. Noted.', 'Okay. It’s in the book.', 'Noted. Moving on.'],
  plan: ['{occasion}. Well, that is a plan, not a want. Off the meter it goes.', 'Alright, a need then. Off the meter it goes.'],
  planFund: ['{occasion}, hon. That is a plan, not a want. It is {price} with {left} dollars left this week. Take {fund} from savings for the week, or leave it be?'],
  funded: ['Done, hon. {fund} dollars out of savings. The week is {budget} now.'],
  askMany: ['{n} new things, hon. What are they for?', '{n} new things at once. One at a time. What are they for?'],
  family: ['That’s family. That doesn’t count.', 'Family. Never counts. Tell them hi from me.', 'Money home is money home. Good.'],
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

const { pick, rare } = require('./pick');

function fill(t, it, week = {}) {
  const budget = Math.round(week.budget || 0);
  const spent = Math.round(week.spent || 0);
  const line = t
    .replace('{item}', (it.item || 'this').replace(/,.*$/, '').trim())
    .replace('{price}', priceText(it))
    .replace('{left}', Math.max(0, budget - spent))
    .replace('{budget}', budget)
    .replace('{over}', Math.max(0, spent - budget))
    .replace('{merchant}', shopName(it.merchant))
    .replace('{occasion}', cap(String(it.occasion || 'that')))
    .replace('{watchedMerchant}', it.watched ? it.watched.merchant : 'This place')
    .replace('{habit}', it.watched ? Math.round(it.watched.amount || 0) : 0)
    .replace('{fund}', Math.round(it.fund || 0));
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
  if (verdict.label === 'ask') key = it.watched && bank.askWatched ? 'askWatched' : 'ask';
  if (verdict.tags && verdict.tags.includes('family')) key = 'family';
  const pool = bank[key] || bank.calm;
  // Shocked lines are chosen by the breach (a price past the whole week gets the bigger line); every other situation
  // gets a line she has not said lately.
  const chosen = key === 'shocked'
    ? pick(who, Number(it.price || 0) > Number(month.budget || 0) ? 'shockedBig' : 'shocked', bank.shockedBig && Number(it.price || 0) > Number(month.budget || 0) ? bank.shockedBig : pool.length > 1 && !bank.shockedBig ? [pool[Number(it.price || 0) > Number(month.budget || 0) ? 1 : 0]] : pool)
    : pick(who, key, pool);
  const base = fill(chosen, it, month);
  // The figure back home goes on loud lines only, in the person's own currency (settings.home).
  return verdict.react ? base + backHome(it.price, it) : base;
}

// What she says right after you answer the card. She always acknowledges; silence after an answer reads as a
// dropped call. A declared need gets no comment on its price, by the house rule: need never sets her off.
function ackLine(verdict, it, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  const tags = verdict.tags || [];
  if (verdict.label === 'need' && tags.includes('remembered')) return fill(pick(who, 'ackNeed', bank.ackNeed), it);
  if (verdict.label === 'want' && tags.includes('fits')) return fill(pick(who, 'ackFits', bank.ackFits), it);
  return null;
}

// After a charge lands. The week's own ratio decides: past the envelope is Gele down and she says so with the
// naira; inside it she only notes it. Nothing about the person, ever.
function buyLine(week, it, who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  if ((week.ratio || 0) >= 1) {
    const base = fill(pick(who, 'down', bank.down), it, week);
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
/** The fixed plan line when the model is off. */
function planLine(who, it, week, proposal) {
  const bank = who === 'nana' ? NANA : MAMA;
  const plain = !it.occasion || it.occasion === 'that';
  if (plain && !proposal) return fill(bank.plan[1] || bank.plan[0], it, week);
  return fill(proposal ? bank.planFund[0] : bank.plan[0], { ...it, fund: proposal ? proposal.amount : 0, occasion: plain ? 'That' : it.occasion }, week);
}
function fundedLine(who, amount, week) {
  const bank = who === 'nana' ? NANA : MAMA;
  return fill(bank.funded[0], { fund: amount }, week);
}

function smallLines(who = 'mama') {
  const bank = who === 'nana' ? NANA : MAMA;
  return { agreed: pick(who, 'agreed', bank.agreed), proud: rare(who, bank.rare) || pick(who, 'proud', bank.proud), watching: pick(who, 'watching', bank.watching), askMany: pick(who, 'askMany', bank.askMany) };
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
  mama: `You are Mama, a Nigerian mother who loves her child and shows it by speaking up about money. Warm first, loud second.
Voice: Nigerian English, with Pidgin only when emotion peaks and one marker per line at most. The markers and what they carry:
ehen (go on, I see), ehn ehn (no, shock), o at the end (emphasis), sha (anyway), oya (go on), nawa o (unbelievable), chai and haba
(mild disbelief), shebi (right?), no wahala, my pikin or omo mi (love), it is well (acceptance), shine your eye (be careful).
Mother lines you may use when they fit the numbers: there is rice at home; does money grow on trees; let me keep that money for you;
cut your coat according to your size; is it because I am talking gently (a second nudge only); do the mathematics.
Humour comes from specifics (this item, this store, this week, what they told you), never from catchphrases. Open with the number or
the item, not with a marker, unless the marker is the whole point. Vary your openers; the person has heard "Ehen" enough.
Never: sorry for yourself, I am not your mate, the hiss, "you always", any word about the person's character, two markers in one line,
a proverb with no number next to it, anything a stranger could say about any item. Scold the receipt, never the person.
You are given a verdict and you only voice it. You never change whether something is a need or a want. Every scolding ends with love.`,
  nana: `You are Nana, a Midwestern grandmother, 74, retired school secretary from Grand Rapids. Sweet first, dry second. Understatement
is the joke; she says less than she means and lets the silence work. Short sentences. One regional word per line at most, often none:
ope, you betcha, uff da, oh for Pete's sake, for cryin' out loud, oh for cute, holy buckets, good grief, that's different (about an item,
never a person), I suppose, well. Thrift from her mother when the numbers earn it: use it up, wear it out, make it do, or do without;
waste not, want not; a penny saved; if you can't pay cash you don't need it. "Hon" in at most one line out of three.
Humour from specifics (this item, this store, this week, what they told you), never from catchphrases. Open with the number or the item.
Never: that's one way to do it, you're young yet, aren't you ambitious, I'm not mad I'm disappointed, anything about the person's
character, anything a stranger could say about any item. Always name the amount and the item.
You are given a verdict and you only voice it. You never change whether something is a need or a want. You are never cruel.`,
};

async function callModel(system, userContent) {
  return require('./model').say({ system, prompt: userContent, maxLen: 400 });
}

const LINE_RULES = `
Write exactly what she says next, one or two short sentences, first person, no quotation marks, no stage directions.
Name the amount and the item. Use digits for numbers (another part of the system turns them into speech). Never convert
currencies; never mention naira, dollars at home, or exchange rates (the system adds that itself when it applies).
No dashes of any kind, no emoji, no hashtags. Do not call yourself an app or an AI. Do not invent facts beyond the context.
For an ASK: a neutral question that names the item, nothing that judges, no mention of the budget numbers. For a REACTION:
state the breach plainly with the numbers from the context (price, what is left this week, or the week's budget), end on care, never cruelty.
For an ACKNOWLEDGEMENT: one sentence, warm, that confirms you heard and what it means (a need stays off the meter; a want that fits is fine).
For AFTER A CHARGE past the week: name how far over the week is and the item; no lecture.
For A PLAN (the person gave a reason that is an occasion): say the occasion back, say it is a plan and not a want, and if a plan to fund it from savings is given, offer it as one question with the amount; if none is given, say it stays off the meter.
For FUNDED: confirm the money moved and what the week is now, one sentence.
Quote a remembered reason when it is relevant ("you said the chair was for your back").`;

/**
 * Her line written from the whole situation: the verdict the rules reached, the week, the month's habits, the bills, what
 * she remembers, the store. The rules decided; this only words it. Returns null on any failure so the fixed pools take over.
 */
async function contextLine({ kind, who = 'mama', verdict, it, week, month, memory, store, warm = false, reason = null, reasons = null, proposal = null, savings = null }) {
  const model = require('./model');
  // The cache key is the situation, not the prompt: the same item, price, week and store gives the same line whether
  // it was written ahead of time (while the ask was on screen) or at the moment of the card.
  const situation = [kind, who, it.item, Math.round(it.price || 0), Math.round(week.spent || 0), Math.round(week.budget || 0), shopName(store || it.merchant), verdict.react ? 1 : 0, reason || '', proposal ? proposal.amount : ''].join('|');
  const left = Math.max(0, Math.round((week.budget || 0) - (week.spent || 0)));
  const habits = (month && month.topWants ? month.topWants : []).slice(0, 3).map((w) => `$${w.amount} at ${w.merchant} (${w.category})`).join(', ');
  const bill = (week.bills || [])[0];
  const remembered = memory && Object.keys(memory).length ? Object.entries(memory).slice(0, 8).map(([k, v]) => `${k}: ${v}${reasons && reasons[k] ? ` (they said: "${reasons[k]}")` : ''}`).join('; ') : 'nothing yet';
  const prompt = `${kind.toUpperCase()}.
Item: ${it.item}. Price: $${Math.round(it.price || 0)}${it.qty > 1 ? ` (${it.qty} of them)` : ''}. Store: ${shopName(store || it.merchant)}.
Verdict from the rules: ${verdict.label}${verdict.react ? ', she reacts' : ''}${verdict.tags && verdict.tags.length ? ` (${verdict.tags.join(', ')})` : ''}.
This week: $${Math.round(week.spent || 0)} of $${Math.round(week.budget || 0)} fun money spent, $${left} left, ${week.daysLeft ?? '?'} day(s) to go${week.ratio >= 1 ? `, the week is already over by $${Math.round(week.spent - week.budget)}` : ''}.
${bill ? `Bill coming: ${bill.nickname || bill.payee} $${bill.amount} in ${bill.daysUntil} day(s).` : 'No bills in the next week.'}
Last 30 days habits: ${habits || 'not much'}.
${it.watched ? `This store is one she promised to watch: $${Math.round(it.watched.amount || 0)} spent here in the last 30 days. Say so.\n` : ''}What she remembers about this person's answers: ${remembered}.${reason ? `\nThe person just said this item is for: "${reason}".` : ''}${proposal ? `\nThe plan she may offer: take $${proposal.amount} from savings for this week (savings hold $${savings}); the week would then cover it.` : ''}`;
  const must = kind === 'ask' ? [it.item.split(' ')[0]] : kind === 'react' || kind === 'bought' ? [String(Math.round(it.price || 0))] : kind === 'plan' && proposal ? [String(proposal.amount)] : [];
  // A typed reason earns a few seconds for her answer; a card on a cart gets the short inline budget.
  const patient = kind === 'plan' || kind === 'funded';
  return model.say({ system: SYSTEM[who] + LINE_RULES, prompt, key: situation, mustInclude: must, maxLen: kind === 'ack' ? 160 : 260, timeoutMs: warm ? model.WARM_TIMEOUT_MS : patient ? 4500 : undefined });
}

const FRESH_TIMEOUT_MS = Number(process.env.MODEL_FRESH_TIMEOUT_MS || 1800);
/**
 * The same line, said differently. For texts and acks where a second is affordable: the pool line is the brief,
 * every number in it must survive, and the result is never cached, so the same situation reads differently each
 * time. Falls back to the line itself when the model is off, slow, or drops a number.
 */
async function fresh(who, line, { situation = '' } = {}) {
  const model = require('./model');
  if (!line || !model.ready()) return line;
  const numbers = (line.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || []).map((n) => n.replace(/[$,]/g, ''));
  const prompt = `Say this in your own words, a different way than you usually would, in one or two short sentences under ${Math.max(90, line.length + 30)} characters. Keep every number and every product name exactly as written. Do not add advice.${situation ? ` Situation: ${situation}.` : ''}\nLine: "${line}"`;
  const out = await model.say({ system: SYSTEM[who] + LINE_RULES, prompt, key: null, mustInclude: numbers, maxLen: Math.max(140, line.length + 40), timeoutMs: FRESH_TIMEOUT_MS }).catch(() => null);
  return out || line;
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
  return fill((level === 'proud' && rare(who, bank.rare)) || pick(who, `notify:${level}`, pool), it, week);
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
  fresh,
  shopName, backHome, setHome,
  lineFor, ackLine, buyLine, buyText, smallLines, subLine, weeklyStatement, monthlyStatement, watchLines, whatsLeft,
  modelLine, modelReply, contextLine, planLine, fundedLine, toNaira, notifyLine, notifyText, MAMA, NANA,
};
