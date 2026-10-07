// Transfers and card payments are resolved before anything is called spending. Three layers in order, from
// docs/BUDGET.md section 2.3: pairs across the person's own accounts, a payee vocabulary, and the account-type rule.
// Pure: rows and accounts in, the same rows out with `kind: 'transfer'` and `pairId` set where they are transfers,
// `refund: true` where a card credit is a merchant refund.

const DAY = 86400;
const PAIR_WINDOW = 3 * DAY;
const PAIR_MIN = 20;

const PAYMENT_WORDS = /\b(?:PAYMENT THANK YOU|PMT THANK YOU|THANK YOU FOR YOUR PAYMENT|AUTOPAY|AUTOMATIC PAYMENT|ONLINE PAYMENT|ACH PMT|CC PAYMENT|CREDIT CARD PAYMENT|CRCARDPMT|E-?PAYMENT|BILL ?PAY(?:MENT)?)\b/i;
const TRANSFER_WORDS = /\b(?:ONLINE TRANSFER (?:TO|FROM)|INTERNAL TRANSFER|MOBILE TRANSFER|TRANSFER (?:TO|FROM) (?:CHK|SAV|SAVINGS|CHECKING|CHECKING ACCOUNT|SAVINGS ACCOUNT)|XFER|FUNDS TRANSFER|RECURRING TRANSFER)\b/i;
const ISSUER_PAYMENT = /\b(?:CHASE CREDIT CRD|AMEX EPAYMENT|AMERICAN EXPRESS ACH|CAPITAL ONE (?:CRCARDPMT|AUTOPAY|ONLINE PMT)|DISCOVER E-?PAYMENT|CITI(?:CARD)? (?:ONLINE )?PAYMENT|APPLECARD GSBANK PAYMENT|BARCLAYCARD|SYNCHRONY|GOLDMAN SACHS)\b/i;
const SELF_MONEY_APPS = /\b(?:ACORNS|ROBINHOOD|WEALTHFRONT|BETTERMENT|COINBASE|CHIME|PIGGYVEST|COWRYWISE|RISEVEST|BAMBOO)\b/i;
const ATM = /\bATM (?:WITHDRAWAL|WD|CASH)\b/i;

const isCard = (acct) => /credit|visa|mastercard|amex|card/i.test(`${acct.name} ${acct.type || ''}`) || acct.balance < 0;

/** Match equal-and-opposite rows across different accounts within three days; each row used once, nearest date wins. */
function pairs(rows, accounts) {
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const posted = rows.filter((r) => !r.pending && r.posted > 0 && Math.abs(r.amount) >= PAIR_MIN);
  const used = new Set();
  const out = new Map(); // rowId -> pairId
  const outs = posted.filter((r) => r.amount < 0).sort((a, b) => a.posted - b.posted);
  for (const o of outs) {
    if (used.has(o.id)) continue;
    const candidates = posted
      .filter((i) => !used.has(i.id) && i.accountId !== o.accountId && Math.abs(i.amount + o.amount) < 0.005 && Math.abs(i.posted - o.posted) <= PAIR_WINDOW)
      .sort((a, b) => Math.abs(a.posted - o.posted) - Math.abs(b.posted - o.posted) || a.posted - b.posted || (a.id < b.id ? -1 : 1));
    const i = candidates[0];
    if (!i) continue;
    // Two purchases that happen to match (the $50 at Shell and the $50 at Target) must not pair: at least one side
    // has to read like money moving between the person's own accounts, or land on a card.
    const vocab = PAYMENT_WORDS.test(o.description) || TRANSFER_WORDS.test(o.description) || ISSUER_PAYMENT.test(o.description) || PAYMENT_WORDS.test(i.description) || TRANSFER_WORDS.test(i.description);
    const cardIn = byId[i.accountId] && isCard(byId[i.accountId]);
    if (!vocab && !cardIn) continue;
    const pairId = `pair:${o.id}:${i.id}`;
    used.add(o.id); used.add(i.id);
    out.set(o.id, pairId); out.set(i.id, pairId);
  }
  return out;
}

/** Rows with transfers and refunds marked. Everything else is left for the kinds step. */
function resolve(rows, accounts) {
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const paired = pairs(rows, accounts);
  return rows.map((r) => {
    const d = r.description || '';
    if (paired.has(r.id)) return { ...r, kind: 'transfer', pairId: paired.get(r.id), why: 'pair' };
    if (PAYMENT_WORDS.test(d) || TRANSFER_WORDS.test(d) || ISSUER_PAYMENT.test(d)) return { ...r, kind: 'transfer', why: 'vocabulary' };
    if (SELF_MONEY_APPS.test(d) && !/\b(?:MERCH|STORE|SHOP)\b/i.test(d)) return { ...r, kind: 'transfer', why: 'money app' };
    if (ATM.test(d)) return { ...r, kind: 'cash', why: 'atm' };
    const acct = byId[r.accountId];
    if (acct && isCard(acct) && r.amount > 0) return { ...r, kind: 'refund', why: 'credit on a card without a payment match' };
    return r;
  });
}

module.exports = { resolve, pairs, isCard, PAYMENT_WORDS, TRANSFER_WORDS };
