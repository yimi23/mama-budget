// Reader 3 reads the product a page is about, from the JSON-LD stores publish for search engines, and nothing else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { productsIn, readJsonLd } from '../lib/readers/jsonld.ts';

const PRODUCT = 'https://www.example.com/dp/B0D1XD1ZV3';
const page = (...blocks: unknown[]) =>
  new JSDOM(`<html><body><h1>Shop</h1>${blocks.map((b) => `<script type="application/ld+json">${typeof b === 'string' ? b : JSON.stringify(b)}</script>`).join('')}<button>Add to Cart</button></body></html>`).window.document;

test('a product page reads as a one line cart with the offer price and currency', () => {
  const doc = page({ '@context': 'https://schema.org', '@type': 'Product', name: 'Apple AirPods Pro 2', offers: { '@type': 'Offer', price: '249.00', priceCurrency: 'USD' } });
  const read = readJsonLd(doc, PRODUCT);
  assert.ok(read);
  assert.deepEqual(read.items, [{ name: 'Apple AirPods Pro 2', qty: 1, unitPrice: 249 }]);
  assert.equal(read.currency, 'USD');
  assert.equal(read.source, 'jsonld');
  assert.equal(read.confidence, 0.9);
  assert.equal(read.subtotal, null);
});

test('products inside @graph, offer arrays and AggregateOffer are found', () => {
  const graph = page({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: 'x' }, { '@type': ['Product'], name: 'Zara Suit', offers: [{ '@type': 'Offer', price: 1299, priceCurrency: 'EUR' }] }] });
  assert.deepEqual(productsIn(graph).items, [{ name: 'Zara Suit', qty: 1, unitPrice: 1299 }]);
  const agg = page({ '@type': 'Product', name: 'Monitor', offers: { '@type': 'AggregateOffer', lowPrice: '179.99', highPrice: '229.99', priceCurrency: 'USD' } });
  assert.equal(productsIn(agg).items[0]!.unitPrice, 179.99);
  const spec = page({ '@type': 'Product', name: 'Course', offers: { '@type': 'Offer', priceSpecification: { '@type': 'UnitPriceSpecification', price: '1,299.00', priceCurrency: 'GBP' } } });
  assert.equal(productsIn(spec).items[0]!.unitPrice, 1299);
  assert.equal(readJsonLd(spec, PRODUCT)!.currency, 'GBP');
});

test('never on a cart, checkout or pay path: that JSON-LD is recommendations', () => {
  const doc = page({ '@type': 'Product', name: 'You may also like', offers: { price: 19, priceCurrency: 'USD' } });
  for (const url of ['https://shop.example.com/cart', 'https://www.example.com/gp/cart/view.html', 'https://x.com/checkout/abc', 'https://x.com/pricing', 'https://x.com/account/billing']) {
    assert.equal(readJsonLd(doc, url), null, url);
  }
  assert.ok(readJsonLd(doc, 'https://www.example.com/retail-pricing.html'));
});

test('a shelf of products is not a product page, and non products are ignored', () => {
  const shelf = page({ '@type': 'ItemList', itemListElement: [{ '@type': 'Product', name: 'A', offers: { price: 1, priceCurrency: 'USD' } }, { '@type': 'Product', name: 'B', offers: { price: 2, priceCurrency: 'USD' } }] });
  assert.equal(productsIn(shelf).items.length, 2);
  assert.equal(readJsonLd(shelf, PRODUCT), null);
  const other = page({ '@type': 'Organization', name: 'Example Inc' }, { '@type': 'BreadcrumbList' });
  assert.equal(readJsonLd(other, PRODUCT), null);
});

test('broken JSON, missing offers and zero prices never produce an item', () => {
  const doc = page('{not json', { '@type': 'Product', name: 'No offer' }, { '@type': 'Product', name: 'Free', offers: { price: 0, priceCurrency: 'USD' } }, { '@type': 'Product', name: '', offers: { price: 5 } });
  assert.equal(readJsonLd(doc, PRODUCT), null);
});

test('a ProductGroup with one Product per size is one item, priced from its variants', () => {
  const variant = (size: number) => ({ '@type': 'Product', name: `Tree Runner - Black - Size ${size}`, offers: { '@type': 'Offer', price: '100.00', priceCurrency: 'USD' } });
  const doc = page({ '@context': 'https://schema.org', '@type': 'ProductGroup', name: "Men's Tree Runner", hasVariant: [variant(8), variant(9), variant(10)] });
  const read = readJsonLd(doc, PRODUCT);
  assert.ok(read);
  assert.deepEqual(read.items, [{ name: "Men's Tree Runner", qty: 1, unitPrice: 100 }]);
  const related = page({ '@type': 'Product', name: 'Kettle', offers: { price: 40, priceCurrency: 'USD' }, isSimilarTo: [{ '@type': 'Product', name: 'Other kettle', offers: { price: 30, priceCurrency: 'USD' } }] });
  assert.equal(readJsonLd(related, PRODUCT)!.items[0]!.name, 'Kettle');
});

test('the same product declared twice is one item', () => {
  const doc = page({ '@type': 'Product', name: 'Kettle', offers: { price: 40, priceCurrency: 'USD' } }, { '@type': 'Product', name: 'Kettle', offers: { price: 40, priceCurrency: 'USD' } });
  assert.equal(readJsonLd(doc, PRODUCT)!.items.length, 1);
});
