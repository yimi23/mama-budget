// What she says in Messages when it is not a statement or a charge. Those live in writer.js.
// Same rules: numbers first, one line of her, nothing about the person, one cultural marker at most.

const MAMA = {
  saved: ['${amount} moved to savings. My pikin. That is how it is done.', 'Good. ${amount} is in savings. I saw it.'],
  home: ['${amount} sent home. That one is never waste. Greet them for me.'],
  nothing: ['Nothing to send. Say the amount, like "send 50 home".'],
  tooMuch: ['${amount}? You have ${left} fun money left this week. Try a smaller number.'],
  unknown: ['I only talk about money. Ask me how much you have left, or say "move 20 to savings".'],
  hello: ['I am here. ${left} left this week. Ask me anything about it.'],
  thanks: ['Ehen. Go and rest.'],
};

const NANA = {
  saved: ['${amount} moved to savings. Well look at you, hon.', 'Okay. ${amount} is in savings.'],
  home: ['${amount} sent home. That is family. That never counts.'],
  nothing: ['Say the amount, hon. Like "send 50 home".'],
  tooMuch: ['${amount}? You have ${left} left this week, hon. Try a smaller number.'],
  unknown: ['I just do the money, hon. Ask me what is left, or say "move 20 to savings".'],
  hello: ['Hi hon. ${left} left this week.'],
  thanks: ['Any time, hon.'],
};

function textLine(key, { amount, left, who = 'mama' } = {}) {
  const bank = who === 'nana' ? NANA : MAMA;
  const pool = bank[key] || bank.unknown;
  const t = pool[Math.round(amount || left || 0) % pool.length];
  return t.replace('${amount}', `$${Math.round(amount || 0)}`).replace('${left}', `$${Math.round(left || 0)}`);
}

module.exports = { textLine, MAMA, NANA };
