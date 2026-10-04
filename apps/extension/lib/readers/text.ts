// Reader 4: the text of the cart region, for the model to read when no other reader knows the store. The floor,
// never the plan. Finds the order summary (the element whose text says Subtotal next to a price), then the item
// rows: the group of sibling elements whose prices add up to that subtotal. Sends the rows and the summary, capped,
// and nothing else: no recommendation shelves, no "customers also bought", no footer. When no group adds up it walks
// up from the summary to the nearest ancestor that reads like a cart, as before. Only this text leaves the page.

const PRICE = /(?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d.,]*\s?(?:€|NGN|USD|GBP|EUR)/g;
const SUBTOTAL = /\b(subtotal|sub-total|order total|estimated total|cart total|basket total|total|due today|per month|a month|\/month|\/mo\b|per year|\/year|billed)\b/i;
const RECURRING = /due today|per month|a month|\/month|\/mo\b|per year|\/year|billed|pay now|subscribe/i;
const QTY = /\b(?:qty|quantity)\s*:?\s*(\d{1,3})\b|\b(\d{1,3})\s*[x×]\s*(?=[$£€₦])/i;
const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/;
const CAP = 6000;
const SUMMARY_CAP = 1200;

/** innerText where the browser has it (it breaks lines between blocks); otherwise text nodes joined with spaces, so words never run together across elements. */
function visible(el: Element): string {
  const inner = (el as HTMLElement).innerText;
  const raw = typeof inner === 'string' ? inner : [...walkText(el)].join(' ');
  return raw.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function* walkText(el: Element): Generator<string> {
  const walker = el.ownerDocument!.createTreeWalker(el, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || SKIP.test(parent.tagName)) continue;
    const t = (n.nodeValue ?? '').trim();
    if (t) yield t;
  }
}

const prices = (text: string): string[] => text.match(PRICE) ?? [];
const amount = (price: string): number => Number(price.replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));

/** The number after the word subtotal (or total) in the summary; the first price when the word has none after it. */
function subtotalOf(summary: string): number | null {
  const m = /\b(?:subtotal|sub-total|order total|estimated total|cart total|basket total|total)\b(?:\s*\([^)]{0,30}\))?[^$£€₦\d]{0,40}((?:US\$|CA\$|C\$|[$£€₦])\s?\d[\d,]*(?:\.\d{1,2})?)/i.exec(summary);
  const p = m?.[1] ?? prices(summary)[0];
  if (!p) return null;
  const n = amount(p);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The element whose own text says Subtotal next to a price; else the element of the first price on the page. */
function startOf(doc: Document): Element | null {
  let start: Element | null = null;
  const walker = doc.createTreeWalker(doc.body, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || SKIP.test(parent.tagName)) continue;
    const t = n.nodeValue ?? '';
    const near = t + ' ' + (parent.parentElement?.textContent ?? '');
    if (SUBTOTAL.test(t) && prices(near).length) return parent;
    if (!start && prices(t).length) start = parent;
  }
  return start;
}

/** A row of the cart: a few prices, some words, not a whole page. Its money is the first price times its quantity. */
function rowMoney(text: string): number | null {
  const ps = prices(text);
  if (ps.length < 1 || ps.length > 8 || text.length < 12 || text.length > 1500) return null;
  const unit = amount(ps[0] ?? '');
  if (!Number.isFinite(unit) || unit <= 0) return null;
  const q = QTY.exec(text);
  const qty = q ? Number(q[1] ?? q[2]) : 1;
  return unit * (qty >= 1 && qty <= 99 ? qty : 1);
}

/**
 * The elements whose prices add up to the subtotal: every element on the page that shares a tag and class with at
 * least one other (two to sixty of them, anywhere, since stores nest items under pickup and shipping headers), each
 * a few prices and some words. The closest sum wins and must land within 15 percent (savings move a subtotal a
 * little; a recommendation shelf misses it by a mile). Among equal sums the fullest rows win, so the names come too.
 * Hidden copies (a pickup tab behind a shipping tab) are skipped where the browser can tell.
 */
function rowsThatAddUp(doc: Document, subtotal: number): Element[] | null {
  const groups = new Map<string, Element[]>();
  const all = doc.body.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!el || SKIP.test(el.tagName) || !el.className || typeof el.className !== 'string') continue;
    const vis = (el as HTMLElement).checkVisibility;
    if (typeof vis === 'function' && !vis.call(el)) continue;
    const key = el.tagName + '.' + el.className;
    const g = groups.get(key) ?? [];
    g.push(el);
    groups.set(key, g);
  }
  let best: { rows: Element[]; miss: number; chars: number } | null = null;
  for (const rows of groups.values()) {
    if (rows.length < 2 || rows.length > 60) continue;
    let sum = 0;
    let priced = 0;
    let chars = 0;
    for (const r of rows) {
      const t = r.textContent ?? '';
      const m = rowMoney(t);
      if (m == null) continue;
      sum += m;
      priced++;
      chars += t.length;
    }
    if (priced < 2 || priced < rows.length - 1) continue;
    const miss = Math.abs(sum - subtotal) / subtotal;
    if (miss > 0.15) continue;
    if (!best || miss < best.miss - 1e-4 || (Math.abs(miss - best.miss) <= 1e-4 && chars > best.chars)) best = { rows, miss, chars };
  }
  return best?.rows ?? null;
}

/** The old walk: up from the start to the smallest ancestor with three prices and a total word (one price and a recurring word for a plan). */
function regionByWalk(start: Element, body: Element): string {
  let el: Element | null = start;
  let best: string | null = null;
  for (let depth = 0; el && el !== body && depth < 12; depth++, el = el.parentElement) {
    const text = visible(el);
    const n = prices(text).length;
    if ((n >= 3 || (n >= 1 && RECURRING.test(text))) && SUBTOTAL.test(text)) { best = text; if (text.length > 400) break; }
  }
  return best ?? visible(body);
}

/** The summary: up from the start to the smallest ancestor with a price and a total word, under the summary cap. */
function summaryByWalk(start: Element, body: Element): string | null {
  let el: Element | null = start;
  let best: string | null = null;
  for (let depth = 0; el && el !== body && depth < 12; depth++, el = el.parentElement) {
    const text = visible(el);
    if (text.length > SUMMARY_CAP) break;
    if (prices(text).length >= 1 && SUBTOTAL.test(text)) best = text;
  }
  return best;
}

/** The cart as text: item rows that add up to the subtotal, then the summary; else the smallest region that reads like a cart. Null when the page has no prices. */
export function cartRegionText(doc: Document): string | null {
  const body = doc.body;
  if (!body) return null;
  const start = startOf(doc);
  if (!start) return null;
  const summary = summaryByWalk(start, body);
  const subtotal = summary ? subtotalOf(summary) : null;
  if (summary && subtotal != null) {
    const rows = rowsThatAddUp(doc, subtotal);
    if (rows) {
      const items = rows.map((r) => visible(r)).filter(Boolean).join('\n');
      const text = `${items.slice(0, CAP - summary.length - 1)}\n${summary}`;
      return text.length > CAP ? text.slice(0, CAP) : text;
    }
  }
  const text = regionByWalk(start, body);
  return text.length > CAP ? text.slice(0, CAP) : text;
}
