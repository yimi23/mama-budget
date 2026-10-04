// Reader 3: the Product JSON-LD a product page publishes for search engines. This is how she can ask on the product
// page itself, at the add to cart click, before the item is in any cart. Never used on cart, checkout or pay paths:
// there a page's Product JSON-LD is recommendations, and recommendations are never items.

import type { CartItem, CartRead } from '@mama/shared/types';
import { parsePrice, toCurrencyCode } from '@mama/shared/currency';
import { isMoneyPath } from '../detect.ts';

type Node = Record<string, unknown>;

const typeOf = (n: Node): string[] => {
  const t = n['@type'];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x ?? ''));
};

/** Every object in a JSON-LD document, however nested (@graph, mainEntity, arrays). Depth bound keeps it cheap. */
function* walk(v: unknown, depth = 0): Generator<Node> {
  if (depth > 6 || !v || typeof v !== 'object') return;
  if (Array.isArray(v)) { for (const x of v) yield* walk(x, depth + 1); return; }
  yield v as Node;
  for (const x of Object.values(v as Node)) yield* walk(x, depth + 1);
}

/** One offer's price in major units, from the shapes stores actually publish. */
function priceOf(offer: Node): { price: number; currency: string } | null {
  const raw = offer.price ?? offer.lowPrice ?? (offer.priceSpecification as Node | undefined)?.price;
  const price = typeof raw === 'number' ? raw : typeof raw === 'string' ? parsePrice(raw) : null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const cur = offer.priceCurrency ?? (offer.priceSpecification as Node | undefined)?.priceCurrency;
  return { price, currency: String(cur ?? 'USD') };
}

function offerOf(product: Node): { price: number; currency: string } | null {
  for (const n of walk(product.offers)) {
    if (!typeOf(n).some((t) => /Offer$/.test(t)) && n.price == null && n.lowPrice == null) continue;
    const p = priceOf(n);
    if (p) return p;
  }
  // A ProductGroup often prices only its variants (one Product per size). The group is the item; its first priced
  // variant is its price.
  for (const v of walk(product.hasVariant)) {
    if (v === product || !typeOf(v).includes('Product')) continue;
    const p = offerOf(v);
    if (p) return p;
  }
  return null;
}

// Products nested under another product are the same thing, not more things: sizes, colours, the group a size
// belongs to, and the "similar" and "related" shelves. Only the outer product counts.
const NESTED = ['hasVariant', 'isVariantOf', 'isSimilarTo', 'isRelatedTo', 'isAccessoryOrSparePartFor', 'isConsumableFor'];

/** The products a document declares. Pure: node and jsdom both run it. */
export function productsIn(doc: Document): { items: CartItem[]; currency: string } {
  const items: CartItem[] = [];
  let currency = '';
  const seen = new Set<string>();
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let json: unknown;
    try { json = JSON.parse(script.textContent || ''); } catch { continue; }
    const nested = new Set<Node>();
    for (const n of walk(json)) {
      if (nested.has(n) || !typeOf(n).some((t) => t === 'Product' || t === 'ProductGroup')) continue;
      for (const k of NESTED) for (const m of walk(n[k])) nested.add(m);
      const name = String(n.name ?? '').replace(/\s+/g, ' ').trim();
      const offer = offerOf(n);
      if (!name || !offer || seen.has(name)) continue;
      seen.add(name);
      items.push({ name, qty: 1, unitPrice: offer.price });
      currency ||= offer.currency;
    }
  }
  return { items, currency };
}

/**
 * The product this page is about, as a one line cart. Null on cart and pay paths, on pages with no Product JSON-LD,
 * and on listing pages (several products): one product is a product page, many is a shelf.
 */
export function readJsonLd(doc: Document, url: string): CartRead | null {
  if (isMoneyPath(url)) return null;
  const { items, currency } = productsIn(doc);
  if (items.length !== 1) return null;
  return {
    items,
    subtotal: null,
    currency: toCurrencyCode(currency),
    source: 'jsonld',
    via: 'product',
    confidence: 0.9,
  };
}
