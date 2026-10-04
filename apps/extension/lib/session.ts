// Loaded only after detect.ts fires. Reads the cart, watches for changes, judges through the worker, and holds
// at most one conversation at a time. Never caches DOM nodes: every tick re queries from the document.

import type { BuyReply, CartRead, JudgeReply, Mood, Verdict, Week } from '@mama/shared/types';
import type { HandledLists, Message } from '@mama/shared/messages';
import { mountBadge, type Badge, type Grandma } from './ui/badge';
import { mountCard, type Card } from './ui/card';
import { mountBubble, type Bubble } from './ui/bubble';
import { mountPanel, type Panel } from './ui/panel';
import { ackSub, askManyLine, crossedIntoWatching, nextCard, spoken, wantLabel, type Handled } from './flow';
import { storeKey } from '@mama/shared/store-key';
import { toUSD } from '@mama/shared/currency';
import { readCart, readKey } from './readers';
import { addsUp } from './readers/settle';

const DEBOUNCE_MS = 400;
const AFTER_ADD_MS = 1200;
// A read that does not add up to the page subtotal is a cart still rendering. Wait; accept it only once it has
// held unchanged for this long (some stores show discounts that never add up).
const SETTLE_MS = 1500;
// A page that has shown no items for this long (order history, an emptied cart) stops being watched.
// An add to cart click or a navigation starts the watch again.
const IDLE_SLEEP_MS = 60_000;

interface Ctx { onInvalidated(cb: () => void): void }

let lastKey = '(start)';
let unsettledKey = '';
let unsettledAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let reading = false;
let dirty = false;
let observer: MutationObserver | undefined;
let lastItemsAt = 0;

let badge: Badge | undefined;
let card: Card | undefined;
let bubble: Bubble | undefined;
let panel: Panel | undefined;
let lastWeek: Week | undefined;
/** The last three things she said, newest first. Also kept in storage.local for the popup. */
let said: string[] = [];
/** The key just answered on a card, so the next judgement can acknowledge it. */
let justAnswered: string | null = null;
let lastRead: CartRead | null = null;
let talking = false;
/** The item name on the open card, so a card about something no longer in the cart can close. */
let discussing: string | null = null;
let lastLog = '';
let lastShown = '';
let lines: JudgeReply['lines'] = { agreed: 'Good.', proud: 'Good.', watching: 'I am watching.', askMany: '{n} new things. What are they for?' };
/** Items the person agreed to put back: when one leaves the cart, she is proud, once. */
const putBack = new Map<string, number>();
// Mirrors the worker's per browser session lists (storage.session) on every judgement, so Start over in the
// popup reaches open tabs and other tabs never repeat her. Answers themselves are durable in storage.local.
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
  // The envelope is in USD; a naira or pound cart is judged in dollars. The store currency goes along for her line.
  const items = read.items.map((i) => ({ ...i, unitPrice: Math.round(toUSD(i.unitPrice, read.currency) * 100) / 100 }));
  return send<JudgeResult>({ type: 'JUDGE', store: storeKey(location.href), currency: read.currency, items });
}

/** The chosen grandma, or null until the person has picked one in the popup. Never defaulted (PLAN: "never defaults either"). */
async function grandma(): Promise<Grandma | null> {
  try {
    const { settings } = await browser.storage.local.get('settings');
    const g = (settings as { grandma?: string } | undefined)?.grandma;
    return g === 'nana' || g === 'mama' ? g : null;
  } catch {
    return null;
  }
}
let saidPick = false;

let lastGrandma: Grandma | null = null;

function showWeek(g: Grandma, week: Week, mood: Mood = week.mood) {
  lastGrandma = g;
  if (!badge) {
    badge = mountBadge();
    card = mountCard(badge.root);
    bubble = mountBubble(badge.root);
    panel = mountPanel(badge.root);
    badge.onClick(() => {
      if (card!.open || !lastWeek) return; // a question on screen comes first
      panel!.toggle({ week: lastWeek, said });
    });
  }
  if (crossedIntoWatching(lastWeek, week)) {
    remember(lines.watching);
    bubble!.say(lines.watching, `$${Math.round(week.spent)} of $${Math.round(week.budget)} gone this week. $${Math.round(week.left)} left.`);
  }
  lastWeek = week;
  badge.update({ grandma: g, mood, ratio: week.ratio, left: week.left, daysLeft: week.daysLeft });
}

function hideAll() {
  card?.close();
  bubble?.hide();
  panel?.close();
  badge?.hide();
}

/** Everything she says on a page goes on the record, newest first, three kept. */
function remember(line: string) {
  said = [line, ...said.filter((l) => l !== line)].slice(0, 3);
  browser.storage.local.set({ said }).catch(() => {});
}

function logJudgement(reply: { ok: true } & JudgeReply) {
  const text =
    `[mama] judged, $${Math.round(reply.week.left)} left this week\n` +
    reply.verdicts.map((v) => `  ${v.label}${v.react ? ' (react)' : ''}  ${v.short}  ${v.reason}`).join('\n');
  if (text !== lastLog) console.info(text);
  lastLog = text;
}

/**
 * The conversation. Judge the newest read, set the badge, show one card, then judge again: an answer changes
 * memory, and a changed cart changes everything, so every card starts from a fresh verdict. Ends when nothing
 * is left to say or the cart is empty. Any failure hides her; nothing is ever shown as an error on a store.
 */
async function talk() {
  if (talking) return;
  talking = true;
  try {
    const g = await grandma();
    if (!g) {
      if (!saidPick) console.info('[mama] no grandma chosen yet: pick one in the popup and she starts');
      saidPick = true;
      return hideAll();
    }
    for (;;) {
      const read = lastRead;
      if (!read || !read.items.length) return hideAll();
      const reply = await judge(read);
      if (!reply?.ok) {
        console.info('[mama] API not answering, staying hidden');
        return hideAll();
      }
      logJudgement(reply);
      lines = reply.lines;
      handled.asked = new Set(reply.handled.asked);
      handled.reacted = new Set(reply.handled.reacted);
      showWeek(g, reply.week);
      if (justAnswered) {
        // She always answers an answer. A blown want gets its card below instead of a bubble.
        const v = reply.verdicts.find((x) => x.key === justAnswered);
        justAnswered = null;
        if (v?.ack && !v.react) { remember(v.ack); bubble!.say(v.ack, ackSub(v, reply.week) ?? ''); }
      }
      if (lastRead !== read) continue; // the cart moved while she was thinking
      const next = nextCard(reply.verdicts, handled);
      if (!next) return;
      // The same card twice on an unchanged cart means a mark did not land. Never loop on her.
      const keys = next.kind === 'askMany' ? next.verdicts.map((v) => v.key).join(',') : next.verdict.key;
      const stamp = `${next.kind}:${keys}:${readKey(read)}`;
      if (stamp === lastShown) return;
      lastShown = stamp;
      discussing = next.kind === 'askMany' ? null : next.verdict.name;
      try {
        if (next.kind === 'react') await react(g, reply.week, next.verdict, next.also);
        else if (next.kind === 'ask') await ask(g, reply.week, next.verdict);
        else await askMany(g, reply.week, next.verdicts);
      } finally {
        discussing = null;
      }
    }
  } catch {
    hideAll(); // context invalidated mid card, or anything else: she simply goes
  } finally {
    talking = false;
  }
}

/** A new read landed. Close a card about an item that left the cart; the running conversation picks up the rest. */
function onRead(read: CartRead | null) {
  lastRead = read;
  if (read?.items.length) lastItemsAt = Date.now();
  for (const [name, price] of putBack) {
    if (read?.items.some((i) => i.name === name)) continue;
    putBack.delete(name);
    remember(lines.proud);
    bubble?.say(lines.proud, `$${Math.round(price)} stays in the week.`);
    void send({ type: 'CUE', cue: 'proud' });
    // The money stays in the week: Kept goes up in the ledger and the badge shows the new week.
    void send<{ ok: true; week: Week } | { ok: false }>({ type: 'PUT_BACK', name, price }).then((r) => {
      if (r?.ok && lastWeek) { const g = lastGrandma; if (g) showWeek(g, r.week); }
    });
  }
  if (talking) {
    if (discussing && card?.open && !read?.items.some((i) => i.name === discussing)) card.close();
    return;
  }
  void talk();
}

/** The neutral ask: watching face, meter still, no voice. The answer is stored before she moves on. */
async function ask(g: Grandma, week: Week, v: Verdict) {
  handled.asked.add(v.key);
  await send({ type: 'MARK', kind: 'asked', key: v.key });
  showWeek(g, week, 'watching');
  panel?.close();
  remember(v.line);
  const choice = await card!.ask({
    grandma: g, mood: 'watching', tone: 'ask', line: v.line,
    sub: 'I ask once and remember your answer.',
    primary: 'It’s for something', secondary: wantLabel(v.short),
  });
  if (choice === 'primary') await send({ type: 'ANSWER', key: v.key, answer: 'need' });
  else if (choice === 'secondary') await send({ type: 'ANSWER', key: v.key, answer: 'want' });
  if (choice !== 'dismiss') justAnswered = v.key;
  showWeek(g, week);
}

/** Several new items at once: one card. Each answer is saved the moment it is tapped. */
async function askMany(g: Grandma, week: Week, vs: Verdict[]) {
  for (const v of vs) handled.asked.add(v.key);
  await Promise.all(vs.map((v) => send({ type: 'MARK', kind: 'asked', key: v.key })));
  showWeek(g, week, 'watching');
  panel?.close();
  const line = askManyLine(lines.askMany, vs.length);
  remember(line);
  let answered = 0;
  await card!.askMany({
    grandma: g, line,
    rows: vs.map((v) => ({ key: v.key, short: v.short, price: v.price, wantLabel: wantLabel(v.short) })),
    onAnswer: (key, answer) => { answered++; void send({ type: 'ANSWER', key, answer }); },
  });
  // The next judgement acknowledges one answer; with several, the reaction (if any) or the fresh badge is the answer.
  if (answered === 1) justAnswered = vs.find((v) => handled.asked.has(v.key))?.key ?? null;
  showWeek(g, week);
}

/**
 * A want she has the right to react to. Once per item, and once per round: other reactable wants in the same cart
 * ride along as already reacted, so three admitted wants get one card, about the dearest.
 * Buy anyway always works and touches nothing on the store.
 */
async function react(g: Grandma, week: Week, v: Verdict, also: Verdict[] = []) {
  handled.reacted.add(v.key);
  for (const o of also) handled.reacted.add(o.key);
  await Promise.all([v, ...also].map((x) => send({ type: 'MARK', kind: 'reacted', key: x.key })));
  showWeek(g, week, v.mood);
  panel?.close();
  remember(v.line);
  void send({ type: 'SPEAK', text: spoken(v.line), grandma: g }); // her voice: here and on Gele down only; the card never waits
  badge!.shake();
  const choice = await card!.ask({
    grandma: g, mood: v.mood, tone: 'alarm', line: v.line, sub: v.sub,
    primary: g === 'nana' ? 'You\u2019re right, Nana' : 'You\u2019re right, Mama', secondary: 'Buy anyway',
  });
  if (choice === 'primary') {
    // She never touches the store's buttons. You put it back; when it leaves the cart she is proud (onRead).
    putBack.set(v.name, v.price);
    remember(lines.agreed);
    bubble!.say(lines.agreed);
    showWeek(g, week);
    return;
  }
  if (choice !== 'secondary') return;
  // Buy anyway: the charge lands in the bank now. The meter moves, she says her line, the text goes if it can.
  const reply = await send<({ ok: true } & BuyReply) | { ok: false }>({
    type: 'BUY', store: storeKey(location.href), currency: lastRead?.currency ?? 'USD',
    item: { name: v.name, short: v.short, price: v.price },
  });
  if (!reply?.ok) return hideAll();
  showWeek(g, reply.week);
  remember(reply.line);
  if (reply.week.ratio >= 1) void send({ type: 'SPEAK', text: spoken(reply.line), grandma: g }); // Gele down
  bubble!.say(reply.line, reply.texted ? `${reply.sub} Texted.` : reply.sub);
}

async function readOnce() {
  const read: CartRead | null = await readCart(document, location.href);
  const key = readKey(read);
  if (key === lastKey) return;
  if (!read) {
    if (lastKey !== 'none') {
      console.info(`[mama] cart page on ${location.hostname}, no reader found items yet`);
      lastKey = 'none';
      onRead(null);
    }
    return;
  }
  const now = Date.now();
  if (!addsUp(read)) {
    if (key !== unsettledKey) {
      unsettledKey = key;
      unsettledAt = now;
      schedule(SETTLE_MS);
      return;
    }
    const remaining = SETTLE_MS - (now - unsettledAt);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
  }
  unsettledKey = '';
  lastKey = key;
  // Plain text so a copied console line shows the whole read.
  console.info(
    `[mama] cart via ${read.via}, subtotal ${read.subtotal ?? '?'} ${read.currency}\n` +
      read.items.map((i) => `  ${i.qty} x ${i.unitPrice}  ${i.name}`).join('\n'),
  );
  void send({ type: 'CART_READ', store: storeKey(location.href), url: location.origin + location.pathname, read });
  onRead(read);
}

async function tick() {
  if (reading) {
    dirty = true; // a change landed mid read: run once more when this read ends
    return;
  }
  reading = true;
  try {
    do {
      dirty = false;
      await readOnce();
    } while (dirty);
  } catch {
    // a reader threw on odd markup: nothing to show, the next change tries again
  } finally {
    reading = false;
    if (!lastRead?.items.length && lastItemsAt && Date.now() - lastItemsAt > IDLE_SLEEP_MS) sleep();
  }
}

export function schedule(delay = DEBOUNCE_MS) {
  clearTimeout(timer);
  timer = setTimeout(tick, delay);
}

function sleep() {
  observer?.disconnect();
  observer = undefined;
  clearTimeout(timer);
  hideAll();
  console.info('[mama] nothing in the cart for a minute, sleeping until the page changes');
}

/** Called by content.ts when the gate opens, on navigation, and on an add to cart click. Safe to call again. */
let listening = false;

export function start(ctx: Ctx, reason: 'cart' | 'add') {
  lastItemsAt ||= Date.now();
  if (!listening) {
    listening = true;
    browser.storage.local.get('said').then(({ said: s }) => { if (Array.isArray(s) && !said.length) said = s.slice(0, 3); }).catch(() => {});
    // Picking or changing the grandma in the popup applies on the open cart at once: faces, lines, naira.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) { lastKey = '(changed)'; schedule(0); }
    });
  }
  if (!observer) {
    lastItemsAt = Date.now();
    observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    ctx.onInvalidated(() => { sleep(); badge?.destroy(); });
  }
  schedule(reason === 'add' ? AFTER_ADD_MS : 0);
}
