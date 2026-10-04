import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ASKS, ackSub, crossedIntoWatching, nextCard, wantLabel } from '../lib/flow.ts';
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
  assert.deepEqual([n?.kind, n?.verdict.key], ['ask', 'airpods pro']);
  h.asked.add('airpods pro');
  assert.equal(nextCard([v('rice', 'need'), v('airpods pro', 'ask')], h), null, 'never asks twice');
});

test('a remembered want reacts once, before any ask', () => {
  const h = fresh();
  const n = nextCard([v('camera', 'ask'), v('airpods pro', 'want', true)], h);
  assert.deepEqual([n?.kind, n?.verdict.key], ['react', 'airpods pro']);
  h.reacted.add('airpods pro');
  assert.equal(nextCard([v('camera', 'ask'), v('airpods pro', 'want', true)], h)?.verdict.key, 'camera');
});

test('three asks per session, the rest stay quiet', () => {
  const h = fresh();
  const cart = ['a', 'b', 'c', 'd', 'e'].map((k) => v(k, 'ask'));
  for (let i = 0; i < MAX_ASKS; i++) h.asked.add(nextCard(cart, h)!.verdict.key);
  assert.equal(nextCard(cart, h), null);
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
