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
    { url: 'https://store.example.com/products/x', text: 'Order total $45 Proceed to checkout' },
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
