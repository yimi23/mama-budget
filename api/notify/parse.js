// What did they text? Pure, so the understanding is tested without Messages. One of:
//   { intent: 'left' }                        how much do I have left / what's left / left? / wetin remain / balance
//   { intent: 'save', amount }                move 40 to savings / save 25 / put 10 away   (amount null when no number)
//   { intent: 'home', amount }                send 50 home / send $50 to mum / transfer 30 to family
//   { intent: 'hello' } | { intent: 'thanks' } | { intent: 'other' }   anything else goes to the conversation

const NUM = /\$?\s*(\d+(?:\.\d+)?)\s*(?:dollars?|bucks|usd)?/;

function parse(raw) {
  const t = String(raw || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) return { intent: 'other' };
  if (/\b(how much|what'?s|what is|wetin|how far)\b.*\b(left|remain|have|dey)\b/.test(t) || /\b(left|remaining|balance)\b\s*\??$/.test(t) || /^(left|balance)\??$/.test(t)) return { intent: 'left' };
  const amt = (m) => (m ? Number(m[1]) : null);
  if (/\b(sav(e|ings)|keep|put\b.*\baway|stash)\b/.test(t) && !/\bhome\b/.test(t)) return { intent: 'save', amount: amt(t.match(NUM)) };
  if (/\b(home|mum|mom|mama|mummy|dad|papa|family|village|send)\b/.test(t) && /\b(send|transfer|home|family|village)\b/.test(t)) return { intent: 'home', amount: amt(t.match(NUM)) };
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|mama|nana)\b/.test(t)) return { intent: 'hello' };
  if (/^(thank|thanks|thx|ok|okay|yes ma|noted)\b/.test(t)) return { intent: 'thanks' };
  return { intent: 'other' };
}

module.exports = { parse };
