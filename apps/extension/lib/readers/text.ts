// Reader 4: the text of the cart region, for the model to read when no other reader knows the store. The floor,
// never the plan. Walks up from the subtotal (or the first price) to the nearest ancestor that holds the item list,
// takes its visible text, capped. Only this text leaves the page.

const PRICE = /(?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d.,]*\s?(?:€|NGN|USD|GBP|EUR)/g;
const SUBTOTAL = /\b(subtotal|sub-total|order total|estimated total|cart total|basket total|total)\b/i;
const CAP = 6000;

function visible(el: Element): string {
  return ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

/** The smallest region that reads like a cart: three or more prices and a total word. Null when the page has none. */
export function cartRegionText(doc: Document): string | null {
  const body = doc.body;
  if (!body) return null;
  // Start from the element whose own text says Subtotal or Total, else the first price on the page.
  let start: Element | null = null;
  const walker = doc.createTreeWalker(body, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
    const t = n.nodeValue ?? '';
    PRICE.lastIndex = 0;
    const near = t + ' ' + (parent.parentElement?.textContent ?? '');
    if (SUBTOTAL.test(t) && PRICE.test(near)) { start = parent; break; }
    PRICE.lastIndex = 0;
    if (!start && PRICE.test(t)) start = parent;
  }
  PRICE.lastIndex = 0;
  if (!start) return null;
  let el: Element | null = start;
  let best: string | null = null;
  for (let depth = 0; el && el !== body && depth < 12; depth++, el = el.parentElement) {
    const text = visible(el);
    const prices = text.match(PRICE)?.length ?? 0;
    if (prices >= 3 && SUBTOTAL.test(text)) { best = text; if (text.length > 400) break; }
  }
  const text = best ?? visible(body);
  return text.length > CAP ? text.slice(0, CAP) : text;
}
