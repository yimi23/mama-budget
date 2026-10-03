// Runs the frozen judge over the 50 frozen cases and scores it against the mums.
// Usage: node scoring/score.js
// Labels live in data/labels/labels.json as { "labels": { "1": {"rater1":"need","rater2":"want","rater3":"need"}, ... } }
// Values: need | want | depends. Until labels arrive, this prints Mama and the baseline only.

const cases = require('../data/cases.json');
const baseline = require('../data/baseline.json');
const labelsFile = require('../data/labels/labels.json');
const { judge, merchantOnly } = require('../api/judge/rules');

const month = { budget: 300, spent: 0 }; // scoring is about the label, not the month. Keep spent at 0.

function majority(votes) {
  const v = Object.values(votes).map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (v.length < 2) return null;
  const count = (k) => v.filter((x) => x === k).length;
  if (count('need') >= 2) return 'need';
  if (count('want') >= 2) return 'want';
  if (count('depends') >= 2) return 'depends';
  return 'nomajority';
}

const rows = cases.map((c) => {
  const m = judge(c, month);
  const votes = labelsFile.labels[String(c.id)] || {};
  const ref = majority(votes);
  const unanimous = ref && Object.values(votes).length > 1 && new Set(Object.values(votes).map((x) => String(x).toLowerCase())).size === 1;
  return { id: c.id, item: c.item, ref, mama: m.label, reacted: m.react, base: merchantOnly(c.bankCategory, baseline), split: ref ? !unanimous : null };
});

const clear = rows.filter((r) => r.ref === 'need' || r.ref === 'want');
const mamaHits = clear.filter((r) => r.mama === r.ref).length;
const baseHits = clear.filter((r) => r.base === r.ref).length;
const needs = rows.filter((r) => r.ref === 'need');
const breaches = needs.filter((r) => r.reacted).length;
const unclear = rows.filter((r) => r.ref === 'depends' || r.ref === 'nomajority');
const asks = unclear.filter((r) => r.mama === 'ask').length;
const splits = rows.filter((r) => r.split === true).length;

const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'no labels yet');

console.log('MAMA BUDGET SCORE, 50 frozen cases');
console.log('Mama agreement with participating mothers:', pct(mamaHits, clear.length));
console.log('Merchant only baseline, same cases:        ', pct(baseHits, clear.length));
console.log('Need safety breaches (target zero):        ', pct(breaches, needs.length));
console.log('Asks on unclear cases:                     ', pct(asks, unclear.length));
console.log('Rater split cases out of 50:               ', clear.length + unclear.length ? splits : 'no labels yet');
console.log('');
console.table(rows.map((r) => ({ id: r.id, item: r.item.slice(0, 34), mums: r.ref || '', mama: r.mama, reacted: r.reacted ? 'yes' : '', bank: r.base })));
