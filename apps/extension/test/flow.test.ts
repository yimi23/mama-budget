import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ASKS, ackSub, askManyLine, crossedIntoWatching, nextCard, spoken, wantLabel } from '../lib/flow.ts';
import type { Verdict } from '@mama/shared/types';

const v = (key: string, label: Verdict['label'], react = false): Verdict => ({
  name: key, short: key, price: 0, key, label, react, mood: react ? 'shocked' : 'calm', reason: '', tags: [], line: '', ack: null, sub: '',
});
const fresh = () => ({ asked: new Set<string>(), reacted: new Set<string>() });

test('needs and small wants never open the card', () => {
  assert.equal(nextCard([v('rice', 'need'), v('dish soap', 'need'), v('chips', 'want')], fresh()), null);
});

test('a new item over the line gets one ask', () => {
  const h = fresh();
  const n = nextCard([v('rice', 'need'), v('airpods pro', 'ask')], h);
  assert.equal(n?.kind, 'ask');
  if (n?.kind === 'ask') assert.equal(n.verdict.key, 'airpods pro');
  h.asked.add('airpods pro');
  assert.equal(nextCard([v('rice', 'need'), v('airpods pro', 'ask')], h), null, 'never asks twice');
});

test('a remembered want reacts once, before any ask', () => {
  const h = fresh();
  const n = nextCard([v('camera', 'ask'), v('airpods pro', 'want', true)], h);
  assert.equal(n?.kind, 'react');
  if (n?.kind === 'react') assert.equal(n.verdict.key, 'airpods pro');
  h.reacted.add('airpods pro');
  const after = nextCard([v('camera', 'ask'), v('airpods pro', 'want', true)], h);
  assert.equal(after?.kind, 'ask');
  if (after?.kind === 'ask') assert.equal(after.verdict.key, 'camera');
});

test('several admitted wants: she reacts once, to the dearest, the rest ride along', () => {
  const n = nextCard([{ ...v('book', 'want', true), price: 27 }, { ...v('chair', 'want', true), price: 88 }, { ...v('pods', 'want', true), price: 179 }], fresh());
  assert.equal(n?.kind, 'react');
  if (n?.kind === 'react') {
    assert.equal(n.verdict.key, 'pods');
    assert.deepEqual(n.also.map((x) => x.key), ['chair', 'book']);
  }
});

test('several new items: one card listing them, within the ask budget', () => {
  const cart = ['a', 'b', 'c', 'd', 'e'].map((k) => v(k, 'ask'));
  const n = nextCard(cart, fresh());
  assert.equal(n?.kind, 'askMany');
  if (n?.kind === 'askMany') assert.deepEqual(n.verdicts.map((x) => x.key), ['a', 'b', 'c']);
  const h = fresh(); h.asked.add('x'); h.asked.add('y');
  const one = nextCard(cart, h);
  assert.equal(one?.kind, 'ask', 'one slot left means one plain ask');
  h.asked.add('z');
  assert.equal(nextCard(cart, h), null, 'budget spent: quiet');
  assert.equal(askManyLine('{n} new things. What are they for?', 3), 'Three new things. What are they for?');
});

test('the want button fits the item', () => {
  assert.equal(wantLabel('AirPods Pro'), 'I just want it');
  assert.equal(wantLabel('AirPods'), 'I just want them');
  assert.equal(wantLabel('Fujifilm Instax Mini 99'), 'I just want it');
  assert.equal(wantLabel('Signet Rings'), 'I just want them');
});

test('the acknowledgement names the number and what it did to the meter', () => {
  const week = { budget: 75, spent: 50, left: 25, kept: 40, ratio: 0.67, mood: 'calm' as const, daysLeft: 2, bills: [] };
  assert.equal(ackSub({ ...v('lens', 'need'), price: 1260.65, tags: ['remembered'] }, week), '$1261. Needs stay off the meter.');
  assert.equal(ackSub({ ...v('lamp', 'want'), price: 20, tags: ['remembered', 'fits'] }, week), '$20 against $25 left this week. It fits.');
  assert.equal(ackSub({ ...v('pods', 'want', true), price: 179, tags: ['remembered', 'blown'] }, week), null);
  assert.equal(ackSub({ ...v('rice', 'need'), price: 25, tags: ['protected'] }, week), null);
});

test('she says she is watching once, when the week crosses 75% on the way up', () => {
  const base = { budget: 75, kept: 40, daysLeft: 2, bills: [] as never[] };
  const calm = { ...base, spent: 50, left: 25, ratio: 50 / 75, mood: 'calm' as const };
  const watching = { ...base, spent: 60, left: 15, ratio: 60 / 75, mood: 'watching' as const };
  assert.equal(crossedIntoWatching(undefined, watching), true, 'a page that opens already at 75% hears it once');
  assert.equal(crossedIntoWatching(calm, watching), true);
  assert.equal(crossedIntoWatching(watching, watching), false, 'never twice');
  assert.equal(crossedIntoWatching({ ...watching, ratio: 1.2, mood: 'down' }, watching), false, 'not on the way back down');
  assert.equal(crossedIntoWatching(undefined, calm), false);
});


test('her voice gets words, never digits', () => {
  assert.equal(spoken('We said 75 dollars for the week. AirPods Pro alone is 179. That is 286,400 naira.'),
    'We said seventy five dollars for the week. AirPods Pro alone is one hundred and seventy nine. That is two hundred and eighty six thousand four hundred naira.');
  assert.equal(spoken('$25 left.'), 'twenty five dollars left.');
  assert.doesNotMatch(spoken('154 dollars past the week. $0 left.'), /\d/);
});
