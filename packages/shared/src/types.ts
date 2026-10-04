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

export type Mood = 'calm' | 'watching' | 'shocked' | 'down' | 'proud';

/** GET /week: this week's envelope, summed from the ledger. */
export interface Week {
  budget: number;
  spent: number;
  left: number;
  kept: number;
  ratio: number;
  mood: Mood;
  daysLeft: number;
  bills: { payee: string; nickname?: string; amount: number; due: string; daysUntil: number }[];
}

export type Label = 'need' | 'want' | 'ask';
export type Answer = 'need' | 'want';

/** One item's verdict from POST /v2/judge. The judge decided; the line only says it. */
export interface Verdict {
  name: string;
  /** Short spoken name for her lines: "Fujifilm Instax Mini 99". */
  short: string;
  price: number;
  /** What an answer is stored under. Key logic lives in the rules only. */
  key: string;
  label: Label;
  react: boolean;
  mood: Mood;
  reason: string;
  tags: string[];
  line: string;
  sub: string;
}

export interface JudgeReply {
  week: Week;
  mood: Mood;
  verdicts: Verdict[];
}
