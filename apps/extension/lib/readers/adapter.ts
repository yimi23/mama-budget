// Layer 2: site adapters. One generic runner over a plain JSON spec, so hand written specs (Amazon, Target)
// and learned specs (from /learn) run through the same code. Re queries the document on every call.

import type { CartItem, CartRead } from '@mama/shared/types';
import { currencyOf, firstPrice, parsePrice } from '@mama/shared/currency';

export interface Field {
  /** CSS selector inside the row (or the document, for subtotal), or several tried in order. Omit to read the row itself. */
  sel?: string | string[];
  /** Attribute to read. Omit to read text. */
  attr?: string;
  /** Use the parent of the first element whose own text is exactly this, e.g. "Subtotal" next to its amount. */
  label?: string;
  /** firstPrice: keep only the first amount written with a currency mark. */
  pick?: 'firstPrice';
}

function byLabel(scope: Element | Document, label: string): Element | null {
  const want = label.trim().toLowerCase();
  for (const el of scope.querySelectorAll('span,div,p,dt,td,th,strong,b,h2,h3,h4')) {
    if (el.children.length === 0 && el.textContent?.trim().toLowerCase() === want) return el.parentElement;
  }
  return null;
}

export interface AdapterSpec {
  /** Registrable domain, e.g. amazon.com */
  host: string;
  /** Container that holds only the items going to checkout. */
  root: string;
  /** One element per cart line, matched inside root. */
  row: string;
  name: Field;
  price: Field;
  qty?: Field;
  /** Read from the whole document: buy boxes often sit outside the item list. */
  subtotal?: Field;
}

function readField(scope: Element | Document, f: Field): string {
  // A selector list matches in document order, so fallbacks are tried one at a time instead.
  const sels = f.sel == null ? [] : Array.isArray(f.sel) ? f.sel : [f.sel];
  let el: Element | null = sels.length ? null : scope.nodeType === 1 ? (scope as Element) : null;
  for (const s of sels) if ((el = scope.querySelector(s))) break;
  if (f.label) el = byLabel(el ?? scope, f.label);
  if (!el) return '';
  const v = (f.attr ? el.getAttribute(f.attr) ?? '' : el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return f.pick === 'firstPrice' ? firstPrice(v) : v;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Stores differ on whether the row price is per unit or the line total. The page's own subtotal settles it. */
function reconcile(items: CartItem[], subtotal: number | null): CartItem[] {
  if (subtotal == null || !items.some((i) => i.qty > 1)) return items;
  const asUnit = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const asLine = items.reduce((s, i) => s + i.unitPrice, 0);
  if (near(asUnit, subtotal) || !near(asLine, subtotal)) return items;
  return items.map((i) => ({ ...i, unitPrice: Math.round((i.unitPrice / i.qty) * 100) / 100 }));
}

export function runAdapter(spec: AdapterSpec, doc: Document): CartRead | null {
  const root = doc.querySelector(spec.root);
  if (!root) return null;
  const items: CartItem[] = [];
  let priceText = '';
  for (const row of root.querySelectorAll(spec.row)) {
    const name = readField(row, spec.name);
    const rawPrice = readField(row, spec.price);
    const unitPrice = parsePrice(rawPrice);
    if (!name || unitPrice == null) continue;
    const qty = spec.qty ? Number(parsePrice(readField(row, spec.qty))) || 1 : 1;
    items.push({ name, qty, unitPrice });
    priceText ||= rawPrice;
  }
  const subtotalText = spec.subtotal ? readField(doc, spec.subtotal) : '';
  const subtotal = subtotalText ? parsePrice(subtotalText) : null;
  return {
    items: reconcile(items, subtotal),
    subtotal,
    // Attribute prices carry no symbol; the subtotal text usually does.
    currency: currencyOf(subtotalText || priceText),
    source: 'adapter',
    via: spec.host,
    confidence: 1,
  };
}
