// Readers in order, first one with items wins.
// 1 platform JSON, 2 site adapters, 3 JSON-LD on product pages, 4 cart text to /extract.
// Layers 3 and 4 land next; until then a page no reader knows reads as null.

import type { CartRead } from '@mama/shared/types';
import { storeKey } from '@mama/shared/store-key';
import { readPlatform } from './platform';
import { runAdapter, type AdapterSpec } from './adapter';
import { amazon } from './sites/amazon';
import { target } from './sites/target';
import { walmart } from './sites/walmart';

const HAND_WRITTEN: AdapterSpec[] = [amazon, target, walmart];

export async function readCart(doc: Document, url: string): Promise<CartRead | null> {
  const platform = await readPlatform(doc);
  if (platform && platform.items.length) return platform;

  const store = storeKey(url);
  for (const spec of HAND_WRITTEN) {
    if (spec.host !== store) continue;
    const read = runAdapter(spec, doc);
    if (read && read.items.length) return read;
  }
  return null;
}

/** Stable hash of a read, so an unchanged cart never goes to the worker twice. */
export function readKey(read: CartRead | null): string {
  if (!read) return '';
  return read.items.map((i) => `${i.name}|${i.qty}|${i.unitPrice}`).join(';') + `|${read.subtotal}|${read.currency}`;
}

