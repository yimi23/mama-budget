// Every message between content script, popup and worker. Add the case here before writing the handler.

import type { Answer, CartItem, CartRead, JudgeReply, Week } from './types.ts';

/** What she already asked about or reacted to this browser session, across every tab and reload. */
export interface HandledLists {
  asked: string[];
  reacted: string[];
}

export type Message =
  | { type: 'CART_READ'; store: string; url: string; read: CartRead }
  | { type: 'GET_WEEK' }
  | { type: 'JUDGE'; store: string; items: CartItem[] }
  | { type: 'ANSWER'; key: string; answer: Answer }
  | { type: 'MARK'; kind: 'asked' | 'reacted'; key: string }
  | { type: 'START_OVER' }
  | { type: 'PING' };

export type Reply<M extends Message> =
  M extends { type: 'CART_READ' } ? { ok: true } :
  M extends { type: 'GET_WEEK' } ? { ok: true; week: Week } | { ok: false } :
  M extends { type: 'JUDGE' } ? ({ ok: true; handled: HandledLists } & JudgeReply) | { ok: false } :
  M extends { type: 'MARK' } ? { ok: true } :
  M extends { type: 'START_OVER' } ? { ok: true } :
  M extends { type: 'ANSWER' } ? { ok: true } :
  M extends { type: 'PING' } ? { ok: true; at: number } :
  never;
