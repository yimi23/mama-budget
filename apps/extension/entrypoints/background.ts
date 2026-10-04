// Service worker. Stateless: everything lives in chrome.storage. Every listener is top level and synchronous.

import type { Message } from '@mama/shared/messages';
import type { Week } from '@mama/shared/types';
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
    }
  });
});
