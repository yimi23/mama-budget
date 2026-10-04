// Her statements. Sunday 7pm closes the week with four lines; the last day of the month gets a summary.
// due() is pure. tick() sends what is due and records it in data/photon-state.json so a restart never
// sends the same statement twice. The API runs the ticker itself (it lives on the Mac with Messages);
// GET /schedule shows what is due and when, POST /schedule { now: true } sends the weekly one on the spot
// for onboarding screen 07 and the demo.

const nessie = require('../nessie/client');
const { weeklyStatement, monthlyStatement } = require('../lines/writer');
const { text, readState, writeState } = require('./text');

const HOUR = 19; // 7pm local

function weekKey(now) { const s = nessie.weekStart(now); return s.toISOString().slice(0, 10); }
function monthKey(now) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
function lastDayOfMonth(now) { return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); }

function nextSunday7(now) {
  const d = new Date(now); d.setHours(HOUR, 0, 0, 0);
  const toSunday = (7 - d.getDay()) % 7; d.setDate(d.getDate() + toSunday);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}
function nextMonthEnd7(now) {
  let d = new Date(now.getFullYear(), now.getMonth(), lastDayOfMonth(now), HOUR, 0, 0, 0);
  if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 2, 0, HOUR, 0, 0, 0);
  return d;
}

// Which statements should go out right now, given what already went.
function due(now = new Date(), state = readState()) {
  const out = [];
  if (now.getDay() === 0 && now.getHours() >= HOUR && state.weeklySentFor !== weekKey(now)) out.push('weekly');
  if (now.getDate() === lastDayOfMonth(now) && now.getHours() >= HOUR && state.monthlySentFor !== monthKey(now)) out.push('monthly');
  return out;
}

function biggestWant(filter) {
  const c = nessie.readCache();
  return c.purchases.filter((p) => p.tag === 'want' && filter(p.date)).sort((a, b) => b.amount - a.amount)[0] || null;
}

// The weekly text, built from the same week() the badge and the card read.
function weeklyText(now = new Date(), who = grandma()) {
  const week = nessie.week(now);
  const start = nessie.weekStart(now);
  const lastWeek = nessie.week(new Date(start.getTime() - 86400000));
  const trend = Math.sign(week.spent - lastWeek.spent); // more than last week is bad
  const biggest = biggestWant((d) => new Date(`${d}T12:00:00`) >= start);
  return weeklyStatement({ week, biggest, who, trend });
}

function monthlyText(now = new Date(), who = grandma()) {
  const month = nessie.month();
  const c = nessie.readCache();
  const ageDays = (d) => (now - new Date(`${d}T12:00:00`)) / 86400000;
  const needsTotal = c.purchases.filter((p) => p.tag === 'need' && ageDays(p.date) <= 30).reduce((s, p) => s + p.amount, 0);
  const sentHome = c.transfers.filter((t) => t.to === 'family' && ageDays(t.date) <= 30).reduce((s, t) => s + t.amount, 0);
  const lastMonthSpent = c.purchases.filter((p) => p.tag === 'want' && ageDays(p.date) > 30 && ageDays(p.date) <= 60).reduce((s, p) => s + p.amount, 0);
  return monthlyStatement({ month, needsTotal, sentHome, lastMonthSpent: lastMonthSpent || null, who });
}

function grandma() { return readState().grandma === 'nana' ? 'nana' : 'mama'; }

// Send one statement now. Statements are the one text a week she is always allowed, so they skip the caps.
async function send(kind, { now = new Date(), to, grandma: g } = {}) {
  if (g === 'mama' || g === 'nana') writeState({ grandma: g });
  const who = grandma();
  const body = kind === 'monthly' ? monthlyText(now, who) : weeklyText(now, who);
  const sent = await text(body, { to, prompted: true, now });
  if (sent) writeState(kind === 'monthly' ? { monthlySentFor: monthKey(now), lastMonthlyAt: now.toISOString() } : { weeklySentFor: weekKey(now), lastWeeklyAt: now.toISOString() });
  return { ok: !!sent, texted: !!sent, kind, text: body, to: sent ? sent.to : null };
}

async function tick(now = new Date()) {
  const results = [];
  for (const kind of due(now)) results.push(await send(kind, { now }));
  return results;
}

let timer = null;
function startScheduler(everyMs = 60 * 1000) {
  if (timer) return stopScheduler;
  timer = setInterval(() => { tick().catch(() => {}); }, everyMs);
  if (timer.unref) timer.unref();
  return stopScheduler;
}
function stopScheduler() { if (timer) clearInterval(timer); timer = null; }

function overview(now = new Date()) {
  const s = readState();
  return { now: now.toISOString(), due: due(now, s), next: { weekly: nextSunday7(now).toISOString(), monthly: nextMonthEnd7(now).toISOString() }, last: { weekly: s.lastWeeklyAt || null, monthly: s.lastMonthlyAt || null }, grandma: grandma(), configured: !!process.env.PHOTON_TO };
}

module.exports = { due, weeklyText, monthlyText, send, tick, startScheduler, stopScheduler, overview, nextSunday7, nextMonthEnd7, weekKey, monthKey };
