// The connections between the pieces are not unit testable in node (they need Chrome), so this reads the source:
// every message type in the contract has a worker handler, and the session really sends what the plan says it does.
// It exists because two edits once silently failed to land and 90 green tests did not notice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const messages = read('../../../packages/shared/src/messages.ts');
const worker = read('../entrypoints/background.ts');
const session = read('../lib/session.ts');

test('every message type in the contract has a handler in the worker', () => {
  const types = [...messages.matchAll(/\|\s*\{\s*type:\s*'([A-Z_]+)'/g)].map((m) => m[1]!);
  assert.ok(types.length >= 10, `found ${types.length} message types`);
  for (const t of types) assert.ok(worker.includes(`case '${t}':`), `worker handles ${t}`);
});

test('the session sends what the card promises', () => {
  const sends = {
    "type: 'JUDGE'": 'judges the cart',
    "type: 'ANSWER'": 'stores the answer',
    "type: 'MARK'": 'marks asked and reacted',
    "type: 'BUY'": 'Buy anyway charges the bank',
    "type: 'SPEAK'": 'her voice on the Shocked card',
    "type: 'CART_READ'": 'keeps the last cart for confirmation pages',
    "type: 'PUT_BACK'": 'put it back moves Kept in the ledger',
    "type: 'CUE'": 'the proud cue when it leaves the cart',
  };
  for (const [needle, why] of Object.entries(sends)) assert.ok(session.includes(needle), `${why}: ${needle}`);
  assert.ok(session.includes('putBack.set('), "You're right watches the item");
  assert.ok(session.includes('lines.proud'), 'proud when it leaves the cart');
  assert.ok(session.includes('lines.agreed'), "You're right is acknowledged");
  assert.ok(session.includes('crossedIntoWatching('), 'the watching bubble at 75%');
  assert.ok(session.includes("card!.askMany("), 'several items get one card');
  assert.ok(session.includes("mark?.show("), 'the cart row is marked while a card is up');
});

test('every send in the extension uses a type the contract knows', () => {
  const known = new Set([...messages.matchAll(/type:\s*'([A-Z_]+)'/g)].map((m) => m[1]!));
  for (const file of ['../lib/session.ts', '../entrypoints/popup/main.ts', '../entrypoints/practice/main.ts', '../entrypoints/content.ts']) {
    const src = read(file);
    for (const m of src.matchAll(/type:\s*'([A-Z_]+)'/g)) assert.ok(known.has(m[1]!), `${file} sends unknown ${m[1]}`);
  }
});
