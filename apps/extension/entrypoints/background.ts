// Service worker. Stateless: everything lives in chrome.storage. Every listener is top level and synchronous.

import type { Message } from '@mama/shared/messages';
import type { Answer, CartItem, JudgeReply, Week } from '@mama/shared/types';
import { apiUp, call } from '../lib/api';

const LAST_CART_TTL_MS = 30 * 60 * 1000;

async function rememberCart(msg: Extract<Message, { type: 'CART_READ' }>) {
  // Kept per store for 30 minutes so a confirmation page on another origin can match it.
  const { lastCart = {} } = await browser.storage.session.get('lastCart');
  const now = Date.now();
  const fresh = Object.fromEntries(
    Object.entries(lastCart as Record<string, { at: number }>).filter(([, v]) => now - v.at < LAST_CART_TTL_MS),
  );
  fresh[msg.store] = { at: now, url: msg.url, read: msg.read } as never;
  await browser.storage.session.set({ lastCart: fresh });
}

async function getWeek() {
  if (!(await apiUp())) return { ok: false as const };
  const week = await call<Week>('/week');
  return week ? { ok: true as const, week } : { ok: false as const };
}

async function judgeCart(store: string, items: CartItem[]) {
  if (!(await apiUp())) return { ok: false as const };
  const { memory = {}, settings = {} } = await browser.storage.local.get(['memory', 'settings']);
  const reply = await call<JudgeReply>('/v2/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.map((i) => ({ ...i, store })), memory, grandma: (settings as { grandma?: string }).grandma ?? 'mama' }),
  });
  return reply ? { ok: true as const, ...reply } : { ok: false as const };
}

/** Her memory of your answers. Durable, keyed by the rules' own item key, shared across every store. */
async function remember(key: string, answer: Answer) {
  const { memory = {} } = await browser.storage.local.get('memory');
  await browser.storage.local.set({ memory: { ...(memory as Record<string, Answer>), [key]: answer } });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      case 'PING':
        sendResponse({ ok: true, at: Date.now() });
        return false;
      case 'CART_READ':
        rememberCart(msg).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'GET_WEEK':
        getWeek().then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'JUDGE':
        judgeCart(msg.store, msg.items).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'ANSWER':
        remember(msg.key, msg.answer).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
    }
  });
});
