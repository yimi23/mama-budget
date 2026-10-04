// Service worker. Stateless: everything lives in chrome.storage. Every listener is top level and synchronous.

import type { Message } from '@mama/shared/messages';

const LAST_CART_TTL_MS = 30 * 60 * 1000;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      case 'PING':
        sendResponse({ ok: true, at: Date.now() });
        return false;
      case 'CART_READ':
        // Kept per store for 30 minutes so a confirmation page on another origin can match it.
        browser.storage.session
          .get('lastCart')
          .then(({ lastCart = {} }) => {
            const now = Date.now();
            const fresh = Object.fromEntries(
              Object.entries(lastCart as Record<string, { at: number }>).filter(([, v]) => now - v.at < LAST_CART_TTL_MS),
            );
            fresh[msg.store] = { at: now, url: msg.url, read: msg.read } as never;
            return browser.storage.session.set({ lastCart: fresh });
          })
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: true }));
        return true;
    }
  });
});
