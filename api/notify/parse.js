// What did they text? Pure, so the understanding is tested without Messages. One of:
//   { intent: 'left' }                        how much do I have left / what's left / left? / wetin remain / balance
//   { intent: 'save', amount }                move 40 to savings / save 25 / put 10 away   (amount null when no number)
//   { intent: 'home', amount }                send 50 home / send $50 to mum / transfer 30 to family
//   { intent: 'bought', about }               what did I buy / how much did I spend on doordash
//   { intent: 'bills' } | { intent: 'savings' }  what is due / what is in savings
//   { intent: 'hello' } | { intent: 'thanks' } | { intent: 'other' }   anything else goes to the conversation

const NUM = /\$?\s*(\d+(?:\.\d+)?)\s*(?:dollars?|bucks|usd)?/;

function parse(raw) {
  const t = String(raw || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) return { intent: 'other' };
  if (/\b(how much|what'?s|what is|wetin|how far)\b.*\b(left|remain|have|dey)\b/.test(t) || /\b(left|remaining|balance)\b\s*\??$/.test(t) || /^(left|balance)\??$/.test(t)) return { intent: 'left' };
  // Questions about the ledger, before the commands: none of them carries an amount.
  if (/\b(what|wetin|which|how much)\b.*\b(buy|bought|spent|spend|spending|purchases?|get|got)\b/.test(t) && !/\bleft\b/.test(t)) {
    const on = /\b(?:on|at|from)\s+([a-z][a-z0-9' ]{1,30})\s*\??$/.exec(t);
    return { intent: 'bought', about: on ? on[1].trim() : null };
  }
  if (/\b(bills?|due|rent|owe|upcoming|coming up)\b/.test(t) && !NUM.test(t)) return { intent: 'bills' };
  if (/\b(savings?|saved up|kept|put away)\b/.test(t) && !NUM.test(t) && !/\b(move|save|put|send|transfer)\b/.test(t)) return { intent: 'savings' };
  const amt = (m) => (m ? Number(m[1]) : null);
  // A move needs an asking verb in the present. "$50 sent home" and "Rice is at home" are statements (hers, usually),
  // never instructions: once her own confirmation came back through Messages and moved the money a second time.
  const done = /\b(sent|saved|kept|moved|transferred|put away)\b/.test(t);
  if (!done && /\b(sav(e|ings)|keep|put\b.*\baway|stash)\b/.test(t) && !/\bhome\b/.test(t)) return { intent: 'save', amount: amt(t.match(NUM)) };
  if (!done && /\b(send|transfer|wire|move|give)\b/.test(t) && /\b(home|mum|mom|mama|mummy|dad|papa|family|village|parents)\b/.test(t)) return { intent: 'home', amount: amt(t.match(NUM)) };
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|mama|nana)\b/.test(t)) return { intent: 'hello' };
  if (/^(thank|thanks|thx|ok|okay|yes ma|noted)\b/.test(t)) return { intent: 'thanks' };
  return { intent: 'other' };
}

module.exports = { parse };
