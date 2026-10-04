// Target cart, from the live page on Oct 3. Items live in cart-item-groups; Saved for later is a separate
// list (sfl-cart-item-list) outside it. Quantity is a select whose aria-label carries the current value,
// which survives rerenders and saved pages where the selected option does not.

import type { AdapterSpec } from '../adapter';

export const target: AdapterSpec = {
  host: 'target.com',
  root: '[data-test="cart-item-groups"]',
  row: '[data-test="cartItem"]',
  name: { sel: '[data-test="cartItem-title"]' },
  price: { sel: '[data-test="cartItem-price"]' },
  qty: { sel: '[data-test="cartItem-qty-stepper"]', attr: 'aria-label' },
  subtotal: { sel: ['[data-test="cart-summary-subTotal"] > div:last-child', '[data-test="cart-summary-subTotal"]'] },
};
