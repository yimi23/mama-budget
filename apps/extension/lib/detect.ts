// The gate. Runs on every page, decides in under 5ms whether this page matters.
// No imports, no DOM writes. Two signals wake her on a cart page, one does not.

const CART_PATH = /(^|[\/_.-])(cart|checkout|bag|basket|order)s?([\/_.?#-]|$)/i;
const CONFIRM_PATH = /(thank[-_]?you|order[-_]?confirmation|order[-_]?placed|confirmation)/i;
const ADD_WORDS = /\b(add to (cart|bag|basket|trolley)|buy now|add to order|ajouter au panier|in den warenkorb|añadir a la cesta|agregar al carrito)\b/i;
const SUBTOTAL_WORDS = /\b(subtotal|sub-total|order total|estimated total|cart total|basket total)\b|\btotal\s*:?\s*(US\$|CA\$|[$£€₦])\s?\d/i;
const CHECKOUT_WORDS = /\b(check ?out|proceed to (checkout|payment)|place (your )?order)\b/i;
const ORDER_NUMBER = /\border\s*(number|no\.?|#)\s*[:#]?\s*[A-Z0-9-]{5,}/i;

const SUBTOTAL_SELECTOR =
  '[id*="subtotal" i],[class*="subtotal" i],[data-test*="subtotal" i],[data-testid*="subtotal" i],[id*="sub-total" i],[class*="sub-total" i]';
const CHECKOUT_SELECTOR =
  'a[href*="checkout" i],button[name*="checkout" i],input[name*="checkout" i],[id*="checkout" i],[class*="checkout-button" i],[data-test*="checkout" i]';

export interface PageSignals {
  url: string;
  title: string;
  /** First 20k chars of the page's text, scripts and styles skipped. Bounded so the gate stays cheap. */
  text: string;
  hasSubtotalNode: boolean;
  hasCheckoutNode: boolean;
}

/**
 * Pure: how many cart signals does this page show.
 * Words alone never make two: an order email in Gmail says "Subtotal" and "Checkout" too. At least one signal must
 * be structural (the URL or title, or a subtotal or checkout element), so prose cannot wake her.
 */
export function cartSignalCount(p: PageSignals): number {
  let path = '';
  try { path = new URL(p.url).pathname; } catch { /* keep empty */ }
  const urlSignal = CART_PATH.test(path) || /\b(cart|basket|bag)\b/i.test(p.title);
  const subtotal = p.hasSubtotalNode || SUBTOTAL_WORDS.test(p.text);
  const checkout = p.hasCheckoutNode || CHECKOUT_WORDS.test(p.text);
  const n = (urlSignal ? 1 : 0) + (subtotal ? 1 : 0) + (checkout ? 1 : 0);
  const structural = urlSignal || p.hasSubtotalNode || p.hasCheckoutNode;
  return structural ? n : Math.min(n, 1);
}

export function isCartPage(p: PageSignals): boolean {
  return cartSignalCount(p) >= 2;
}

/** Pure: is this an order confirmation page. URL plus a thank you, or an order number near a thank you. */
export function isConfirmationPage(p: PageSignals): boolean {
  let path = '';
  try { path = new URL(p.url).pathname + new URL(p.url).search; } catch { /* keep empty */ }
  const thanks = /thank you|thanks for your order|order (is )?(confirmed|placed)/i.test(p.text);
  if (CONFIRM_PATH.test(path) && thanks) return true;
  return thanks && ORDER_NUMBER.test(p.text);
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

/** Pure: does this clicked label read as add to cart or buy now. */
export function isAddToCartLabel(label: string): boolean {
  return ADD_WORDS.test(label.replace(/\s+/g, ' ').trim());
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

/**
 * The gate's fast path on a live page. Same signals as cartSignalCount(readSignals()), cheapest first:
 * URL and title, then two selector lookups, and the text walk only when it could still reach two signals.
 * Returns early once two are found; the count is only exact below two.
 */
export function liveCartSignalCount(doc: Document, url: string): number {
  let path = '';
  try { path = new URL(url).pathname; } catch { /* keep empty */ }
  let n = CART_PATH.test(path) || /\b(cart|basket|bag)\b/i.test(doc.title) ? 1 : 0;
  const subNode = !!doc.querySelector(SUBTOTAL_SELECTOR);
  const chkNode = !!doc.querySelector(CHECKOUT_SELECTOR);
  n += (subNode ? 1 : 0) + (chkNode ? 1 : 0);
  if (n >= 2) return n;
  // Text can only add to a structural signal; with none, the page is shut without walking its text.
  if (n === 0 || !doc.body) return n;
  const text = visibleText(doc, doc.body, 20000);
  if (!subNode && SUBTOTAL_WORDS.test(text)) n++;
  if (!chkNode && CHECKOUT_WORDS.test(text)) n++;
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
