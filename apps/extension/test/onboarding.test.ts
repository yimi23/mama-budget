import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOTS, TIERS, countUp, dotIndex, formatPhone, homeFor, inHome, next, regionHome, skip, speechSeconds, toE164, words, COPY } from '../lib/onboarding.ts';

test('the happy path visits every screen in the planned order', () => {
  const p = { bank: true, texted: true };
  const seen: string[] = [];
  let s: ReturnType<typeof next> = 'welcome';
  while (s !== 'done') { seen.push(s); s = next(s, p); }
  assert.deepEqual(seen, ['welcome', 'grandma', 'bank', 'reading', 'saw', 'watch', 'phone', 'check', 'loud', 'go']);
});

test('skipping the bank skips the three screens that read the month', () => {
  assert.equal(skip('bank'), 'phone');
  assert.equal(next('bank', { bank: false, texted: false }), 'phone');
});

test('no text sent means no "Check your phone"', () => {
  assert.equal(next('phone', { bank: true, texted: false }), 'loud');
  assert.equal(next('phone', { bank: true, texted: true }), 'check');
  assert.equal(skip('phone'), 'loud');
});

test('a connected bank with nothing in it still skips her first words', () => {
  assert.equal(next('reading', { bank: true, texted: false, hasMonth: false }), 'phone');
});

test('only the bank and the phone can be skipped', () => {
  for (const s of ['welcome', 'grandma', 'reading', 'saw', 'watch', 'check', 'loud', 'go'] as const) assert.equal(skip(s), null, s);
});

test('eight dots; check shares the phone dot; welcome has none', () => {
  assert.equal(DOTS.length, 8);
  assert.equal(dotIndex('welcome'), -1);
  assert.equal(dotIndex('grandma'), 0);
  assert.equal(dotIndex('check'), dotIndex('phone'));
  assert.equal(dotIndex('go'), 7);
});

test('three tiers per grandma under her own names, same keys', () => {
  assert.deepEqual(TIERS.mama.map((t) => t.key), ['gentle', 'mama', 'full']);
  assert.deepEqual(TIERS.nana.map((t) => t.key), ['gentle', 'mama', 'full']);
  assert.equal(TIERS.nana[2]!.name, 'Nana Before Coffee');
  for (const who of ['mama', 'nana', 'abuela', 'wong'] as const) {
    assert.deepEqual(TIERS[who].map((t) => t.key), ['gentle', 'mama', 'full'], `${who} has the three tiers`);
    assert.ok(COPY[who].name && COPY[who].welcome.length > 40 && COPY[who].preview, `${who} has copy`);
  }
});

test('phone formatting and E.164', () => {
  assert.equal(formatPhone('989'), '989');
  assert.equal(formatPhone('9895550142'), '(989) 555 0142');
  assert.equal(formatPhone('1 (989) 555-0142'), '(989) 555 0142');
  assert.equal(toE164('(989) 555 0142'), '+19895550142');
  assert.equal(toE164('989555'), null);
});

test('words, naira and timing helpers', () => {
  assert.equal(words(40), 'forty'); assert.equal(words(102), 'one hundred and two');
  assert.equal(speechSeconds('Rice is at home.'), 2.2);
  assert.equal(countUp(40, 600, 0), 0); assert.equal(countUp(40, 600, 600), 40); assert.ok(countUp(40, 600, 300) > 20);
});

test('money back home follows the region, never the grandma', () => {
  assert.equal(regionHome('en-NG'), 'NGN');
  assert.equal(regionHome('en-GH'), 'GHS');
  assert.equal(regionHome('en-US'), 'none');
  assert.equal(regionHome('en'), 'none');
  assert.equal(homeFor({ grandma: 'mama' }, 'en-US'), 'none', 'Mama in the US gets no figure');
  assert.equal(homeFor({ grandma: 'nana' }, 'en-NG'), 'NGN', 'Nana in Nigeria gets naira');
  assert.equal(homeFor({ home: 'KES' }, 'en-NG'), 'KES', 'a choice beats the region');
  assert.equal(inHome(75, 'NGN'), '₦120,000');
  assert.equal(inHome(75, 'none'), null);
});
