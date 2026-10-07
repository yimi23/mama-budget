// Recurring streams: bills, subscriptions and paychecks, from docs/BUDGET.md section 2.4. Pure.
//
// Key = merchant key + sign. Amounts cluster exactly, else within max(7.5%, $1); utilities up to 30% when the dates
// are tight. The median gap names the cadence. Mature at 3 hits (2 for quarterly or annual, or when the description
// says RECURRING, MEMBERSHIP or AUTOPAY). More than 6 hits in 30 days is a habit, not a bill.

const DAY = 86400;
const { merchant } = require('./merchant.js');

const CADENCE = [
  ['weekly', 6, 8], ['biweekly', 13, 15], ['semimonthly', 14, 17], ['monthly', 27, 32], ['quarterly', 85, 95], ['annual', 355, 375],
];
const RECURRING_WORDS = /\b(?:RECURRING|MEMBERSHIP|AUTOPAY|SUBSCRIPTION|AUTO-?RENEW|MONTHLY)\b/i;
const UTILITY = /\b(?:ENERGY|ELECTRIC|POWER|GAS|WATER|UTILIT|TELECOM|WIRELESS|MOBILE|INTERNET|CABLE|FIBER|DTE|CONSUMERS|MTN|AIRTEL|GLO|IKEDC|EKEDC|PHCN|SPECTRUM|COMCAST|XFINITY|VERIZON|T-MOBILE|AT&T)\b/i;
const PAYROLL = /\b(?:PAYROLL|SALARY|DIRECT DEP(?:OSIT)?|DIR DEP|PPD|ADP|GUSTO|PAYCHEX|INTUIT PAYROLL|WORKDAY|RIPPLING|SSA|SOC SEC|IRS TREAS|UI BENEFITS|PAYCOM|TRINET|JUSTWORKS)\b/i;
const HABIT_PER_30 = 6;

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const trimmedMedian = (xs) => median(xs.slice(-3));

function cadenceOf(gaps, dates) {
  if (!gaps.length) return null;
  const g = median(gaps);
  // Semi-monthly shows as two days of month (1st and 15th, 15th and last) with gaps 13 to 17.
  if (g >= 13 && g <= 17) {
    const days = dates.map((t) => new Date(t * 1000).getUTCDate());
    const distinct = new Set(days.map((d) => (d >= 28 ? 31 : d)));
    if (distinct.size <= 2 && [...distinct].some((d) => d <= 3 || d === 31) && [...distinct].some((d) => d >= 13 && d <= 17)) return { name: 'semimonthly', days: 15.2 };
    return { name: 'biweekly', days: 14 };
  }
  for (const [name, lo, hi] of CADENCE) if (g >= lo && g <= hi) return { name, days: g };
  return null;
}

function clusterAmounts(rows, loose) {
  const clusters = [];
  for (const r of rows.slice().sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
    const amt = Math.abs(r.amount);
    const c = clusters.find((cl) => Math.abs(cl.center - amt) <= Math.max(loose ? cl.center * 0.4 : cl.center * 0.075, 1));
    if (c) { c.rows.push(r); c.center = median(c.rows.map((x) => Math.abs(x.amount))); } else clusters.push({ center: amt, rows: [r] });
  }
  // A price change: two clusters of one merchant within 25%, one entirely before the other in time, whose combined
  // dates keep a regular gap. Netflix at 15.49 then 17.99 is one subscription, not two.
  clusters.sort((a, b) => a.center - b.center);
  for (let i = 0; i < clusters.length - 1; i++) {
    const a = clusters[i], b = clusters[i + 1];
    if (Math.abs(a.center - b.center) > Math.max(a.center, b.center) * 0.25) continue;
    const at = a.rows.map((r) => r.posted), bt = b.rows.map((r) => r.posted);
    const sequential = Math.max(...at) < Math.min(...bt) || Math.max(...bt) < Math.min(...at);
    if (!sequential) continue;
    const dates = [...at, ...bt].sort((x, y) => x - y);
    const gaps = dates.slice(1).map((d, k) => (d - dates[k]) / DAY);
    const g = median(gaps);
    if (gaps.every((x) => Math.abs(x - g) <= 3)) { clusters.splice(i, 2, { center: median(dates.map(() => 0).map((_, k) => Math.abs([...a.rows, ...b.rows][k].amount))), rows: [...a.rows, ...b.rows], step: true }); i--; }
  }
  return clusters;
}

/**
 * Streams from posted, non-transfer rows. Each: { id, merchant, key, direction: 'in'|'out', kind: 'income'|'bill'|'subscription'|'habit',
 * cadence, hits, amount, variable, lastAt, nextAt, status: 'mature'|'early'|'missed'|'inactive', amountChanged }.
 */
function streams(rows, now, { notRecurring = [] } = {}) {
  const usable = rows.filter((r) => !r.pending && r.posted > 0 && r.kind !== 'transfer' && r.kind !== 'cash' && r.kind !== 'refund' && !r.hidden);
  const groups = new Map();
  for (const r of usable) {
    const m = r.merchantKey ? { key: r.merchantKey, normalized: r.merchantName || r.merchantKey } : merchant(r.description, r.payee);
    if (notRecurring.includes(m.key)) continue;
    const k = `${m.key}|${r.amount < 0 ? 'out' : 'in'}`;
    const g = groups.get(k) || { key: m.key, name: m.normalized, direction: r.amount < 0 ? 'out' : 'in', rows: [] };
    g.rows.push(r);
    groups.set(k, g);
  }
  const out = [];
  const SHOP_MCC = /^(?:5[3-9]\d\d|4121|7\d\d\d)$/; // retail, food, services: a purchase, never a bill
  for (const g of groups.values()) {
    // A shop visited six or more times in a month is a habit, whatever its amounts do.
    const recent = g.rows.filter((r) => now - r.posted <= 30 * DAY).length;
    if (recent >= HABIT_PER_30 && g.direction === 'out') { out.push(stream(g, { center: median(g.rows.map((r) => Math.abs(r.amount))), rows: g.rows }, g.rows.slice().sort((a, b) => a.posted - b.posted), 'habit', null, now)); continue; }
    const shop = g.rows.some((r) => SHOP_MCC.test(String(r.mcc || '')));
    // Utilities vary with the season; pay varies with overtime and a bonus month. Both cluster loosely.
    const loose = g.direction === 'in' || UTILITY.test(g.rows[0].description) || UTILITY.test(g.name);
    for (const cl of clusterAmounts(g.rows, loose)) {
      const dated = cl.rows.slice().sort((a, b) => a.posted - b.posted);
      if (dated.length < 2) continue;
      const gaps = dated.slice(1).map((r, i) => (r.posted - dated[i].posted) / DAY);
      const span = (dated[dated.length - 1].posted - dated[0].posted) / DAY;
      if (dated.length / Math.max(span, 1) * 30 > HABIT_PER_30 && dated.length >= 4) { out.push(stream(g, cl, dated, 'habit', null, now)); continue; }
      const cad = cadenceOf(gaps, dated.map((r) => r.posted));
      if (!cad) continue;
      const tolerance = 3;
      const regular = gaps.filter((x) => Math.abs(x - cad.days) <= tolerance).length >= gaps.length - 1;
      if (!regular) continue;
      const marked = dated.some((r) => RECURRING_WORDS.test(r.description));
      const needed = cad.name === 'quarterly' || cad.name === 'annual' || marked ? 2 : 3;
      const kind = g.direction === 'in' ? 'income' : (!shop && (loose || (cad.name === 'monthly' && cl.center >= 150)) ? 'bill' : 'subscription');
      out.push(stream(g, cl, dated, kind, cad, now, dated.length >= needed ? 'mature' : 'early'));
    }
  }
  // Income needs to look like income: payroll words, or a mature recurring inflow of $200 or more.
  return out.filter((s) => s.kind !== 'income' || PAYROLL.test(s.rows[0].description) || (s.status === 'mature' && s.amount >= 200))
    .sort((a, b) => (a.nextAt || 0) - (b.nextAt || 0));
}

function stream(g, cl, dated, kind, cad, now, status = 'mature') {
  const amounts = dated.map((r) => Math.abs(r.amount));
  const last = dated[dated.length - 1];
  // A step (one price, then another) is a change, not a variable bill; a true variable bill wanders every time.
  const distinct = new Set(amounts.map((x) => x.toFixed(2)));
  const stepChange = cl.step || (distinct.size === 2 && amounts.every((x, i) => i === 0 || x === amounts[i - 1] || amounts.slice(i).every((y) => y === x)));
  const variable = !stepChange && amounts.length >= 2 && (Math.max(...amounts) - Math.min(...amounts)) / cl.center > 0.075;
  const amount = variable ? trimmedMedian(amounts) : amounts[amounts.length - 1];
  let nextAt = null;
  if (cad) {
    if (cad.name === 'monthly' || cad.name === 'semimonthly' || cad.name === 'quarterly' || cad.name === 'annual') {
      const d = new Date(last.posted * 1000);
      const months = cad.name === 'quarterly' ? 3 : cad.name === 'annual' ? 12 : cad.name === 'semimonthly' ? 0.5 : 1;
      if (months >= 1) { const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months); const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, dim)); nextAt = d.getTime() / 1000; }
      else nextAt = last.posted + Math.round(cad.days) * DAY;
    } else nextAt = last.posted + Math.round(cad.days) * DAY;
    if (nextAt + 5 * DAY < now) status = nextAt + (cad.days * 2) * DAY < now ? 'inactive' : 'missed';
  }
  const first = amounts[0], lastAmt = amounts[amounts.length - 1];
  return { id: `${g.key}|${g.direction}|${cl.center.toFixed(2)}`, merchant: g.name, key: g.key, direction: g.direction, kind, cadence: cad ? cad.name : 'frequent', hits: dated.length, amount: Math.round(amount * 100) / 100, variable, lastAt: last.posted, nextAt, status, amountChanged: !variable && Math.abs(lastAmt - first) >= 1 ? { from: first, to: lastAmt } : null, rows: dated };
}

/** Bills and subscriptions due before a moment (payday), mature and early, missed ones kept for five days. */
function dueBefore(streamsList, now, until) {
  return streamsList.filter((s) => s.direction === 'out' && s.kind !== 'habit' && s.nextAt && s.nextAt <= until && (s.status !== 'inactive') && (s.status !== 'missed' || s.nextAt + 5 * DAY >= now));
}

module.exports = { streams, dueBefore, cadenceOf, median, PAYROLL };
