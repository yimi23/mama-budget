import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDelay } from '../lib/debounce.ts';

test('a quiet page: the plain delay', () => {
  assert.equal(nextDelay(250, null, 10_000), 250);
  assert.equal(nextDelay(700, null, 10_000), 700);
});

test('a page that never goes quiet: the read runs within the ceiling of the first request', () => {
  const first = 10_000;
  assert.equal(nextDelay(250, first, first + 100), 250);
  assert.equal(nextDelay(250, first, first + 800), 200);
  assert.equal(nextDelay(250, first, first + 1000), 0);
  assert.equal(nextDelay(250, first, first + 5000), 0);
});
