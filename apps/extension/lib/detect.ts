// The gate. Runs on every page, decides in under 5ms whether this page matters.
// No imports, no DOM writes. Two signals wake her on a cart page, one does not.

const CART_PATH = /(^|[\/_.-])(cart|checkout|bag|basket|order)s?([\/_.?#-]|$)/i;
// Where money leaves without a cart. Whole path segments only: /pricing and /billing count, retail-pricing.html does not.
const PAY_PATH = /(^|\/)(billing|subscribe|subscription|pricing|plans?|upgrade|payment|pay|checkouts?)(\/|$)/i;
const CONFIRM_PATH = /(thank[-_]?you|order[-_]?confirmation|order[-_]?placed|confirmation)/i;
// Past orders, not a new one: Amazon's Your Orders, a Shopify account page, any order details page.
const HISTORY_PATH = /(order[-_]?history|your[-_]?orders|order[-_]?details|(^|\/)account(\/|$))/i;
const ADD_WORDS =/\b(add to (cart|bag|basket|trolley)|buy now|add to order|start (my |your )?(free )?trial|upgrade( now| to [a-z ]+)?|pay now|pay \$?\d|place (your )?order|confirm (purchase|payment|order)|continue to payment|get (plus|pro|premium)|ajouter au panier|in den warenkorb|añadir a la cesta|agregar al carrito)\b/i;
const SUBTOTAL_WORDS = /\b(subtotal|sub-total|order total|estimated total|cart total|basket total)\b|\btotal\s*:?\s*(US\$|CA\$|[$£€₦])\s?\d/i;
const CHECKOUT_WORDS = /\b(check ?out|proceed to (checkout|payment)|place (your )?order|pay now|subscribe now|start (free )?trial|confirm (purchase|payment)|continue to payment)\b/i;
// A price that repeats: "$20/month", "$200 per year", "$8.99 a month". Subscriptions have no cart, only this.
const RECURRING = /(?:US\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:\/|per|a|each)\s*(?:mo|month|yr|year|week)\b/i;
const ORDER_NUMBER = /\border\s*(number|no\.?|#)\s*[:#]?\s*[A-Z0-9-]{5,}/i;

const SUBTOTAL_SELECTOR =
  '[id*="subtotal" i],[class*="subtotal" i],[data-test*="subtotal" i],[data-testid*="subtotal" i],[id*="sub-total" i],[class*="sub-total" i]';
const CHECKOUT_SELECTOR =
  'a[href*="checkout" i],button[name*="checkout" i],input[name*="checkout" i],[id*="checkout" i],[class*="checkout-button" i],[data-test*="checkout" i]';
// Where a card is about to be typed or a hosted checkout is on the page: Stripe, Paddle, Braintree, PayPal, Shop Pay.
const PAYMENT_SELECTOR =
  'input[autocomplete="cc-number"],input[name*="cardnumber" i],input[name*="card_number" i],iframe[src*="stripe.com" i],iframe[src*="paddle.com" i],iframe[src*="braintreegateway" i],iframe[src*="paypal.com" i],iframe[src*="shop.app" i],iframe[name*="__privateStripeFrame" i]';

export interface PageSignals {
  url: string;
  title: string;
  /** First 20k chars of the page's text, scripts and styles skipped. Bounded so the gate stays cheap. */
  text: string;
  hasSubtotalNode: boolean;
  hasCheckoutNode: boolean;
  /** A card field or a hosted checkout frame: money is about to leave even without a cart. */
  hasPaymentNode?: boolean;
}

/**
 * Pure: how many cart signals does this page show.
 * Words alone never make two: an order email in Gmail says "Subtotal" and "Checkout" too. At least one signal must
 * be structural (the URL or title, or a subtotal or checkout element), so prose cannot wake her.
 */
export function cartSignalCount(p: PageSignals): number {
  let path = '';
  try { path = new URL(p.url).pathname; } catch { /* keep empty */ }
  const urlSignal = CART_PATH.test(path) || PAY_PATH.test(path) || /\b(cart|basket|bag|checkout|billing|pricing)\b/i.test(p.title);
  // Money leaving: a subtotal, or a price that repeats every month (a subscription has no cart).
  const money = p.hasSubtotalNode || SUBTOTAL_WORDS.test(p.text) || RECURRING.test(p.text);
  // A way to pay: a checkout control, a pay or subscribe control, a card field or a hosted checkout frame.
  const pay = p.hasCheckoutNode || !!p.hasPaymentNode || CHECKOUT_WORDS.test(p.text);
  const n = (urlSignal ? 1 : 0) + (money ? 1 : 0) + (pay ? 1 : 0);
  const structural = urlSignal || p.hasSubtotalNode || p.hasCheckoutNode || !!p.hasPaymentNode;
  return structural ? n : Math.min(n, 1);
}

export function isCartPage(p: PageSignals): boolean {
  return cartSignalCount(p) >= 2;
}

/**
 * Pure: is this an order confirmation page. URL plus a thank you, or an order number near a thank you. The URL is a
 * soft signal: the text alone is enough when it carries an order number, except on order history and account pages,
 * which say "Order placed" and "Order #" about orders that are already charged.
 */
export function isConfirmationPage(p: PageSignals): boolean {
  let path = '';
  try { path = new URL(p.url).pathname + new URL(p.url).search; } catch { /* keep empty */ }
  const thanks = /thank you|thanks for your order|order (is )?(confirmed|placed)/i.test(p.text);
  if (CONFIRM_PATH.test(path) && thanks) return true;
  return thanks && ORDER_NUMBER.test(p.text) && !HISTORY_PATH.test(path);
}

/** Pure, cheap: does the URL alone look like an order confirmation. The full check reads the page text. */
export function looksLikeConfirmationUrl(url: string): boolean {
  try { const u = new URL(url); return CONFIRM_PATH.test(u.pathname + u.search); } catch { return false; }
}

/**
 * Pure: an id for this order, so a reload of the confirmation page never posts twice. The order number when the page
 * shows one; otherwise the URL without its hash, which on Amazon and Shopify already carries the order.
 */
export function orderIdFrom(text: string, url: string): string {
  const m = text.match(ORDER_NUMBER);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  return url.split('#')[0]!;
}

const TOTAL_LINE = /\b(order total|grand total|total charged|amount charged|total paid|you paid|total)\b(?:\s*\([^)]{0,30}\))?[^$£€₦\d]{0,30}((?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?)/gi;

/**
 * Pure: what the confirmation page says the order cost. "Order total", "grand total" and "amount charged" beat a
 * bare "total"; the last one wins within a rank (a page lists each shipment, then the order). Null when the page
 * shows no total, and the worker falls back to the cart it last read.
 */
export function orderTotalFrom(text: string): number | null {
  let best: { rank: number; n: number } | null = null;
  TOTAL_LINE.lastIndex = 0;
  for (let m = TOTAL_LINE.exec(text); m; m = TOTAL_LINE.exec(text)) {
    const rank = m[1]!.toLowerCase() === 'total' ? 1 : 2;
    const n = Number(m[2]!.replace(/[^\d.]/g, ''));
    if (!(n > 0)) continue;
    if (!best || rank >= best.rank) best = { rank, n };
  }
  return best?.n ?? null;
}

/** Pure: does this clicked label read as add to cart or buy now. */
export function isAddToCartLabel(label: string): boolean {
  const l = label.replace(/\s+/g, ' ').trim();
  // "Subscribe" and "Subscribe now" as the whole button; never "Subscribe to our newsletter".
  return ADD_WORDS.test(l) || /^subscribe( now| and pay| & save)?$/i.test(l);
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

/** Text nodes in order, skipping script and style contents (inline JSON says "checkout" on pages that are not carts). */
function visibleText(doc: Document, root: Element, cap: number): string {
  // NodeFilter.SHOW_TEXT is 4; the literal keeps this file free of globals node lacks.
  const walker = doc.createTreeWalker(root, 4);
  let out = '';
  for (let n = walker.nextNode(); n && out.length < cap; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (parent && SKIP.has(parent.tagName.toUpperCase())) continue;
    out += n.nodeValue + ' ';
  }
  return out.slice(0, cap);
}

/** True on a cart, checkout or pay path. Reader 3 reads product data only off these, where JSON-LD means the item. */
export function isMoneyPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return CART_PATH.test(path) || PAY_PATH.test(path);
  } catch {
    return false;
  }
}

/**
 * The gate's fast path on a live page. Same signals as cartSignalCount(readSignals()), cheapest first:
 * URL and title, then two selector lookups, and the text walk only when it could still reach two signals.
 * Returns early once two are found; the count is only exact below two.
 */
export function liveCartSignalCount(doc: Document, url: string): number {
  let path = '';
  try { path = new URL(url).pathname; } catch { /* keep empty */ }
  let n = CART_PATH.test(path) || PAY_PATH.test(path) || /\b(cart|basket|bag|checkout|billing|pricing)\b/i.test(doc.title) ? 1 : 0;
  const subNode = !!doc.querySelector(SUBTOTAL_SELECTOR);
  const payNode = !!doc.querySelector(CHECKOUT_SELECTOR) || !!doc.querySelector(PAYMENT_SELECTOR);
  n += (subNode ? 1 : 0) + (payNode ? 1 : 0);
  if (n >= 2) return n;
  // Text can only add to a structural signal; with none, the page is shut without walking its text.
  if (n === 0 || !doc.body) return n;
  const text = visibleText(doc, doc.body, 20000);
  if (!subNode && (SUBTOTAL_WORDS.test(text) || RECURRING.test(text))) n++;
  if (!payNode && CHECKOUT_WORDS.test(text)) n++;
  return n;
}

/** Reads the live page into PageSignals. Read only. */
export function readSignals(doc: Document, url: string): PageSignals {
  const body = doc.body;
  return {
    url,
    title: doc.title,
    text: body ? visibleText(doc, body, 20000) : '',
    hasSubtotalNode: !!doc.querySelector(SUBTOTAL_SELECTOR),
    hasCheckoutNode: !!doc.querySelector(CHECKOUT_SELECTOR),
    hasPaymentNode: !!doc.querySelector(PAYMENT_SELECTOR),
  };
}

/** Walks up from a click target to the nearest button or link and returns its label. */
export function clickLabel(target: EventTarget | null): string {
  let el = target instanceof Element ? target : null;
  for (let i = 0; el && i < 5; i++, el = el.parentElement) {
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A' || (tag === 'INPUT' && (el as HTMLInputElement).type === 'submit') || el.getAttribute('role') === 'button') {
      return (el as HTMLInputElement).value || el.getAttribute('aria-label') || el.textContent || '';
    }
  }
  return '';
}
