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

export async function readPlatform(doc: Document): Promise<CartRead | null> {
  const platform = detectPlatform(doc);
  if (!platform) return null;
  try {
    const res = await fetch(ENDPOINT[platform], {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return PARSE[platform](await res.json());
  } catch {
    // Some themes proxy or block the endpoint. The next reader takes over.
    return null;
  }
}
