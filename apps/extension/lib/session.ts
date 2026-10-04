// Loaded only after detect.ts fires. Reads the cart, watches for changes, hands each new read to the worker.
// Never caches DOM nodes: every tick re queries from the document.

import type { CartRead } from '@mama/shared/types';
import type { Message } from '@mama/shared/messages';
import { storeKey } from '@mama/shared/store-key';
import { readCart, readKey } from './readers';

const DEBOUNCE_MS = 400;
const AFTER_ADD_MS = 1200;

let lastKey = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let reading = false;
let started = false;

function send(msg: Message) {
  // After an extension reload this script is orphaned; the runtime id disappears.
  if (!browser.runtime?.id) return;
  browser.runtime.sendMessage(msg).catch(() => { /* worker asleep or reloaded: silent */ });
}

async function tick() {
  if (reading) return;
  reading = true;
  try {
    const read: CartRead | null = await readCart(document, location.href);
    const key = readKey(read);
    if (key === lastKey) return;
    lastKey = key;
    if (!read) return;
    console.info('[mama] cart', { via: read.via, items: read.items, subtotal: read.subtotal, currency: read.currency });
    send({ type: 'CART_READ', store: storeKey(location.href), url: location.origin + location.pathname, read });
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
  ctx.onInvalidated(() => { observer.disconnect(); clearTimeout(timer); });
}
