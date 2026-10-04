// Layer 1: platform cart JSON. Same origin fetch, the only fetch a content script is allowed to make.
// Content scripts cannot see window.Shopify (isolated world), so the platform is read from markup.

import type { CartRead } from '@mama/shared/types';
import { parseBigCommerce, parseShopify, parseWoo } from './platform-parse';

type Platform = 'shopify' | 'woocommerce' | 'bigcommerce';

export function detectPlatform(doc: Document): Platform | null {
  if (doc.querySelector('link[href*="cdn.shopify.com"],script[src*="cdn.shopify.com"],meta[name="shopify-checkout-api-token"],meta[name="shopify-digital-wallet"],link[href*="/cdn/shop/"]')) return 'shopify';
  if (doc.querySelector('body.woocommerce,body.woocommerce-cart,link[href*="woocommerce"],script[src*="woocommerce"]')) return 'woocommerce';
  if (doc.querySelector('script[src*="bigcommerce.com"],link[href*="bigcommerce.com"],script[src*="cdn11.bigcommerce"]')) return 'bigcommerce';
  return null;
}

const ENDPOINT: Record<Platform, string> = {
  shopify: '/cart.js',
  woocommerce: '/wp-json/wc/store/v1/cart',
  bigcommerce: '/api/storefront/carts',
};

const PARSE: Record<Platform, (j: unknown) => CartRead | null> = {
  shopify: parseShopify,
  woocommerce: parseWoo,
  bigcommerce: parseBigCommerce,
};

// Shopify themes mutate the page constantly (carousels), and every tick would otherwise hit /cart.js.
// At most one fetch per MIN_INTERVAL_MS: a tick inside the window waits out the remainder, then fetches fresh,
// so an add to cart whose only change lands inside the window is still seen.
const MIN_INTERVAL_MS = 800;
const FETCH_TIMEOUT_MS = 2500;
let lastAt = 0;

export async function readPlatform(doc: Document): Promise<CartRead | null> {
  const platform = detectPlatform(doc);
  if (!platform) return null;
  const wait = MIN_INTERVAL_MS - (Date.now() - lastAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
  try {
    const res = await fetch(ENDPOINT[platform], {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), // a hanging cart endpoint never holds the other readers hostage
    });
    if (!res.ok) return null;
    return PARSE[platform](await res.json());
  } catch {
    // Some themes proxy or block the endpoint. The next reader takes over.
    return null;
  }
}
