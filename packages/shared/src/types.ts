// The one shape every cart reader returns. The judge never knows which reader fired.

export type CurrencyCode = 'USD' | 'NGN' | 'GBP' | 'EUR' | 'CAD';

export type ReaderSource = 'platform' | 'adapter' | 'jsonld' | 'text';

export interface CartItem {
  name: string;
  qty: number;
  /** Major units in the store currency, e.g. 24.99 */
  unitPrice: number;
  /** Set only on the way to the judge, when unitPrice has been converted to USD: the price as the store shows it. */
  storeUnitPrice?: number;
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

/** GET /month: the 30 day read for onboarding. Everything she knows before you have typed anything. */
export interface Month extends Week {
  firstName: string | null;
  proposedEnvelope: number;
  sentHome: number;
  toSavings: number;
  counts: { purchases: number; wants: number; needs: number; paychecks: number; transfers: number; bills: number };
  topWants: { merchant: string; amount: number; category: string }[];
  trueLine: { topCategory: string; topAmount: number; contrastItem: string | null; contrastAmount: number | null } | null;
  lines: {
    /** Null when there is no month to speak of: the screen is skipped. */
    trueLine: { text: string; spoken: string } | null;
    watches: { title: string; line: string; spoken: string; merchant: string; amount: number; here: string }[];
  };
}

/** The six cue sounds (docs/research_clicky_onboarding.md section 4.7). Synthesised in the offscreen document. */
export type Cue = 'arrive' | 'ask' | 'surprised' | 'proud' | 'text' | 'tick';

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
  /** What she says right after you answer, when the answer earns a bubble rather than a card. */
  ack: string | null;
  sub: string;
}

export interface JudgeReply {
  week: Week;
  mood: Mood;
  verdicts: Verdict[];
  /** Small lines the card needs on hand: after "You're right", and when the item leaves the cart. */
  lines: { agreed: string; proud: string; watching: string; askMany: string };
}

/** POST /v2/buy: the charge landed (or was already recorded under that requestId). */
export interface BuyReply {
  week: Week;
  mood: Mood;
  line: string;
  sub: string;
  texted: boolean;
  tag: 'need' | 'want';
}
