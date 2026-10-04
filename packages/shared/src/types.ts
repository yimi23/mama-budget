// The one shape every cart reader returns. The judge never knows which reader fired.

export type CurrencyCode = 'USD' | 'NGN' | 'GBP' | 'EUR' | 'CAD';

export type ReaderSource = 'platform' | 'adapter' | 'jsonld' | 'text';

export interface CartItem {
  name: string;
  qty: number;
  /** Major units in the store currency, e.g. 24.99 */
  unitPrice: number;
}

export interface CartRead {
  items: CartItem[];
  /** Major units in the store currency. Null when the reader could not see it. */
  subtotal: number | null;
  currency: CurrencyCode;
  source: ReaderSource;
  /** Which reader inside the layer, e.g. 'shopify', 'amazon' */
  via: string;
  /** 1.0 platform and adapter, 0.9 JSON-LD, the model's own number for text */
  confidence: number;
}
