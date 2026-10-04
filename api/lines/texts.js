// What she says in Messages when it is not a statement or a charge. Those live in writer.js.
// Same rules: numbers first, one line of her, nothing about the person, one cultural marker at most.

const { pick } = require('./pick');

const MAMA = {
  saved: ['${amount} moved to savings. My pikin. That is how it is done.', 'Good. ${amount} is in savings. I saw it.'],
  home: ['${amount} sent home. That one is never waste. Greet them for me.'],
  nothing: ['Nothing to send. Say the amount, like "send 50 home".'],
  tooMuch: ['${amount}? You have ${left} fun money left this week. Try a smaller number.'],
  unknown: ['I only talk about money. Ask me how much you have left, or say "move 20 to savings".'],
  hello: ['I am here. ${left} left this week. Ask me anything about it.'],
  thanks: ['Ehen. Go and rest.'],
  // Weighing a purchase by text (notify/weigh.js). Numbers first, the item, nothing about the person.
  whatFor: ['${item}, ${price}. What is it for?'],
  andThat: ['And ${item}, ${price}. Tell me what that one is for.'],
  fits: ['${item}, ${price}. It fits. ${left} left after.'],
  needs: ['That one is a need. Buy it.'],
  needNoted: ['Okay. ${item} is a need for you. I will not ask again.'],
  planned: ['${item} for ${occasion}. Planned, so it stays off the week. ${left} left for the rest.'],
  isThisIt: ['${item}, ${price}${store}. That is the one?'],
  wrongOne: ['Okay. Tell me the item and the price.'],
  cannotSee: ['I cannot see a price in that. Tell me what it is and how much.'],
  cheaper: ['${shop} has the same ${item} for ${price} today. That is ${left} back in the week.'],
};

const NANA = {
  saved: ['${amount} moved to savings. Well look at you, hon.', 'Okay. ${amount} is in savings.'],
  home: ['${amount} sent home. That is family. That never counts.'],
  nothing: ['Say the amount, hon. Like "send 50 home".'],
  tooMuch: ['${amount}? You have ${left} left this week, hon. Try a smaller number.'],
  unknown: ['I just do the money, hon. Ask me what is left, or say "move 20 to savings".'],
  hello: ['Hi hon. ${left} left this week.'],
  thanks: ['Any time, hon.'],
  whatFor: ['${item}, ${price}. What is it for, hon?'],
  andThat: ['And ${item}, ${price}. What is that one for?'],
  fits: ['${item}, ${price}. That fits. ${left} left after.'],
  needs: ['That is a need, hon. Go ahead.'],
  needNoted: ['Okay, hon. ${item} is a need for you. I will not ask again.'],
  planned: ['${item} for ${occasion}. Planned, so it stays off the week. ${left} left for the rest.'],
  isThisIt: ['${item}, ${price}${store}. Is that the one?'],
  wrongOne: ['Okay, hon. Tell me the item and the price.'],
  cannotSee: ['I cannot make out a price there, hon. What is it and how much?'],
  cheaper: ['${shop} has the same ${item} for ${price} today, hon. That is ${left} back in the week.'],
};

function textLine(key, { amount, left, who = 'mama', item, price, occasion, store } = {}) {
  const bank = who === 'nana' ? NANA : MAMA;
  const pool = bank[key] || bank.unknown;
  const t = pick(who, `text:${key}`, pool);
  return t.replace('${amount}', `$${Math.round(amount || 0)}`).replace(/\$\{left\}/g, `$${Math.round(left || 0)}`)
    .replace('${item}', String(item || 'That').trim()).replace('${price}', `$${Math.round(price || 0)}`)
    .replace('${occasion}', String(occasion || 'the occasion').trim().replace(/[.!?]+$/, ''))
    .replace('${store}', store ? ` at ${store}` : '').replace('${shop}', String(store || 'Another store').trim());
}

module.exports = { textLine, MAMA, NANA };
