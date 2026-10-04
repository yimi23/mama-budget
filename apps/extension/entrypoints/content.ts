// Runs on every page but does nothing until the gate fires: an add to cart click, or a cart page by two signals.

import { clickLabel, isAddToCartLabel, isCartPage, readSignals } from '../lib/detect';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    const wake = async (reason: 'cart' | 'add') => {
      if (!ctx.isValid) return;
      const session = await import('../lib/session');
      session.start(ctx, reason);
    };

    const check = () => {
      const t0 = performance.now();
      const cart = isCartPage(readSignals(document, location.href));
      if (import.meta.env.DEV) console.debug(`[mama] gate ${cart ? 'open' : 'shut'} in ${(performance.now() - t0).toFixed(1)}ms`);
      if (cart) wake('cart');
    };

    check();
    ctx.addEventListener(window, 'wxt:locationchange', check);

    // Capture phase so a store that stops propagation still tells us.
    ctx.addEventListener(document, 'click', (e) => {
      if (isAddToCartLabel(clickLabel(e.target))) wake('add');
    }, { capture: true });
  },
});
