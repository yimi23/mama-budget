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

async function modelLine(verdict, it, month, who = 'mama') {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-4-5', max_tokens: 80, system: SYSTEM[who],
      messages: [{ role: 'user', content: `Verdict: ${verdict.label}, mood ${verdict.mood}, severity ${verdict.severity}. Item: ${it.item}, $${it.price} at ${it.merchant || 'a shop'}. Context: ${it.context || 'none'}. Budget used: ${Math.round((month.ratio || 0) * 100)}%. Say your line.` }] }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.content?.[0]?.text?.trim() || null;
}

module.exports = { lineFor, ackLine, subLine, weeklyStatement, monthlyStatement, watchLines, whatsLeft, modelLine, MAMA, NANA };
