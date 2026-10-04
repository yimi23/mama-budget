// A real order landed. What goes on the ledger is decided here, pure, from three facts: the store's last cart read,
// the order total the confirmation page states, and what the card already posted this week. The amount texted
// must be the amount paid. A stale or garbage cart read (one "$1 Amazon Grocery" promo line, an "item in cart"
// placeholder) never becomes the purchase when the page says what the order cost.

import type { CartRead } from '@mama/shared/types';

/** Names a model gives when it could not see the item. Never a purchase on their own. */
const GENERIC = /^(items?|products?|cart( items?)?|items? in (your |the )?(cart|bag|basket)|your (items?|order)|order|purchase|subscription|plan)$/i;

export interface Charge {
  name: string;
  price: number;
  /** The posted-memory key for this line; null for the one line that stands for the whole order. */
  key: string | null;
}

/**
 * The charges for this order.
 * - The cart explains the total (its lines are at most the total, since tax and shipping sit on top, and at least
 *   three quarters of it): charge the lines.
 * - The page states a total the cart does not explain: one line at the total, named for the store. The amount is
 *   right; the item is unknown, and she says so rather than guessing.
 * - No total on the page: the cart's real lines, as before; nothing when the read was a placeholder.
 */
export function confirmPlan(read: CartRead | null | undefined, total: number | null, posted: Set<string>, store: string, key: (name: string) => string): Charge[] {
  const lines = (read?.items ?? [])
    .filter((i) => !posted.has(key(i.name)))
    .filter((i) => !GENERIC.test(i.name.trim()) && i.unitPrice * i.qty >= 1)
    .map((i) => ({ name: i.name, price: round(i.unitPrice * i.qty), key: key(i.name) }));
  const sum = lines.reduce((s, l) => s + l.price, 0);
  if (total != null && total > 0) {
    if (lines.length && sum <= total + 1 && sum >= total * 0.75) return lines;
    return [{ name: `Order from ${store}`, price: round(total), key: null }];
  }
  return lines;
}

const round = (n: number) => Math.round(n * 100) / 100;
