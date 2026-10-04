// Runs on every page but does nothing until the gate fires: an add to cart click, or a cart page by two signals.

import { clickLabel, isAddToCartLabel, isConfirmationPage, liveCartSignalCount, looksLikeConfirmationUrl, orderIdFrom, readSignals } from '../lib/detect';
import { storeKey } from '@mama/shared/store-key';

// Carts built by script after load (Target) show one signal at idle and the rest a moment later.
// Throttled, not per mutation: Shopify themes keep a hidden cart drawer, so every page shows one signal.
const RECHECK_FOR_MS = 20_000;
const RECHECK_EVERY_MS = 1000;
const RECHECK_MAX = 12;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let open = false;
    let watcher: MutationObserver | undefined;
    let session: typeof import('../lib/session') | undefined;

    const wake = async (reason: 'cart' | 'add') => {
      if (!ctx.isValid) return;
      open = true;
      watcher?.disconnect();
      session ??= await import('../lib/session');
      session.start(ctx, reason);
    };

    const check = (): number => {
      if (open) return 2;
      const t0 = performance.now();
      const n = liveCartSignalCount(document, location.href);
      if (n >= 1) console.info(`[mama] gate ${n >= 2 ? 'open' : 'one signal'} in ${(performance.now() - t0).toFixed(1)}ms`);
      if (n >= 2) wake('cart');
      return n;
    };

    const watchForLateCart = () => {
      if (open || watcher) return;
      let pending = false;
      let checks = 0;
      watcher = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        ctx.setTimeout(() => {
          pending = false;
          if (++checks > RECHECK_MAX) watcher?.disconnect();
          else check();
        }, RECHECK_EVERY_MS);
      });
      watcher.observe(document.body, { childList: true, subtree: true });
      ctx.setTimeout(() => { watcher?.disconnect(); watcher = undefined; }, RECHECK_FOR_MS);
      ctx.onInvalidated(() => watcher?.disconnect());
    };

    // A real order landed. The URL is the cheap test; the page text confirms. The worker charges that store's last
    // cart. Checked again shortly after, because confirmation pages often render their thank you late.
    const confirmed = new Set<string>();
    const checkConfirmation = (attempt = 0) => {
      if (!looksLikeConfirmationUrl(location.href) || attempt > 4) return;
      const signals = readSignals(document, location.href);
      if (!isConfirmationPage(signals)) return void ctx.setTimeout(() => checkConfirmation(attempt + 1), 1500);
      const orderId = orderIdFrom(signals.text, location.href);
      if (confirmed.has(orderId)) return;
      confirmed.add(orderId);
      console.info(`[mama] order confirmed on ${location.hostname}`);
      browser.runtime.sendMessage({ type: 'CONFIRM', store: storeKey(location.href), orderId }).catch(() => {});
    };

    // A merchant she promised to watch (screen 06b): she says so on arrival, before any cart. One message per page.
    const checkWatch = () => {
      if (!browser.runtime?.id) return;
      browser.runtime.sendMessage({ type: 'WATCH_HERE', host: location.hostname }).then(async (r: { line?: string | null } | undefined) => {
        if (!r?.line || !ctx.isValid) return;
        session ??= await import('../lib/session');
        session.arrive(ctx, r.line);
      }).catch(() => {});
    };

    const onPage = () => {
      checkWatch();
      checkConfirmation();
      // Once awake, a navigation re arms the session (it may have gone to sleep on an empty page).
      if (open) return wake('cart');
      if (check() === 1) watchForLateCart();
    };

    onPage();
    ctx.addEventListener(window, 'wxt:locationchange', onPage);

    // Capture phase so a store that stops propagation still tells us.
    ctx.addEventListener(document, 'click', (e) => {
      if (isAddToCartLabel(clickLabel(e.target))) wake('add');
    }, { capture: true });
  },
});
