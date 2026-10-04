// Pure, so tests run it in plain node.

import type { CartRead } from '@mama/shared/types';

/** True when the items add up to the page's own subtotal, or the page shows none. A cart still rendering does not. */
export function addsUp(read: CartRead): boolean {
  if (read.subtotal == null) return true;
  const sum = read.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return Math.abs(sum - read.subtotal) < 0.01;
}
