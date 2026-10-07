// The Sunday report: six lines of numbers in her order, and the five fields of the report card. Pure.
// docs/research/HOUSE_AND_SUNDAY.md section B: headline first (what stayed or what went over, with the carry), one
// comparison to last week, the one biggest item with its day, the streak or the grace (a miss is never a failure),
// the jar beside any overage, and the Monday prompt with her one line. Amounts, items and the week's numbers only;
// nothing about the person.
const round = (n) => Math.round(n || 0);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * @param {object} r
 * @param {{ envelope:number, spent:number, kept:number }} r.week   this week (closed on Sunday, so far mid-week)
 * @param {{ spent:number }|null} r.lastWeek
 * @param {{ item:string, amount:number, day?:string|null }|null} r.biggest   biggest want this week
 * @param {number} r.streak  weeks kept in a row, this week included when it is closed and kept
 * @param {boolean} r.graced  this week was forgiven
 * @param {number} r.jar
 * @param {number} r.nextEnvelope  what goes in Monday, after any carry
 * @param {number} r.carry  how much of the overage carries
 * @param {boolean} r.closed  Sunday has closed the week
 * @param {string} r.close  her one line, from the writer's statementClose pool
 */
function report(r) {
  const env = round(r.week.envelope), spent = round(r.week.spent), kept = round(r.week.kept);
  const over = Math.max(0, spent - env), stayed = Math.max(0, env - spent);
  const last = r.lastWeek ? round(r.lastWeek.spent) : null;
  const arrow = last == null ? null : spent < last ? 'better' : spent > last ? 'worse' : 'same';
  const sofar = r.closed ? '' : ' so far';
  const lines = [];
  lines.push(over > 0
    ? `$${over} over this week${sofar}: $${spent} of $${env} gone.${r.closed && r.carry ? ` $${round(r.carry)} carries to Monday.` : ''}`
    : `$${stayed} stayed in the envelope${sofar}. $${spent} of $${env} gone.`);
  if (last != null) lines.push(arrow === 'better' ? `Last week $${last} went. Better.` : arrow === 'worse' ? `Last week $${last} went. More this week.` : `Same as last week, $${last}.`);
  lines.push(r.biggest ? `Biggest thing: ${r.biggest.item}, $${round(r.biggest.amount)}${r.biggest.day ? `, ${r.biggest.day}` : ''}.` : 'Nothing big. Good.');
  lines.push(r.graced ? `Grace used this month. The streak stands at ${r.streak}.` : over > 0 && r.closed ? 'A new streak starts Monday.' : r.streak >= 2 ? `${r.streak} weeks kept in a row.` : r.streak === 1 ? 'One week kept.' : r.closed ? 'First week on the record.' : 'The streak starts this Sunday.');
  lines.push(`${kept ? `You put back $${kept}. ` : ''}The jar is $${round(r.jar)}.`);
  lines.push(`Monday: $${round(r.nextEnvelope)} goes in.${r.biggest && over > 0 ? ` One less ${r.biggest.item} and the week is yours.` : ''}${r.close ? ` ${r.close}` : ''}`);
  const fields = {
    result: { stayed, over, spent, envelope: env, arrow, lastWeekSpent: last, closed: !!r.closed },
    biggest: r.biggest ? { item: r.biggest.item, amount: round(r.biggest.amount), day: r.biggest.day || null } : null,
    streak: { weeks: r.streak || 0, graced: !!r.graced },
    jar: round(r.jar), kept,
    monday: { envelope: round(r.nextEnvelope), carry: round(r.carry) },
  };
  return { lines, text: lines.join('\n'), fields };
}

/** The day name for a YYYY-MM-DD or a unix second. */
function dayName(d) {
  const date = typeof d === 'number' ? new Date(d * 1000) : new Date(`${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : DAYS[date.getDay()];
}

module.exports = { report, dayName };
