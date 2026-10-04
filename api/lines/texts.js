// What she says in Messages when it is not a statement or a charge. Those live in writer.js.
// Same rules: numbers first, one line of her, nothing about the person, one cultural marker at most.

const { pick } = require('./pick');

const MAMA = {
  saved: ['${amount} moved to savings. My pikin. That is how it is done.', 'Good. ${amount} is in savings. I saw it.', '${amount} kept. Patience with one cowrie, and one day thousands.', 'Ehen. ${amount} to savings. God dey.'],
  home: ['${amount} sent home. That one is never waste. Greet them for me.', '${amount} home. Family is not spending. Tell them I said well done.', '${amount} home, sent. God bless you, my pikin.'],
  nothing: ['Nothing to send. Say the amount, like "send 50 home".', 'How much? Say it like "send 50 home" and I will do it.'],
  tooMuch: ['${amount}? You have ${left} fun money left this week. Try a smaller number.', 'Haba. ${amount} when the week has ${left} in it. Smaller.'],
  unknown: ['I only talk about money. Ask me how much you have left, or say "move 20 to savings".', 'Money matters only o. Ask what is left, or say "send 50 home".'],
  hello: ['I am here. ${left} left this week. Ask me anything about it.', '${left} left this week. I am listening.', 'Ehen. ${left} left for the week. Talk to me.', 'My pikin. ${left} left this week. What is it?', 'I dey. ${left} left. Go on.'],
  thanks: ['Ehen. Go and rest.', 'No wahala. Go well.', 'Okay o. I am here.', 'It is nothing. Shine your eye.'],
  // Weighing a purchase by text (notify/weigh.js). Numbers first, the item, nothing about the person.
  whatFor: ['${item}, ${price}. What is it for?', '${item} at ${price}. Tell me the story first.', 'Hold on. ${item}, ${price}. What is the occasion?', 'Ehen, ${item}, ${price}. Talk to me. What is it for?'],
  andThat: ['And ${item}, ${price}. Tell me what that one is for.', 'Then ${item}, ${price}. That one too, what is it for?'],
  fits: ['${item}, ${price}. It fits. ${left} left after.', '${price} for ${item}. Within the week. ${left} after it. Enjoy it small.', 'Fine. ${item} at ${price} fits. ${left} left. Carry on.', '${item}, ${price}. No wahala. ${left} left after.'],
  needs: ['That one is a need. Buy it.', 'A need. Go and buy it.', 'Buy it. Needs are not my business.', 'That is a need, my pikin. Go.'],
  needNoted: ['Okay. ${item} is a need for you. I will not ask again.', 'Noted. ${item}, a need. Shikena.', 'Fine. ${item} is yours. I have written it down.'],
  planned: ['${item} for ${occasion}. Planned, so it stays off the week. ${left} left for the rest.', 'Ehen, ${occasion}. ${item} is a plan then, not a want. Off the week. ${left} for the rest.', '${occasion}. Okay o. ${item} is planned. ${left} left for the ordinary things.'],
  isThisIt: ['${item}, ${price}${store}. That is the one?', 'I see ${item}, ${price}${store}. Shebi that is it?'],
  wrongOne: ['Okay. Tell me the item and the price.', 'No wahala. Type the item and the price for me.'],
  cannotSee: ['I cannot see a price in that. Tell me what it is and how much.', 'My eyes cannot find the price there. What is it, and how much?'],
  envelope: ['Okay. ${amount} a week it is. ${left} left for this one.', 'Noted. The week is ${amount} dollars now. ${left} left.'],
  cheaper: ['${shop} has the same ${item} for ${price} today. That is ${left} back in the week.', 'Shine your eye: ${shop}, same ${item}, ${price} today. ${left} stays in the week.', '${price} at ${shop} for the same ${item}, today. ${left} back in your pocket.'],
};

const NANA = {
  saved: ['${amount} moved to savings. Well look at you, hon.', 'Okay. ${amount} is in savings.', '${amount} put away. A penny saved.', 'There you go. ${amount} to savings.'],
  home: ['${amount} sent home. That is family. That never counts.', '${amount} home. Family is family. Good.', '${amount} home, sent. Tell them hi from me.'],
  nothing: ['Say the amount, hon. Like "send 50 home".', 'How much? "Send 50 home" and I’ll do it.'],
  tooMuch: ['${amount}? You have ${left} left this week, hon. Try a smaller number.', 'Ope. ${amount}? With ${left} left in the week. Smaller.'],
  unknown: ['I just do the money, hon. Ask me what is left, or say "move 20 to savings".', 'Money only. What’s left, or "send 50 home".'],
  hello: ['Hi hon. ${left} left this week.', '${left} left this week. What do you need?', 'Well hi. ${left} left for the week.', 'You betcha. ${left} left. Go ahead.'],
  thanks: ['Any time, hon.', 'You bet.', 'Okay then.', 'That’ll do. Go on now.'],
  whatFor: ['${item}, ${price}. What is it for, hon?', '${item}? ${price}. What’s that for?', 'Hold on. ${item}, ${price}. What’s the occasion?', 'Okay, ${item} at ${price}. Tell me what for first.'],
  andThat: ['And ${item}, ${price}. What is that one for?', 'Then ${item}, ${price}. That one too.'],
  fits: ['${item}, ${price}. That fits. ${left} left after.', '${price} for ${item}. Inside the week. ${left} after. Enjoy it.', 'Yep. ${item} at ${price} fits. ${left} left.', '${item}, ${price}. That’ll do. ${left} after.'],
  needs: ['That is a need, hon. Go ahead.', 'A need. Go on.', 'Buy it. Needs aren’t my department.', 'That’s a need. You betcha.'],
  needNoted: ['Okay, hon. ${item} is a need for you. I will not ask again.', 'Noted. ${item}, a need. Done.', 'Alright. ${item} is yours.'],
  planned: ['${item} for ${occasion}. Planned, so it stays off the week. ${left} left for the rest.', '${occasion}. Well, ${item} is a plan then, not a want. Off the week. ${left} for the rest.', 'Okay, ${occasion}. ${item} is planned. ${left} left for the everyday.'],
  isThisIt: ['${item}, ${price}${store}. Is that the one?', 'I see ${item}, ${price}${store}. That it?'],
  wrongOne: ['Okay, hon. Tell me the item and the price.', 'Alright. Type the item and the price.'],
  cannotSee: ['I cannot make out a price there, hon. What is it and how much?', 'Can’t see a price in that. What is it, and how much?'],
  envelope: ['Okay, hon. ${amount} a week. ${left} left for this one.', 'Alright. The week is ${amount} now. ${left} left.'],
  cheaper: ['${shop} has the same ${item} for ${price} today, hon. That is ${left} back in the week.', 'Same ${item} at ${shop}, ${price} today. ${left} stays in the week.', '${price} at ${shop}, same ${item}, today. ${left} back in your pocket.'],
};

const ABUELA = {
  saved: ['${amount} moved to savings. Órale, mija.', '${amount} in savings. De poquito en poquito se llena el jarrito.', 'Good. ${amount} put away. Cuida el centavo.', '${amount} to savings. Dios te bendiga, mi cielo.'],
  home: ['${amount} home, sent. That is family, mija. Never waste.', '${amount} to the family. Sacred. Tell them I send a blessing.', '${amount} home. Good. Que Dios los cuide.'],
  nothing: ['How much, mija? Say it like "send 50 home".', 'Say the amount, mi cielo. Like "send 50 home".'],
  tooMuch: ['${amount}? You have ${left} left this week, mija. Try a smaller number.', 'Híjole. ${amount}? With ${left} left in the week. Smaller.'],
  unknown: ['I only do the money, mija. Ask what is left, or say "move 20 to savings".', 'Money only, mi cielo. What is left, or "send 50 home".'],
  hello: ['I am here, mija. ${left} left this week.', '${left} left this week. Dime, what is it?', 'Órale. ${left} left for the week. Talk to me.', 'Mi cielo. ${left} left this week. What do you need?'],
  thanks: ['Ándale, mija. Go and rest.', 'De nada. Dios te bendiga.', 'Okay, mi cielo. I am here.'],
  whatFor: ['${item}, ${price}. What is it for, mija?', '${item} at ${price}. Tell me what for.', 'Hold on, mi cielo. ${item}, ${price}. What is the occasion?', '${item}, ${price}. Dime. What for?'],
  andThat: ['And ${item}, ${price}. What is that one for?', 'Then ${item}, ${price}. That one too, mija.'],
  fits: ['${item}, ${price}. It fits. ${left} left after.', '${price} for ${item}. Within the week, mija. ${left} after.', 'Okay. ${item} at ${price} fits. ${left} left. Órale.', '${item}, ${price}. Fine, mi cielo. ${left} left after.'],
  needs: ['That is a need, mija. Buy it.', 'A need. Go on.', 'Buy it. Needs are not my business, mi cielo.', 'That one is a need. Ándale.'],
  needNoted: ['Okay, mija. ${item} is a need for you. I will not ask again.', 'Noted. ${item}, a need. Done.', 'Fine, mi cielo. ${item} is yours.'],
  planned: ['${item} for ${occasion}. Planned, so it stays off the week. ${left} left for the rest.', '${occasion}, mija. ${item} is a plan then, not a want. Off the week. ${left} for the rest.', 'Okay, ${occasion}. ${item} is planned, mi cielo. ${left} left for the everyday.'],
  isThisIt: ['${item}, ${price}${store}. That is the one, mija?', 'I see ${item}, ${price}${store}. Is that it?'],
  wrongOne: ['Okay, mija. Tell me the item and the price.', 'Ándale. Type the item and the price for me.'],
  cannotSee: ['I cannot see a price in that, mija. What is it and how much?', 'My eyes cannot find the price there, mi cielo. What is it, and how much?'],
  envelope: ['Okay, mija. ${amount} a week. ${left} left for this one.', 'Ándale. The week is ${amount} dollars now. ${left} left.'],
  cheaper: ['${shop} has the same ${item} for ${price} today, mija. That is ${left} back in the week.', 'Same ${item} at ${shop}, ${price} today. ${left} stays in the week. Cuida el centavo.', '${price} at ${shop} for the same ${item}, today. ${left} back in your pocket, mi cielo.'],
};

const WONG = {
  saved: ['${amount} to savings. Good.', '${amount} put away. Zik siu sing do.', 'Saved ${amount}. Hou lek.'],
  home: ['${amount} home, sent. That is family. Good.', '${amount} to the family. Never waste.'],
  nothing: ['How much? Say "send 50 home".', 'The amount. Like "send 50 home".'],
  tooMuch: ['${amount}? ${left} left this week. Smaller.', 'Aiya. ${amount}? With ${left} left. Smaller number.'],
  unknown: ['Money only. What is left, or "move 20 to savings".', 'I do the money. Ask what is left, or say "send 50 home".'],
  hello: ['${left} left this week. Have you eaten?', '${left} left this week. What is it?', 'Mm. ${left} left for the week. Go on.'],
  thanks: ['Okay. Eat something.', 'Mm. Go on, gwaai.', 'Good. Sik faan.'],
  whatFor: ['${item}, ${price}. What is it for?', '${item} at ${price}. Tell me what for.', '${item}, ${price}. What for?'],
  andThat: ['And ${item}, ${price}. That one, what for?', 'Then ${item}, ${price}. What for?'],
  fits: ['${item}, ${price}. Fits. ${left} left after.', '${price} for ${item}. Small one. ${left} after.', 'Okay. ${item}, ${price}. Within the week. ${left} left.'],
  needs: ['A need. Buy it.', 'That is a need. Go.', 'Needs are not my business. Buy it.'],
  needNoted: ['Okay. ${item} is a need for you. I will not ask again.', 'Noted. ${item}. A need.'],
  planned: ['${item} for ${occasion}. Planned. Off the week. ${left} left for the rest.', '${occasion}. Then ${item} is a plan, not a want. ${left} for the rest.'],
  isThisIt: ['${item}, ${price}${store}. That one?', 'I see ${item}, ${price}${store}. Is that it?'],
  wrongOne: ['Okay. The item and the price.', 'Tell me the item and the price.'],
  cannotSee: ['I cannot see a price there. What is it and how much?', 'No price in that. What is it, and how much?'],
  envelope: ['Okay. ${amount} a week. ${left} left for this one.', 'Noted. ${amount} a week. ${left} left.'],
  cheaper: ['${shop} has the same ${item} for ${price} today. That is ${left} back in the week.', 'Same ${item}, ${shop}, ${price} today. ${left} stays in the week. Peng di, cheaper somewhere else, always.'],
};

const BANK = { mama: MAMA, nana: NANA, abuela: ABUELA, wong: WONG };

function textLine(key, { amount, left, who = 'mama', item, price, occasion, store } = {}) {
  const bank = BANK[who] || MAMA;
  const pool = bank[key] || bank.unknown;
  const t = pick(who, `text:${key}`, pool);
  return t.replace('${amount}', `$${Math.round(amount || 0)}`).replace(/\$\{left\}/g, `$${Math.round(left || 0)}`)
    .replace('${item}', String(item || 'That').trim()).replace('${price}', `$${Math.round(price || 0)}`)
    .replace('${occasion}', String(occasion || 'the occasion').trim().replace(/[.!?]+$/, ''))
    .replace('${store}', store ? ` at ${store}` : '').replace('${shop}', String(store || 'Another store').trim());
}

module.exports = { textLine, MAMA, NANA, ABUELA, WONG, BANK };
