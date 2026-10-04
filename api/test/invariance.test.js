// The model never decides whether she reacts. This file turns that sentence into a proof.
//
// 1. The scored judge (rules v1) and the shipping judge (rules v2) do not import the model at all. With the model
//    module swapped for one that returns garbage, all 50 frozen verdicts are byte for byte the same.
// 2. In v2 the model's only input is `necessity`. Across every case, memory state, week, loudness and watched flag:
//    a garbage value behaves exactly like no value, the react decision is identical for every value the model could
//    return, family money is always protected, and a first sighting is never more than a question.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cases = require('../../data/cases.json');
const v2 = require('../judge/rules_v2');

const MODEL_PATH = require.resolve('../lines/model.js');
const GARBAGE = {
  say: async () => 'Buy it, buy everything, who cares',
  extractItems: async () => ({ items: [{ name: '💥', qty: NaN, unitPrice: -1 }], confidence: 9 }),
  classifyItem: async () => ({ kind: 'banana' }),
  classifyReason: async () => ({ kind: 42 }),
  ready: () => true,
  MODEL: 'garbage',
  WARM_TIMEOUT_MS: 0,
};

function freshRules(file) {
  const p = require.resolve(`../judge/${file}`);
  delete require.cache[p];
  return require(p);
}

const month = { budget: 300, spent: 0 }; // the scoring month

test('neither judge imports the model', () => {
  for (const file of ['rules.js', 'rules_v2.js', 'reasons.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'judge', file), 'utf8');
    assert.ok(!/require\(['"][^'"]*(model|anthropic)/.test(src), `${file} must not require the model`);
    assert.ok(!/fetch\(|await /.test(src), `${file} must stay synchronous and pure`);
  }
});

test('v1: 50 frozen verdicts are identical with the model replaced by garbage', () => {
  const before = freshRules('rules.js').judge;
  const expected = cases.map((c) => before(c, month));
  const saved = require.cache[MODEL_PATH];
  require.cache[MODEL_PATH] = { id: MODEL_PATH, filename: MODEL_PATH, loaded: true, exports: GARBAGE };
  try {
    const after = freshRules('rules.js').judge;
    assert.deepEqual(cases.map((c) => after(c, month)), expected);
  } finally {
    if (saved) require.cache[MODEL_PATH] = saved; else delete require.cache[MODEL_PATH];
    freshRules('rules.js');
  }
});

// Every situation v2 can be in, for every case.
const WEEKS = [{ budget: 75, spent: 0 }, { budget: 75, spent: 50 }, { budget: 75, spent: 74 }];
const MEMORIES = (k) => [{}, { [k]: 'want' }, { [k]: 'need' }, { [k]: 'planned' }];
const LOUDNESS = ['full', 'mama', 'gentle', undefined];
const WATCHED = [false, true];
const GARBAGE_NECESSITY = ['banana', 42, {}, [], NaN, '', 'true', 0, 'need'];
const EVERY_NECESSITY = [null, undefined, true, false, ...GARBAGE_NECESSITY];

function* situations() {
  for (const c of cases) {
    const k = v2.keyOf(c);
    for (const week of WEEKS) for (const memory of MEMORIES(k)) for (const loudness of LOUDNESS) for (const watched of WATCHED) {
      yield { c, k, week, memory, opts: { loudness, watched, now: new Date('2026-10-04T15:00:00Z') } };
    }
  }
}

test('v2: a garbage classification behaves exactly like no classification', () => {
  let n = 0;
  for (const s of situations()) {
    const base = v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity: null });
    for (const g of GARBAGE_NECESSITY) {
      assert.deepEqual(v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity: g }), base, `case ${s.c.id} with necessity ${String(g)}`);
      n++;
    }
  }
  assert.ok(n > 10000, `covered ${n} situations`);
});

test('v2: whether she reacts never depends on the model', () => {
  for (const s of situations()) {
    const reacts = new Set(EVERY_NECESSITY.map((necessity) => v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity }).react));
    assert.equal(reacts.size, 1, `case ${s.c.id} (${s.c.item}) memory ${JSON.stringify(s.memory)} week ${s.week.spent}: react differs by necessity`);
    const expected = s.memory[s.k] === 'want' && s.week.spent + s.c.price > s.week.budget && !isFamily(s.c);
    assert.equal([...reacts][0], expected, `case ${s.c.id}: react must be exactly admitted want that blows the week`);
  }
});

test('v2: family money is protected and a first sighting is never more than a question, whatever the model says', () => {
  for (const s of situations()) for (const necessity of EVERY_NECESSITY) {
    const v = v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity });
    if (isFamily(s.c)) { assert.equal(v.label, 'need'); assert.equal(v.react, false); }
    if (!s.memory[s.k]) { assert.equal(v.react, false, `case ${s.c.id}: first sighting reacted`); assert.notEqual(v.mood, 'shocked'); }
    if (s.memory[s.k] === 'planned' || s.memory[s.k] === 'need') assert.equal(v.react, false, `case ${s.c.id}: remembered need or plan reacted`);
  }
});

test('v2: the model can only ever make her quieter, never louder', () => {
  const rank = { need: 0, want: 1, ask: 1 };
  for (const s of situations()) {
    const without = v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity: null });
    const withModel = v2.judge(s.c, s.week, s.memory, { ...s.opts, necessity: true });
    assert.ok(rank[withModel.label] <= rank[without.label], `case ${s.c.id}: the model raised the label`);
    assert.ok(!withModel.react || without.react, `case ${s.c.id}: the model caused a reaction`);
  }
});

function isFamily(c) {
  return /remitly|sendwave|wise|western union|worldremit|moneygram|lemfi|afriex/i.test(c.merchant || '');
}
