// Readers in order, first one with items wins.
// 1 platform JSON, 2 site adapters, 3 JSON-LD on product pages, 4 cart text to /extract.
// Layers 3 and 4 land next; until then a page no reader knows reads as null.

import type { CartRead } from '@mama/shared/types';
import { storeKey } from '@mama/shared/store-key';
import { readPlatform } from './platform';
import { locateRow as locateIn, runAdapter, type AdapterSpec } from './adapter';
import { amazon } from './sites/amazon';
import { target } from './sites/target';
import { walmart } from './sites/walmart';
import { practice } from './sites/practice';

const HAND_WRITTEN: AdapterSpec[] = [amazon, target, walmart];

import { cartRegionText } from './text';

/** Reader 4 is asynchronous and lives behind the worker, so the session hands it in. */
export type Extractor = (text: string) => Promise<CartRead | null>;

export async function readCart(doc: Document, url: string, extract?: Extractor): Promise<CartRead | null> {
  // The practice cart is our own page (chrome-extension://...), so it is known by a mark on the document, not a host.
  if (doc.documentElement.hasAttribute('data-mama-practice')) return runAdapter(practice, doc);
  const platform = await readPlatform(doc);
  if (platform && platform.items.length) return platform;

  const store = storeKey(url);
  for (const spec of HAND_WRITTEN) {
    if (spec.host !== store) continue;
    const read = runAdapter(spec, doc);
    if (read && read.items.length) return read;
  }
  // Reader 4: cart text to the model, when nobody wrote code for this store.
  if (extract) {
    const text = cartRegionText(doc);
    if (text) return extract(text);
  }
  return null;
}

/** Stable hash of a read, so an unchanged cart never goes to the worker twice. */
export function readKey(read: CartRead | null): string {
  if (!read) return '';
  return read.items.map((i) => `${i.name}|${i.qty}|${i.unitPrice}`).join(';') + `|${read.subtotal}|${read.currency}`;
}


/** Where the cart draws this item right now, for the row mark. Platform (JSON) carts have no known row: null. */
export function locateRow(doc: Document, url: string, name: string): Element | null {
  if (doc.documentElement.hasAttribute('data-mama-practice')) return locateIn(practice, doc, name);
  const store = storeKey(url);
  for (const spec of HAND_WRITTEN) if (spec.host === store) return locateIn(spec, doc, name);
  return null;
}
