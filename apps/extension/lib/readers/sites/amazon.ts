// Amazon cart, from the live page on Oct 3. Reads only the checked rows of the active cart: Amazon checks out
// (and subtotals) only the ticked items. Saved for later rows are data-itemtype="saved" in #sc-saved-cart and
// Buy it again sits outside #sc-active-cart, so neither can match.

import type { AdapterSpec } from '../adapter';

export const amazon: AdapterSpec = {
  host: 'amazon.com',
  root: '#sc-active-cart',
  row: 'div[data-itemtype="active"][data-asin]:not([data-isselected="0"]):not([data-removed="true"])',
  name: { sel: ['.sc-product-title .a-truncate-full', 'h3.a-text-normal', '.sc-product-title'] },
  price: { attr: 'data-price' },
  qty: { attr: 'data-quantity' },
  subtotal: { sel: ['#sc-subtotal-amount-buybox', '#sc-subtotal-amount-activecart'] },
};
