// Readers in order, first one with items wins.
// 1 platform JSON, 2 site adapters, 3 JSON-LD on product pages, 4 cart text to /extract.
// A page no reader knows reads as null, and she stays away.

import type { CartRead } from '@mama/shared/types';
import { storeKey } from '@mama/shared/store-key';
import { readPlatform } from './platform.ts';
import { readJsonLd } from './jsonld.ts';
import { locateRow as locateIn, runAdapter, type AdapterSpec } from './adapter.ts';
import { amazon } from './sites/amazon.ts';
import { target } from './sites/target.ts';
import { walmart } from './sites/walmart.ts';
import { practice } from './sites/practice.ts';

const HAND_WRITTEN: AdapterSpec[] = [amazon, target, walmart];

import { cartRegionText } from './text.ts';

/** Reader 4 is asynchronous and lives behind the worker, so the session hands it in. */
export type Extractor = (text: string) => Promise<CartRead | null>;

/** How long an instant read (adapter or JSON-LD) waits for the platform's cart JSON before it goes ahead. The platform
 *  answer still wins when it arrives: the next observer tick re-reads and the richer read replaces this one. */
const PLATFORM_GRACE_MS = 400;

export async function readCart(doc: Document, url: string, extract?: Extractor): Promise<CartRead | null> {
  // The practice cart is our own page (chrome-extension://...), so it is known by a mark on the document, not a host.
  if (doc.documentElement.hasAttribute('data-mama-practice')) return runAdapter(practice, doc);
  // Reader 1 is the only one that touches the network. It starts first and keeps its priority, but it does not make
  // an instant reader wait on a slow endpoint: measured on a Shopify store, /cart.js took 0.2 s once and 1.9 s the
  // next time, while the product sat in the page's JSON-LD the whole time.
  const platform = readPlatform(doc).catch(() => null);
  const store = storeKey(url);
  let instant: CartRead | null = null;
  for (const spec of HAND_WRITTEN) {
    if (spec.host !== store) continue;
    const read = runAdapter(spec, doc);
    if (read && read.items.length) { instant = read; break; }
  }
  // Reader 3: the product this page is about, off cart and pay paths. The add to cart click lands here first, so she
  // can ask before the item is in any cart.
  instant ??= readJsonLd(doc, url);
  const first = await (instant ? Promise.race([platform, wait(PLATFORM_GRACE_MS)]) : platform);
  if (first && first.items.length) return first;
  if (instant) return instant;
  // Reader 4: cart text to the model, when nobody wrote code for this store.
  if (extract) {
    const text = cartRegionText(doc);
    if (text) return extract(text);
  }
  return null;
}

const wait = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));

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
