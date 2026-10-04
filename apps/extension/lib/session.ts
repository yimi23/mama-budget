// Loaded only after detect.ts fires. Reads the cart, watches for changes, hands each new read to the worker.
// Never caches DOM nodes: every tick re queries from the document.

import type { Answer, CartRead, JudgeReply, Mood, Verdict, Week } from '@mama/shared/types';
import type { HandledLists, Message } from '@mama/shared/messages';
import { mountBadge, type Badge, type Grandma } from './ui/badge';
import { mountCard, type Card } from './ui/card';
import { nextCard, wantLabel, type Handled } from './flow';
import { storeKey } from '@mama/shared/store-key';
import { toUSD } from '@mama/shared/currency';
import { readCart, readKey } from './readers';
import { addsUp } from './readers/settle';

const DEBOUNCE_MS = 400;
const AFTER_ADD_MS = 1200;
// A read that does not add up to the page subtotal is a cart still rendering. Wait; accept it if it holds this long
// (some stores show discounts that never add up).
const SETTLE_MS = 1500;

let lastKey = '(start)';
let unsettledKey = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let reading = false;
let started = false;
let badge: Badge | undefined;
let card: Card | undefined;
let lastRead: CartRead | null = null;
let talking = false;
// Mirrors the worker's per browser session lists (storage.session), so reloads and other tabs never repeat her.
// Answers themselves are durable in storage.local through the worker.
const handled: Handled = { asked: new Set(), reacted: new Set() };

async function send<T>(msg: Message): Promise<T | null> {
  // After an extension reload this script is orphaned; the runtime id disappears.
  if (!browser.runtime?.id) return null;
  try {
    return (await browser.runtime.sendMessage(msg)) as T;
  } catch {
    return null; // worker asleep or reloaded: silent
  }
}

type JudgeResult = ({ ok: true; handled: HandledLists } & JudgeReply) | { ok: false };

async function judge(read: CartRead): Promise<JudgeResult | null> {
  // The envelope is in USD; a naira or pound cart is judged in dollars.
  const items = read.items.map((i) => ({ ...i, unitPrice: Math.round(toUSD(i.unitPrice, read.currency) * 100) / 100 }));
  return send<JudgeResult>({ type: 'JUDGE', store: storeKey(location.href), items });
}

async function grandma(): Promise<Grandma> {
  try {
    const { settings } = await browser.storage.local.get('settings');
    return (settings as { grandma?: Grandma } | undefined)?.grandma === 'nana' ? 'nana' : 'mama';
  } catch {
    return 'mama';
  }
}

function showWeek(g: Grandma, week: Week, mood: Mood = week.mood) {
  badge ??= mountBadge();
  card ??= mountCard(badge.root);
  badge.update({ grandma: g, mood, ratio: week.ratio, left: week.left, daysLeft: week.daysLeft });
}

function hideAll() {
  card?.close();
  badge?.hide();
}

/** Judge the cart, set the badge, and hold at most one conversation at a time. */
async function talk(read: CartRead | null) {
  lastRead = read;
  if (!read || !read.items.length) return hideAll();
  if (talking) return; // the conversation in progress picks up the newest read when it ends
  talking = true;
  try {
    const g = await grandma();
    let reply = await judge(read);
    if (!reply?.ok) {
      console.info('[mama] API not answering, staying hidden');
      return hideAll();
    }
    console.info(
      `[mama] judged, $${Math.round(reply.week.left)} left this week\n` +
        reply.verdicts.map((v) => `  ${v.label}${v.react ? ' (react)' : ''}  ${v.short}  ${v.reason}`).join('\n'),
    );
    for (const k of reply.handled.asked) handled.asked.add(k);
    for (const k of reply.handled.reacted) handled.reacted.add(k);
    showWeek(g, reply.week);
    for (let next = nextCard(reply.verdicts, handled); next; next = reply.ok ? nextCard(reply.verdicts, handled) : null) {
      if (next.kind === 'react') await react(g, reply.week, next.verdict);
      else {
        const wanted = await ask(g, reply.week, next.verdict);
        if (!wanted) continue;
        // "I just want them": judge again with the answer remembered. She reacts only if the envelope says so.
        const again = await judge(lastRead ?? read);
        if (!again?.ok) return hideAll();
        reply = again;
        const v = reply.verdicts.find((x) => x.key === next!.verdict.key);
        if (!v?.react) showWeek(g, reply.week); // it fits the week: a nod, nothing more
      }
      if (lastRead !== read && lastRead) {
        const fresh = await judge(lastRead);
        if (!fresh?.ok) return hideAll();
        reply = fresh;
      }
    }
    showWeek(g, reply.week);
  } finally {
    talking = false;
  }
}

async function answer(key: string, a: Answer) {
  await send({ type: 'ANSWER', key, answer: a });
}

/** The neutral ask: watching face, meter still, no voice. Returns true for "I just want them". */
async function ask(g: Grandma, week: Week, v: Verdict): Promise<boolean> {
  handled.asked.add(v.key);
  send({ type: 'MARK', kind: 'asked', key: v.key });
  showWeek(g, week, 'watching');
  const choice = await card!.ask({
    grandma: g, mood: 'watching', tone: 'ask', line: v.line,
    sub: 'She asks once and remembers your answer.',
    primary: 'It\u2019s for something', secondary: wantLabel(v.short),
  });
  if (choice === 'primary') { await answer(v.key, 'need'); showWeek(g, week); return false; }
  if (choice === 'secondary') { await answer(v.key, 'want'); return true; }
  showWeek(g, week);
  return false;
}

/** A want she has the right to react to. Once per item. Buy anyway always works and touches nothing on the store. */
async function react(g: Grandma, week: Week, v: Verdict) {
  handled.reacted.add(v.key);
  send({ type: 'MARK', kind: 'reacted', key: v.key });
  showWeek(g, week, v.mood);
  badge!.shake();
  await card!.ask({
    grandma: g, mood: v.mood, tone: 'alarm', line: v.line, sub: v.sub,
    primary: g === 'nana' ? 'You\u2019re right, Nana' : 'You\u2019re right, Mama', secondary: 'Buy anyway',
  });
}

async function tick() {
  if (reading) return;
  reading = true;
  try {
    const read: CartRead | null = await readCart(document, location.href);
    const key = readKey(read);
    if (key === lastKey) return;
    if (!read) {
      if (lastKey !== 'none') console.info(`[mama] cart page on ${location.hostname}, no reader found items yet`);
      lastKey = 'none';
      talk(null);
      return;
    }
    if (!addsUp(read) && key !== unsettledKey) {
      unsettledKey = key;
      schedule(SETTLE_MS);
      return;
    }
    unsettledKey = '';
    lastKey = key;
    // Plain text so a copied console line shows the whole read.
    console.info(
      `[mama] cart via ${read.via}, subtotal ${read.subtotal ?? '?'} ${read.currency}\n` +
        read.items.map((i) => `  ${i.qty} x ${i.unitPrice}  ${i.name}`).join('\n'),
    );
    send({ type: 'CART_READ', store: storeKey(location.href), url: location.origin + location.pathname, read });
    talk(read);
  } finally {
    reading = false;
  }
}

export function schedule(delay = DEBOUNCE_MS) {
  clearTimeout(timer);
  timer = setTimeout(tick, delay);
}

/** Called once by content.ts when the gate opens. Safe to call again. */
export function start(ctx: { onInvalidated(cb: () => void): void }, reason: 'cart' | 'add') {
  schedule(reason === 'add' ? AFTER_ADD_MS : 0);
  if (started) return;
  started = true;
  const observer = new MutationObserver(() => schedule());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  ctx.onInvalidated(() => { observer.disconnect(); clearTimeout(timer); badge?.destroy(); });
}
