import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe as say, meterColor, meterHeight } from '../lib/ui/badge.ts';

test('meter color is state: green, gold from 75%, coral when the week is blown', () => {
  assert.equal(meterColor(0), '#0F7B5A');
  assert.equal(meterColor(50 / 75), '#0F7B5A');
  assert.equal(meterColor(0.75), '#E2A12A');
  assert.equal(meterColor(0.99), '#E2A12A');
  assert.equal(meterColor(1), '#D4462C');
  assert.equal(meterColor(3.4), '#D4462C');
});

test('meter height tracks the ratio, never empty, never past full', () => {
  assert.equal(meterHeight(0), 4);
  assert.equal(meterHeight(0.5), 26);
  assert.equal(meterHeight(1), 52);
  assert.equal(meterHeight(2), 52);
});

test('the badge says the number out loud for screen readers', () => {
  const s = { grandma: 'mama' as const, mood: 'calm' as const, ratio: 0.67, left: 25, daysLeft: 2 };
  assert.equal(say(s), 'Mama Budget. $25 left this week, 2 days to go.');
  assert.equal(say({ ...s, daysLeft: 1 }), 'Mama Budget. $25 left this week, 1 day to go.');
  assert.doesNotMatch(say(s), /[-–—]/, 'no dashes in copy');
});
