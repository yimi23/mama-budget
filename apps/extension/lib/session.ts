// Loaded only after detect.ts fires. Reads the cart, watches for changes, hands each new read to the worker.
// Never caches DOM nodes: every tick re queries from the document.

import type { CartRead, Week } from '@mama/shared/types';
import type { Message } from '@mama/shared/messages';
import { mountBadge, type Badge } from './ui/badge';
import { storeKey } from '@mama/shared/store-key';
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

async function send<T>(msg: Message): Promise<T | null> {
  // After an extension reload this script is orphaned; the runtime id disappears.
  if (!browser.runtime?.id) return null;
  try {
    return (await browser.runtime.sendMessage(msg)) as T;
  } catch {
    return null; // worker asleep or reloaded: silent
  }
}

/** Shows the badge with this week's envelope, or keeps her hidden if the API is not answering. */
async function showBadge(read: CartRead | null) {
  if (!read || !read.items.length) return badge?.hide();
  const reply = await send<{ ok: true; week: Week } | { ok: false }>({ type: 'GET_WEEK' });
  if (!reply?.ok) return badge?.hide();
  const { week } = reply;
  badge ??= mountBadge();
  badge.update({ grandma: 'mama', mood: week.mood, ratio: week.ratio, left: week.left, daysLeft: week.daysLeft });
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
      badge?.hide();
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
    showBadge(read);
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
