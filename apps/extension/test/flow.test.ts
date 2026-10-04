import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ASKS, nextCard, wantLabel } from '../lib/flow.ts';
import type { Verdict } from '@mama/shared/types';

const v = (key: string, label: Verdict['label'], react = false): Verdict => ({
  name: key, short: key, price: 0, key, label, react, mood: react ? 'shocked' : 'calm', reason: '', tags: [], line: '', sub: '',
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
