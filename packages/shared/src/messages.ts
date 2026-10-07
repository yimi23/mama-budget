// Every message between content script, popup and worker. Add the case here before writing the handler.

import type { Answer, BuyReply, CartItem, CartRead, Cue, CurrencyCode, Grandma, JudgeReply, House, Me, Month, PlanReply, Report, Saw, ShelfItem, Week } from './types.ts';

/** What she already asked about or reacted to this browser session, across every tab and reload. */
export interface HandledLists {
  asked: string[];
  reacted: string[];
}

export type Message =
  | { type: 'CART_READ'; store: string; url: string; read: CartRead }
  | { type: 'GET_WEEK' }
  | { type: 'JUDGE'; store: string; currency: CurrencyCode; items: CartItem[]; confidence?: number }
  /** Reader 4: the cart region's text, to the model through the API. Cached by text hash. */
  | { type: 'EXTRACT'; store: string; text: string }
  | { type: 'ANSWER'; key: string; answer: Answer | 'planned'; reason?: string }
  /** A reason was given with the answer: what does it mean for the plan (any store). */
  | { type: 'PLAN'; store: string; currency: CurrencyCode; item: { name: string; short: string; price: number }; reason: string }
  /** "From savings": fund this week by this much for this item. */
  | { type: 'FUND'; store: string; item: { name: string; short: string }; amount: number }
  | { type: 'MARK'; kind: 'asked' | 'reacted'; key: string }
  /** Buy anyway on the card: the admitted want is charged now. */
  | { type: 'BUY'; store: string; currency: CurrencyCode; item: { name: string; short: string; price: number; storePrice?: number } }
  /** A real order confirmation page: charge what was paid. The page's order total when it shows one, else the store's last cart, minus anything already posted. */
  | { type: 'CONFIRM'; store: string; orderId: string; total: number | null }
  /** The item you agreed to put back left the cart: the money stays in the week, Kept goes up. */
  | { type: 'PUT_BACK'; name: string; price: number; store?: string }
  /** The shelf: what was put back and not let go. */
  | { type: 'SHELF' }
  /** The Sunday report card for this week. */
  | { type: 'REPORT'; grandma: Grandma }
  /** The house: read it, open one, join by code, leave, or set Monday's number (opener only). */
  | { type: 'HOUSE'; action: 'get' | 'open' | 'join' | 'leave' | 'envelope'; code?: string; amount?: number }
  /** The plan (GET /me). */
  | { type: 'ME' }
  /** Start the trial checkout or open the billing portal, in a new tab. */
  | { type: 'BILLING'; action: 'checkout' | 'portal'; plan?: 'month' | 'year' }
  /** A shelf row answered: still wanted (remembered as planned) or let go (the row leaves the shelf, the kept credit stays). */
  | { type: 'SHELVE'; requestId: string; action: 'still' | 'let-go' }
  /** Onboarding 06: a bill she was not sure of. "confirmed" makes the early stream a bill; "not-recurring" drops it. */
  | { type: 'CORRECT'; merchantKey: string; kind: 'confirmed' | 'not-recurring' }
  | { type: 'START_OVER' }
  /** Home: remove the bank link (the week stays), or delete everything the API holds for this device and clear the browser. */
  | { type: 'UNLINK_BANK' }
  | { type: 'DELETE_ME' }
  /** Her voice for one line. Fire and forget: the card never waits on audio. */
  | { type: 'SPEAK'; text: string; grandma: Grandma; mood?: 'calm' | 'shocked' | 'down' }
  /** Onboarding 05: the 30 day read, in her words. */
  | { type: 'MONTH'; grandma: Grandma }
  /** A SimpleFIN Setup Token from onboarding screen 04: the API claims it and pulls the bank. */
  | { type: 'LINK_BANK'; token: string; grandma: Grandma }
  /** Onboarding 05: fetch these lines into the API's voice cache so screen 06 speaks at once. Nothing plays. */
  | { type: 'WARM'; texts: string[]; grandma: Grandma }
  /** Onboarding 07: send the first statement now. ok only when a text actually went. */
  | { type: 'TEXT_NOW'; grandma: Grandma; to?: string }
  /** Can she text right now, is the API up. Drives disabled states, never a fake sent state. */
  | { type: 'HEALTH' }
  /** This page's host: is it a merchant she said she would watch, and what does she say on arrival (once per session per store). */
  | { type: 'WATCH_HERE'; host: string }
  /** Onboarding 06: the weekly envelope she proposed, adjusted. */
  | { type: 'SET_ENVELOPE'; amount: number }
  /** One of the six cue sounds. Honours settings.sounds and quiet hours. */
  | { type: 'CUE'; cue: Cue }
  | { type: 'PING' };

export type Reply<M extends Message> =
  M extends { type: 'CART_READ' } ? { ok: true } :
  M extends { type: 'GET_WEEK' } ? { ok: true; week: Week } | { ok: false } :
  M extends { type: 'JUDGE' } ? ({ ok: true; handled: HandledLists } & JudgeReply) | { ok: false } :
  M extends { type: 'MARK' } ? { ok: true } :
  M extends { type: 'EXTRACT' } ? { ok: true; read: CartRead } | { ok: false } :
  M extends { type: 'BUY' } ? ({ ok: true } & BuyReply) | { ok: false } :
  M extends { type: 'CONFIRM' } ? { ok: true; posted: number } :
  M extends { type: 'PUT_BACK' } ? { ok: true; week: Week } | { ok: false } :
  M extends { type: 'SHELF' } ? { ok: true; shelf: ShelfItem[] } | { ok: false } :
  M extends { type: 'REPORT' } ? ({ ok: true } & Report) | { ok: false } :
  M extends { type: 'HOUSE' } ? { ok: true; house: House | null; week: Week | null } | { ok: false; reason: string } :
  M extends { type: 'ME' } ? ({ ok: true } & Me) | { ok: false } :
  M extends { type: 'BILLING' } ? { ok: true; url: string } | { ok: false; reason: string } :
  M extends { type: 'SHELVE' } ? { ok: true; shelf: ShelfItem[] } | { ok: false } :
  M extends { type: 'CORRECT' } ? { ok: true; saw: Saw | null; week: Week | null } | { ok: false } :
  M extends { type: 'START_OVER' } ? { ok: true } :
  M extends { type: 'UNLINK_BANK' } ? { ok: true; week: Week | null } | { ok: false } :
  M extends { type: 'DELETE_ME' } ? { ok: true } :
  M extends { type: 'SPEAK' } ? { ok: boolean; duration: number | null; dataUrl?: string; speakText?: string } :
  M extends { type: 'MONTH' } ? { ok: true; month: Month } | { ok: false } :
  M extends { type: 'LINK_BANK' } ? { ok: true; month: Month } | { ok: false; reason: string } :
  M extends { type: 'WARM' } ? { ok: true } :
  M extends { type: 'TEXT_NOW' } ? { ok: boolean; texted: boolean; text: string | null; reason: string | null } :
  M extends { type: 'HEALTH' } ? { api: boolean; texts: boolean; voice: boolean } :
  M extends { type: 'WATCH_HERE' } ? { line: string | null } :
  M extends { type: 'SET_ENVELOPE' } ? { ok: true; envelope: number } | { ok: false } :
  M extends { type: 'CUE' } ? { ok: boolean } :
  M extends { type: 'ANSWER' } ? { ok: true } :
  M extends { type: 'PLAN' } ? ({ ok: true } & PlanReply) | { ok: false } :
  M extends { type: 'FUND' } ? { ok: true; week: Week; line: string } | { ok: false } :
  M extends { type: 'PING' } ? { ok: true; at: number } :
  never;
