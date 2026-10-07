// Walmart cart, from the live page on Oct 3. Rows have no stable hook and the price sits in a generated class,
// so each row is the list item holding a productName, and the price is the first currency amount in it
// ("Current price $2.50, Was $2.96" reads $2.50). Recommendation tiles live outside full-page-cart.

import type { AdapterSpec } from '../adapter.ts';

export const walmart: AdapterSpec = {
  host: 'walmart.com',
  root: '[data-testid="full-page-cart"]',
  row: 'li:has([data-testid="productName"])',
  name: { sel: '[data-testid="productName"]' },
  price: { pick: 'firstPrice' },
  qty: { sel: '[data-testid="quantity-label"]' },
  subtotal: { label: 'Subtotal', pick: 'firstPrice' },
};
