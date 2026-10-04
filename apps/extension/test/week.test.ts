import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKey } from '@mama/shared/week';

test('every day of a week shares its Monday', () => {
  assert.equal(weekKey(new Date(2026, 9, 3, 22, 40)), '2026-09-28'); // Saturday Oct 3
  assert.equal(weekKey(new Date(2026, 8, 28, 0, 0)), '2026-09-28'); // Monday itself
  assert.equal(weekKey(new Date(2026, 9, 4, 23, 59)), '2026-09-28'); // Sunday night
  assert.equal(weekKey(new Date(2026, 9, 5, 0, 5)), '2026-10-05'); // the Monday rollover
});
