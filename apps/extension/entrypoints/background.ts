// Service worker. Stateless: everything lives in chrome.storage. Every listener is top level and synchronous.

import type { HandledLists, Message } from '@mama/shared/messages';
import type { Answer, CartItem, CurrencyCode, JudgeReply, Week } from '@mama/shared/types';
import { apiUp, call } from '../lib/api';
import { weekKey } from '@mama/shared/week';

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

async function judgeCart(store: string, currency: CurrencyCode, items: CartItem[]) {
  if (!(await apiUp())) return { ok: false as const };
  const { memory = {}, settings = {} } = await browser.storage.local.get(['memory', 'settings']);
  const reply = await call<JudgeReply>('/v2/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.map((i) => ({ ...i, store })), memory, currency, grandma: (settings as { grandma?: string }).grandma ?? 'mama' }),
  });
  return reply ? { ok: true as const, ...reply, handled: await handledLists() } : { ok: false as const };
}

// Asks: no repeats and at most three per browser session (storage.session).
// Reactions: once per item per envelope week, durable (storage.local), so an extension reload or a Chrome restart
// never makes her scold the same admitted want twice. The reaction belongs to the moment of admission; for the rest
// of the week a remembered want shows only on her face and the meter. Next week it is fair game again.
async function handledLists(): Promise<HandledLists> {
  const [{ asked = [] }, { reacted = {} }] = await Promise.all([
    browser.storage.session.get('asked'),
    browser.storage.local.get('reacted'),
  ]);
  const week = weekKey();
  const thisWeek = Object.entries(reacted as Record<string, string>).filter(([, w]) => w === week).map(([k]) => k);
  return { asked: asked as string[], reacted: thisWeek };
}

async function mark(kind: keyof HandledLists, key: string) {
  if (kind === 'asked') {
    const { asked = [] } = await browser.storage.session.get('asked');
    if (!(asked as string[]).includes(key)) await browser.storage.session.set({ asked: [...(asked as string[]), key] });
    return;
  }
  const { reacted = {} } = await browser.storage.local.get('reacted');
  // Only this week's entries are kept, so the record never grows past one week of items.
  const week = weekKey();
  const kept = Object.fromEntries(Object.entries(reacted as Record<string, string>).filter(([, w]) => w === week));
  await browser.storage.local.set({ reacted: { ...kept, [key]: week } });
}

/** The popup's Start over: she forgets every answer and asks again, as on a fresh install. */
async function startOver() {
  await browser.storage.local.remove(['memory', 'reacted']);
  await browser.storage.session.remove('asked');
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
        judgeCart(msg.store, msg.currency, msg.items).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'MARK':
        mark(msg.kind, msg.key).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'START_OVER':
        startOver().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'ANSWER':
        remember(msg.key, msg.answer).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
    }
  });
});
