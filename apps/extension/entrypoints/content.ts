// Runs on every page but does nothing until the gate fires: an add to cart click, or a cart page by two signals.

import { cartSignalCount, clickLabel, isAddToCartLabel, readSignals } from '../lib/detect';

// Carts built by script after load (Target) show one signal at idle and the rest a moment later.
const RECHECK_FOR_MS = 20_000;
const RECHECK_DEBOUNCE_MS = 400;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let open = false;
    let watcher: MutationObserver | undefined;

    const wake = async (reason: 'cart' | 'add') => {
      if (!ctx.isValid) return;
      open = true;
      watcher?.disconnect();
      const session = await import('../lib/session');
      session.start(ctx, reason);
    };

    const check = (): number => {
      if (open) return 2;
      const t0 = performance.now();
      const n = cartSignalCount(readSignals(document, location.href));
      if (n >= 1) console.info(`[mama] gate ${n >= 2 ? 'open' : 'one signal'} in ${(performance.now() - t0).toFixed(1)}ms`);
      if (n >= 2) wake('cart');
      return n;
    };

    const watchForLateCart = () => {
      if (open || watcher) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      watcher = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(check, RECHECK_DEBOUNCE_MS);
      });
      watcher.observe(document.body, { childList: true, subtree: true });
      ctx.setTimeout(() => { watcher?.disconnect(); watcher = undefined; }, RECHECK_FOR_MS);
      ctx.onInvalidated(() => watcher?.disconnect());
    };

    const onPage = () => {
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
