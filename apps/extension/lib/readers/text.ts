// Reader 4: the text of the cart region, for the model to read when no other reader knows the store. The floor,
// never the plan. Walks up from the subtotal (or the first price) to the nearest ancestor that holds the item list,
// takes its visible text, capped. Only this text leaves the page.

const PRICE = /(?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d.,]*\s?(?:€|NGN|USD|GBP|EUR)/g;
const SUBTOTAL = /\b(subtotal|sub-total|order total|estimated total|cart total|basket total|total|due today|per month|a month|\/month|\/mo\b|per year|\/year|billed)\b/i;
const CAP = 6000;

/** innerText where the browser has it (it breaks lines between blocks); otherwise text nodes joined with spaces, so words never run together across elements. */
function visible(el: Element): string {
  const inner = (el as HTMLElement).innerText;
  const raw = typeof inner === 'string' ? inner : [...(el.ownerDocument?.createTreeWalker(el, 4) ? walkText(el) : [])].join(' ');
  return raw.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function* walkText(el: Element): Generator<string> {
  const walker = el.ownerDocument!.createTreeWalker(el, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
    const t = (n.nodeValue ?? '').trim();
    if (t) yield t;
  }
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
    // A cart: three prices and a total. A checkout or a plan: one price and the word that says it is due or repeats.
    if ((prices >= 3 || (prices >= 1 && /due today|per month|a month|\/month|\/mo\b|per year|\/year|billed|pay now|subscribe/i.test(text))) && SUBTOTAL.test(text)) { best = text; if (text.length > 400) break; }
  }
  const text = best ?? visible(body);
  return text.length > CAP ? text.slice(0, CAP) : text;
}
