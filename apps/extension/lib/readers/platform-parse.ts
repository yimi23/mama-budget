// Pure parsers for platform cart JSON. Kept apart from the fetch so tests run in plain node.

import type { CartRead, CartItem } from '@mama/shared/types';
import { toCurrencyCode } from '@mama/shared/currency';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Shopify GET /cart.js. Prices are integer cents. */
export function parseShopify(json: any): CartRead | null {
  if (!json || !Array.isArray(json.items)) return null;
  const items: CartItem[] = json.items.map((it: any) => ({
    name: String(it.product_title || it.title || '').trim(),
    qty: Number(it.quantity) || 1,
    unitPrice: round2(Number(it.final_price ?? it.price ?? 0) / 100),
  }));
  return {
    items: items.filter((i) => i.name),
    subtotal: json.items_subtotal_price != null ? round2(json.items_subtotal_price / 100)
      : json.total_price != null ? round2(json.total_price / 100) : null,
    currency: toCurrencyCode(json.currency),
    source: 'platform',
    via: 'shopify',
    confidence: 1,
  };
}

/** WooCommerce GET /wp-json/wc/store/v1/cart. Prices are strings in minor units. */
export function parseWoo(json: any): CartRead | null {
  if (!json || !Array.isArray(json.items)) return null;
  const minor = (p: any) => 10 ** (Number(p?.currency_minor_unit) || 2);
  const items: CartItem[] = json.items.map((it: any) => ({
    name: String(it.name || '').trim(),
    qty: Number(it.quantity) || 1,
    unitPrice: round2(Number(it.prices?.price ?? 0) / minor(it.prices)),
  }));
  const t = json.totals;
  return {
    items: items.filter((i) => i.name),
    subtotal: t?.total_items != null ? round2(Number(t.total_items) / minor(t)) : null,
    currency: toCurrencyCode(t?.currency_code ?? json.items[0]?.prices?.currency_code),
    source: 'platform',
    via: 'woocommerce',
    confidence: 1,
  };
}

/** BigCommerce GET /api/storefront/carts. An array of carts, prices in major units. */
export function parseBigCommerce(json: any): CartRead | null {
  const cart = Array.isArray(json) ? json[0] : null;
  if (!cart) return null;
  const li = cart.lineItems ?? {};
  const rows = [...(li.physicalItems ?? []), ...(li.digitalItems ?? []), ...(li.customItems ?? [])];
  const items: CartItem[] = rows.map((it: any) => ({
    name: String(it.name || '').trim(),
    qty: Number(it.quantity) || 1,
    unitPrice: round2(Number(it.salePrice ?? it.listPrice ?? 0)),
  }));
  return {
    items: items.filter((i) => i.name),
    subtotal: cart.baseAmount != null ? round2(cart.baseAmount) : cart.cartAmount != null ? round2(cart.cartAmount) : null,
    currency: toCurrencyCode(cart.currency?.code),
    source: 'platform',
    via: 'bigcommerce',
    confidence: 1,
  };
}
