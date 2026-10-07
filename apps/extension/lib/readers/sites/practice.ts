// The practice cart (entrypoints/practice): an extension page that marks itself with data-mama-practice. Rows are
// plain list items with a name and a price, the subtotal has its own hook. The judge never knows this is not a store.

import type { AdapterSpec } from '../adapter.ts';

export const practice: AdapterSpec = {
  host: 'practice',
  root: '[data-mama-practice] [data-cart]',
  row: '[data-row]',
  name: { sel: '[data-name]' },
  price: { sel: '[data-price]' },
  subtotal: { sel: '[data-subtotal]' },
};
