// Every message between content script, popup and worker. Add the case here before writing the handler.

import type { Answer, BuyReply, CartItem, CartRead, CurrencyCode, JudgeReply, Week } from './types.ts';

/** What she already asked about or reacted to this browser session, across every tab and reload. */
export interface HandledLists {
  asked: string[];
  reacted: string[];
}

export type Message =
  | { type: 'CART_READ'; store: string; url: string; read: CartRead }
  | { type: 'GET_WEEK' }
  | { type: 'JUDGE'; store: string; currency: CurrencyCode; items: CartItem[] }
  | { type: 'ANSWER'; key: string; answer: Answer }
  | { type: 'MARK'; kind: 'asked' | 'reacted'; key: string }
  /** Buy anyway on the card: the admitted want is charged now. */
  | { type: 'BUY'; store: string; currency: CurrencyCode; item: { name: string; short: string; price: number } }
  /** A real order confirmation page: charge the store's last cart, minus anything already posted. */
  | { type: 'CONFIRM'; store: string; orderId: string }
  | { type: 'START_OVER' }
  /** Her voice for one line. Fire and forget: the card never waits on audio. */
  | { type: 'SPEAK'; text: string; grandma: 'mama' | 'nana' }
  | { type: 'PING' };

export type Reply<M extends Message> =
  M extends { type: 'CART_READ' } ? { ok: true } :
  M extends { type: 'GET_WEEK' } ? { ok: true; week: Week } | { ok: false } :
  M extends { type: 'JUDGE' } ? ({ ok: true; handled: HandledLists } & JudgeReply) | { ok: false } :
  M extends { type: 'MARK' } ? { ok: true } :
  M extends { type: 'BUY' } ? ({ ok: true } & BuyReply) | { ok: false } :
  M extends { type: 'CONFIRM' } ? { ok: true; posted: number } :
  M extends { type: 'START_OVER' } ? { ok: true } :
  M extends { type: 'SPEAK' } ? { ok: boolean } :
  M extends { type: 'ANSWER' } ? { ok: true } :
  M extends { type: 'PING' } ? { ok: true; at: number } :
  never;
