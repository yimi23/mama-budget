import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBigCommerce, parseShopify, parseWoo } from '../lib/readers/platform-parse.ts';
import { storeKey } from '@mama/shared/store-key';
import { parsePrice, currencyOf } from '@mama/shared/currency';

test('shopify /cart.js, cents to dollars', () => {
  const r = parseShopify({
    currency: 'USD', total_price: 9300, items_subtotal_price: 9300,
    items: [
      { title: 'Crest Hoodie - Black / M', product_title: 'Crest Hoodie', quantity: 1, price: 5000, final_price: 5000 },
      { title: 'Training Socks', product_title: 'Training Socks', quantity: 2, price: 2150, final_price: 2150 },
    ],
  });
  assert.deepEqual(r?.items, [
    { name: 'Crest Hoodie', qty: 1, unitPrice: 50 },
    { name: 'Training Socks', qty: 2, unitPrice: 21.5 },
  ]);
  assert.equal(r?.subtotal, 93);
  assert.equal(r?.via, 'shopify');
});

test('shopify empty cart reads as no items', () => {
  assert.deepEqual(parseShopify({ currency: 'USD', total_price: 0, items: [] })?.items, []);
  assert.equal(parseShopify({ error: 'x' }), null);
});

test('woocommerce store api, minor units', () => {
  const r = parseWoo({
    items: [{ name: 'Ankara Tote', quantity: 1, prices: { price: '2500000', currency_code: 'NGN', currency_minor_unit: 2 } }],
    totals: { total_items: '2500000', currency_code: 'NGN', currency_minor_unit: 2 },
  });
  assert.deepEqual(r?.items, [{ name: 'Ankara Tote', qty: 1, unitPrice: 25000 }]);
  assert.equal(r?.currency, 'NGN');
  assert.equal(r?.subtotal, 25000);
});

test('bigcommerce storefront carts', () => {
  const r = parseBigCommerce([{
    currency: { code: 'USD' }, baseAmount: 64.98, cartAmount: 64.98,
    lineItems: { physicalItems: [{ name: 'Desk Lamp', quantity: 2, salePrice: 32.49, listPrice: 39.99 }], digitalItems: [] },
  }]);
  assert.deepEqual(r?.items, [{ name: 'Desk Lamp', qty: 2, unitPrice: 32.49 }]);
  assert.equal(r?.subtotal, 64.98);
  assert.equal(parseBigCommerce([]), null);
});

test('store key is the registrable domain', () => {
  assert.equal(storeKey('https://www.amazon.com/gp/cart/view.html'), 'amazon.com');
  assert.equal(storeKey('https://checkout.shopify.com/123'), 'shopify.com');
  assert.equal(storeKey('https://www.jumia.com.ng/cart/'), 'jumia.com.ng');
  assert.equal(storeKey('https://shop.example.co.uk/'), 'example.co.uk');
  assert.equal(storeKey('http://localhost:8787/x'), 'localhost');
});

test('price and currency parsing', () => {
  assert.equal(parsePrice('$1,299.99'), 1299.99);
  assert.equal(parsePrice('₦ 25,000'), 25000);
  assert.equal(parsePrice('12.500,00 €'), 12500);
  assert.equal(currencyOf('₦25,000'), 'NGN');
  assert.equal(currencyOf('£24'), 'GBP');
  assert.equal(currencyOf('$4'), 'USD');
});

test('real allbirds.com /cart.js, recorded Oct 3', async () => {
  const { readFileSync } = await import('node:fs');
  const json = JSON.parse(readFileSync(new URL('./fixtures/allbirds_cart.json', import.meta.url), 'utf8'));
  const r = parseShopify(json);
  assert.deepEqual(r?.items, [{ name: "Women's Allbirds Flip Flop - Dusty Pink", qty: 2, unitPrice: 25 }]);
  assert.equal(r?.subtotal, 50);
  assert.equal(r?.currency, 'USD');
});

test('a cart still rendering does not add up to its subtotal', async () => {
  const { addsUp } = await import('../lib/readers/settle.ts');
  const base = { currency: 'USD' as const, source: 'adapter' as const, via: 'walmart.com', confidence: 1 };
  assert.equal(addsUp({ ...base, subtotal: 1269.93, items: [{ name: 'Chips', qty: 1, unitPrice: 2.5 }] }), false);
  assert.equal(addsUp({ ...base, subtotal: 9.28, items: [{ name: 'Chips', qty: 1, unitPrice: 2.5 }, { name: 'Mix', qty: 1, unitPrice: 6.78 }] }), true);
  assert.equal(addsUp({ ...base, subtotal: null, items: [{ name: 'Chips', qty: 1, unitPrice: 2.5 }] }), true);
});
