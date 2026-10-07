// The one shape every cart reader returns. The judge never knows which reader fired.

export type CurrencyCode = 'USD' | 'NGN' | 'GBP' | 'EUR' | 'CAD';

/** The family. Mirrors apps/extension/lib/ui/badge.ts. */
export type Grandma = 'mama' | 'nana' | 'abuela' | 'wong';

export type ReaderSource = 'platform' | 'adapter' | 'jsonld' | 'text';

export interface CartItem {
  name: string;
  qty: number;
  /** Major units in the store currency, e.g. 24.99 */
  unitPrice: number;
  /** Set only on the way to the judge, when unitPrice has been converted to USD: the price as the store shows it. */
  storeUnitPrice?: number;
  /** A subscription or plan repeats; a purchase is once. Read by reader 4, so she can say "20 dollars a month". */
  period?: 'once' | 'week' | 'month' | 'year';
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
  /** Live bank only. */
  source?: 'bank';
  jar?: number;
  streak?: number;
  grace?: number;
  carry?: number;
  payday?: { at: string; amount: number; daysUntil: number } | null;
  reason?: string;
  pulledAt?: number;
  /** Billing (GET /me): open when the API has no Stripe keys, full on a trial or a paid plan, locked after, free on the degraded tier. */
  plan?: Plan;
  /** Set when this person is in a house: the week above is the house's (one pot), these are the house's own facts. */
  house?: House;
  /** House only: what the others see of each purchase, amount and item and day, never who. */
  items?: { amount: number; item: string; kept?: boolean; day?: string }[];
  /** House only: this person's own part of the week. */
  mine?: { spent: number; kept: number } | null;
}

export type Plan = 'open' | 'full' | 'locked' | 'free';

/** The house (GET /house): one envelope shared by two to four people. */
export interface House {
  code: string;
  members: number;
  /** This person opened the house, so they set the number. */
  opener: boolean;
  envelope: number;
  /** A number set this week, applied next Monday. */
  nextEnvelope: number | null;
}

/** GET /me: the plan and the prices, for the popup. */
export interface Me {
  plan: Plan;
  status: string;
  periodEnd: number | null;
  trialDaysLeft: number | null;
  prices: { month: { amount: number; label: string }; year: { amount: number; label: string } };
  house: boolean;
}

/** GET /month: the 30 day read for onboarding. Everything she knows before you have typed anything. */
/** What she saw in a real bank (GET /bank/saw): paychecks, bills with confirm flags, cards, unsure merchants, the plan. */
export interface Saw {
  paychecks: { from: string; amount: number; cadence: string; next: string | null; variable: boolean }[];
  bills: { key: string; merchant: string; amount: number; cadence: string; next: string | null; confirm: boolean; kind: string; variable: boolean; changed: { from: number; to: number } | null }[];
  cards: { name: string; owed: number }[];
  transfers: number;
  unsure: { merchant: string; amount: number }[];
  plan: { balance: number; payday: { at: number; amount: number; cadence: string; variable: boolean } | null; daysUntil: number; billsTotal: number; cardOwed: number; savings: number; safe: number; needsWeekly: number; envelope: number; reason: string };
  pulledAt: number;
}

export interface Month extends Week {
  /** True when the numbers come from a real bank through SimpleFIN. */
  live?: boolean;
  /** Why the proposed envelope is what it is, in one sentence (live only). */
  reason?: string;
  saw?: Saw | null;
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

/** The Sunday report card (GET /report): six lines and five fields. Closed on Sunday 7pm, "so far" before. */
export interface Report {
  lines: string[];
  text: string;
  fields: {
    result: { stayed: number; over: number; spent: number; envelope: number; arrow: 'better' | 'worse' | 'same' | null; lastWeekSpent: number | null; closed: boolean };
    biggest: { item: string; amount: number; day: string | null } | null;
    streak: { weeks: number; graced: boolean };
    jar: number;
    kept: number;
    monday: { envelope: number; carry: number };
  };
}

/** One thing put back after she spoke (GET /shelf): the kept moment, newest first. */
export interface ShelfItem {
  requestId: string;
  item: string;
  amount: number;
  store: string | null;
  /** YYYY-MM-DD of the put-back. */
  date: string;
  /** "Still want it" was tapped: remembered as planned, so she will not scold it when it comes back. */
  still: boolean;
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

/** POST /v2/plan: what a reason means for the week. */
export interface PlanReply {
  occasion: string | null;
  answer: 'planned' | null;
  line: string | null;
  proposal: { kind: 'fund'; amount: number } | null;
  savings: number;
  week: Week;
}
