import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartSignalCount, isAddToCartLabel, isCartPage, isConfirmationPage, type PageSignals } from '../lib/detect.ts';

const page = (p: Partial<PageSignals>): PageSignals => ({
  url: 'https://example.com/', title: '', text: '', hasSubtotalNode: false, hasCheckoutNode: false, ...p,
});

test('shopping pages wake her', () => {
  const yes: Partial<PageSignals>[] = [
    { url: 'https://www.amazon.com/gp/cart/view.html', text: 'Subtotal (3 items): $207.00 Proceed to checkout' },
    { url: 'https://www.target.com/cart', hasSubtotalNode: true, hasCheckoutNode: true },
    { url: 'https://www.gymshark.com/cart', text: 'Your bag Subtotal $45.00 Checkout' },
    { url: 'https://www.allbirds.com/cart', title: 'Your Cart', hasCheckoutNode: true },
    { url: 'https://www.bestbuy.com/cart', text: 'Order Summary Estimated Total $179.99 Checkout' },
    { url: 'https://www.jumia.com.ng/cart/', text: 'Cart (2) Subtotal ₦ 25,000 CHECKOUT' },
    { url: 'https://www.zara.com/us/en/shop/cart', text: 'Shopping bag Total $59.90 Continue', hasCheckoutNode: true },
    { url: 'https://www.walmart.com/checkout', text: 'Subtotal $24.00 Place order' },
    { url: 'https://shop.example.com/basket', text: 'Basket total £12.00' },
    { url: 'https://store.example.com/products/x', text: 'Order total $45 Proceed to checkout', hasCheckoutNode: true },
  ];
  for (const p of yes) assert.ok(isCartPage(page(p)), p.url);
});

test('ordinary pages stay shut', () => {
  const no: Partial<PageSignals>[] = [
    { url: 'https://mail.google.com/mail/u/0/#inbox', title: 'Inbox (12)', text: 'Your order has shipped' },
    { url: 'https://www.youtube.com/watch?v=abc', title: 'AirPods Pro review', text: 'Subscribe' },
    { url: 'https://en.wikipedia.org/wiki/Shopping_cart', text: 'A shopping cart is a cart supplied by a shop' },
    { url: 'https://canvas.cmich.edu/courses/1', text: 'Assignments Grades' },
    { url: 'https://www.nytimes.com/2026/10/03/business/retail.html', text: 'Retailers see checkout lines grow' },
    { url: 'https://www.chase.com/personal/checking', text: 'Checking accounts' },
    { url: 'https://github.com/yimi23/mama-budget', text: 'Code Issues Pull requests' },
    { url: 'https://www.amazon.com/dp/B0D1XD1ZV3', text: 'AirPods Pro 2 Add to Cart Buy Now' },
    { url: 'https://docs.google.com/document/d/1', text: 'Untitled document' },
    { url: 'https://twitter.com/home', text: 'What is happening' },
    // An order confirmation email: both words, no cart URL, no cart elements. Prose never wakes her.
    { url: 'https://mail.google.com/mail/u/0/#inbox/abc', title: 'Your order has shipped', text: 'Order summary Subtotal $45.00 Shipping $0 Checkout again at example.com' },
    { url: 'https://www.nytimes.com/2026/10/03/technology/retail-pricing.html', text: 'Retailers fight over the subtotal line and the checkout button' },
    // Zara favorites, from the live page Oct 3: a wishlist with a Bag link in the header is not a cart.
    { url: 'https://www.zara.com/us/en/wishlist', title: 'Favorites | ZARA United States', text: 'Skip to main content Search Bag0 Help WOMAN MAN KIDS NEW ARRIVALS' },
  ];
  for (const p of no) assert.equal(isCartPage(page(p)), false, `${p.url} had ${cartSignalCount(page(p))} signals`);
});

test('add to cart labels', () => {
  for (const l of ['Add to Cart', '  Add to bag ', 'Buy Now', 'ADD TO BASKET', 'Ajouter au panier']) assert.ok(isAddToCartLabel(l), l);
  for (const l of ['Add to list', 'Save for later', 'Cart', 'Remove', 'Buy it again']) assert.equal(isAddToCartLabel(l), false, l);
});

test('confirmation pages', () => {
  assert.ok(isConfirmationPage(page({ url: 'https://shop.example.com/checkouts/abc/thank-you', text: 'Thank you, Praise! Order #1001 confirmed' })));
  assert.ok(isConfirmationPage(page({ url: 'https://www.amazon.com/gp/buy/thankyou/handlers/display.html', text: 'Order placed, thanks!' })));
  assert.ok(isConfirmationPage(page({ url: 'https://example.com/receipt', text: 'Thank you for shopping. Order number: W12345678' })));
  assert.equal(isConfirmationPage(page({ url: 'https://example.com/cart', text: 'Subtotal $20 Checkout' })), false);
});

test('"Total" with an amount counts, a bare total does not', () => {
  assert.ok(isCartPage(page({ url: 'https://www.zara.com/us/en/shop/cart', text: 'Select all items TOTAL $ 994.60 * Tax not included CONTINUE (9)' })));
  assert.equal(isCartPage(page({ url: 'https://example.com/blog/cart-before-horse', text: 'In total we wrote three posts' })), false);
});

test('script contents never count as page text', async () => {
  const { JSDOM } = await import('jsdom');
  const { readSignals } = await import('../lib/detect.ts');
  const doc = new JSDOM('<body><p>Weekly news</p><script>window.cfg={"checkout":{"isEnabled":false},"subtotal":1}</script></body>').window.document;
  const s = readSignals(doc, 'https://example.com/orders-of-magnitude');
  assert.doesNotMatch(s.text, /checkout|subtotal/);
  assert.equal(isCartPage(s), false);
});

test('real Zara bag wakes her by the URL and the total, not by its scripts', async () => {
  const { JSDOM } = await import('jsdom');
  const { readFileSync } = await import('node:fs');
  const { readSignals } = await import('../lib/detect.ts');
  const html = readFileSync(new URL('./fixtures/carts/zara_cart.html', import.meta.url), 'utf8');
  const doc = new JSDOM(html).window.document;
  const s = readSignals(doc, 'https://www.zara.com/us/en/shop/cart');
  assert.equal(s.hasCheckoutNode || /check ?out/i.test(s.text), false, 'no checkout word on the visible page');
  assert.ok(isCartPage(s));
});

test('the live fast path agrees with the full count on every saved page', async () => {
  const { JSDOM } = await import('jsdom');
  const { readFileSync } = await import('node:fs');
  const { readSignals, liveCartSignalCount } = await import('../lib/detect.ts');
  const pages: [string, string][] = [
    ['amazon_cart.html', 'https://www.amazon.com/gp/cart/view.html'],
    ['target_cart.html', 'https://www.target.com/cart'],
    ['walmart_cart.html', 'https://www.walmart.com/cart'],
    ['zara_cart.html', 'https://www.zara.com/us/en/shop/cart'],
    ['zara_cart.html', 'https://www.zara.com/us/en/product/123'],
  ];
  for (const [file, url] of pages) {
    const doc = new JSDOM(readFileSync(new URL(`./fixtures/carts/${file}`, import.meta.url), 'utf8')).window.document;
    assert.equal(liveCartSignalCount(doc, url) >= 2, isCartPage(readSignals(doc, url)), `${file} at ${url}`);
  }
  const plain = new JSDOM('<body><p>Weekly news</p></body>').window.document;
  assert.equal(liveCartSignalCount(plain, 'https://example.com/'), 0);
});

test('confirmation pages get a stable order id, so a reload never posts twice', async () => {
  const { looksLikeConfirmationUrl, orderIdFrom } = await import('../lib/detect.ts');
  assert.ok(looksLikeConfirmationUrl('https://www.amazon.com/gp/buy/thankyou/handlers/display.html?purchaseId=123'));
  assert.ok(looksLikeConfirmationUrl('https://shop.example.com/checkouts/abc/thank_you'));
  assert.ok(looksLikeConfirmationUrl('https://www.target.com/co-thankyou?orderId=9'));
  assert.equal(looksLikeConfirmationUrl('https://www.amazon.com/gp/cart/view.html'), false);
  assert.equal(orderIdFrom('Thank you! Order number: 112-4455667-8899000 placed', 'https://x/thank-you'), 'Order number: 112-4455667-8899000');
  assert.equal(orderIdFrom('Thanks for your order', 'https://x/thank-you?o=5#top'), 'https://x/thank-you?o=5');
  assert.equal(orderIdFrom('Thanks', 'https://x/thank-you?o=5'), orderIdFrom('Thanks', 'https://x/thank-you?o=5'));
});

test('where money leaves without a cart: a subscription checkout and a pay button', () => {
  assert.ok(isCartPage(page({ url: 'https://checkout.stripe.com/c/pay/cs_live_abc', text: 'ChatGPT Plus Subscribe $20.00 per month Due today $20.00 Card number', hasCheckoutNode: false, hasPaymentNode: true })), 'Stripe checkout');
  assert.ok(isCartPage(page({ url: 'https://app.example.com/billing', text: 'Pro plan $12 / month Upgrade Pay now' })), 'billing page with a recurring price');
  assert.ok(isCartPage(page({ url: 'https://example.com/pricing', title: 'Pricing', text: 'Starter $8 per month Start free trial' })), 'pricing with a trial button');
  assert.equal(isCartPage(page({ url: 'https://example.com/blog/why-we-charge-monthly', text: 'Our customers pay $20 a month and love it. Subscribe to the newsletter.' })), false, 'prose about prices stays shut');
  assert.ok(isAddToCartLabel('Subscribe now'));
  assert.ok(isAddToCartLabel('Start free trial'));
  assert.ok(isAddToCartLabel('Upgrade to Pro'));
  assert.equal(isAddToCartLabel('Subscribe to our newsletter'), false);
});
