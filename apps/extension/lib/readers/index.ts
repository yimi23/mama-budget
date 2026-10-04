// Readers in order, first one with items wins.
// 1 platform JSON, 2 site adapters, 3 JSON-LD on product pages, 4 cart text to /extract.
// Layers 2 to 4 land next; until then a page with no platform cart reads as null.

import type { CartRead } from '@mama/shared/types';
import { readPlatform } from './platform';

export async function readCart(doc: Document): Promise<CartRead | null> {
  const platform = await readPlatform(doc);
  if (platform && platform.items.length) return platform;
  return null;
}

/** Stable hash of a read, so an unchanged cart never goes to the worker twice. */
export function readKey(read: CartRead | null): string {
  if (!read) return '';
  return read.items.map((i) => `${i.name}|${i.qty}|${i.unitPrice}`).join(';') + `|${read.subtotal}|${read.currency}`;
}
