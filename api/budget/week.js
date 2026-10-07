// The week's rules. docs/BUDGET.md section 2.8 and the Oct 5 decisions in section 9. Pure.
//
// - Only wants move the meter. Needs, bills, transfers and refunds are reported, never scolded.
// - Unspent fun money is swept into the Kept jar at Sunday close; it never rolls into next week.
// - An overage carries into next week's envelope, capped at half the envelope.
// - Grace: one a month, plus one banked for every four weeks kept in a row (two banked at most); grace covers a
//   week no more than 25% over and keeps the streak alive.
// - Weeks kept is the streak.
//
// State: { envelope, closes: [{ weekStart, spent, envelope, kept, over, graced }], graces: { used: [monthKey], banked },
//          jar } with weekStart as YYYY-MM-DD (Monday).

const DAY = 86400;
const round = (n) => Math.round(n * 100) / 100;

function weekStart(ts) {
  const d = new Date(ts * 1000);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day); d.setUTCHours(0, 0, 0, 0);
  return d.getTime() / 1000;
}
const key = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
const monthKey = (ts) => key(ts).slice(0, 7);

/** This week, from classified rows: spent (wants only), kept so far, and the envelope after any carry. */
function current(rows, state, now, putBacks = []) {
  const start = weekStart(now), end = start + 7 * DAY;
  const inWeek = (r) => { const t = r.posted || r.transactedAt; return t >= start && t < end; };
  const wants = rows.filter((r) => inWeek(r) && r.kind === 'want' && r.amount < 0);
  const spent = round(wants.reduce((s, r) => s + -r.amount, 0));
  const needs = round(rows.filter((r) => inWeek(r) && r.kind === 'need' && r.amount < 0).reduce((s, r) => s + -r.amount, 0));
  const bills = round(rows.filter((r) => inWeek(r) && r.kind === 'bill' && r.amount < 0).reduce((s, r) => s + -r.amount, 0));
  const lastClose = (state.closes || []).slice().sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
  const carry = lastClose && lastClose.weekStart === key(start - 7 * DAY) && !lastClose.graced ? Math.min(lastClose.over || 0, state.envelope / 2) : 0;
  const envelope = round(Math.max(0, state.envelope - carry));
  const keptSoFar = round(putBacks.filter((k) => { const t = Date.parse(k.date + 'T12:00:00Z') / 1000; return t >= start && t < end; }).reduce((s, k) => s + k.amount, 0));
  const left = round(envelope - spent);
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const ratio = envelope ? spent / envelope : 0;
  const mood = left < 0 ? 'down' : ratio >= 0.75 ? 'watching' : 'calm';
  const topWants = Object.values(wants.reduce((acc, r) => { const k = r.merchantName || r.merchantKey; acc[k] = acc[k] || { merchant: k, amount: 0 }; acc[k].amount = round(acc[k].amount + -r.amount); return acc; }, {})).sort((a, b) => b.amount - a.amount).slice(0, 3);
  return { weekStart: key(start), envelope, budget: envelope, carry, spent, left, needs, bills, kept: keptSoFar, ratio, mood, daysLeft, topWants, counts: { wants: wants.length }, streak: streak(state), jar: state.jar || 0, grace: graceAvailable(state, now) };
}

/** Grace left this month: one, plus the banked ones. */
function graceAvailable(state, now) {
  const used = (state.graces && state.graces.used) || [];
  const banked = (state.graces && state.graces.banked) || 0;
  return (used.includes(monthKey(now)) ? 0 : 1) + banked;
}

/** Consecutive weeks kept, newest first, counting a graced week as kept. */
function streak(state) {
  const closes = (state.closes || []).slice().sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  let n = 0;
  for (const c of closes) { if (c.over <= 0 || c.graced) n++; else break; }
  return n;
}

/**
 * Sunday close for the week containing `now`. Sweeps leftover into the jar, records the overage, applies grace when
 * asked and allowed, banks a grace every four kept weeks (two at most). Returns { state, close, text }.
 */
function close(rows, state, now, { useGrace = false, putBacks = [] } = {}) {
  const w = current(rows, state, now, putBacks);
  const closes = (state.closes || []).filter((c) => c.weekStart !== w.weekStart);
  const over = Math.max(0, round(w.spent - w.envelope));
  const leftover = Math.max(0, round(w.envelope - w.spent));
  let graced = false;
  const graces = { used: [...((state.graces && state.graces.used) || [])], banked: (state.graces && state.graces.banked) || 0 };
  if (over > 0 && useGrace && over <= w.envelope * 0.25 && graceAvailable(state, now) > 0) {
    graced = true;
    if (!graces.used.includes(monthKey(now))) graces.used.push(monthKey(now)); else graces.banked = Math.max(0, graces.banked - 1);
  }
  const entry = { weekStart: w.weekStart, envelope: w.envelope, spent: w.spent, kept: round(leftover + w.kept), over, graced };
  const next = { ...state, closes: [...closes, entry], graces, jar: round((state.jar || 0) + leftover + w.kept) };
  const run = streak(next);
  if (run > 0 && run % 4 === 0 && !graced) next.graces.banked = Math.min(2, next.graces.banked + 1);
  const text = over > 0 && !graced
    ? `Week closed: $${w.spent} of $${w.envelope}. $${over} over. Next week starts $${Math.min(over, state.envelope / 2)} short.`
    : over > 0 && graced
      ? `Week closed: $${w.spent} of $${w.envelope}, $${over} over. Grace used; the streak stands at ${run}.`
      : `Week closed: $${w.spent} of $${w.envelope}. $${entry.kept} kept, jar now $${next.jar}.${run >= 2 ? ` ${run} weeks in a row.` : ''}`;
  return { state: next, close: entry, text, streak: run };
}

module.exports = { current, close, streak, graceAvailable, weekStart, key, monthKey };
