// Every message between content script, popup and worker. Add the case here before writing the handler.

import type { CartRead } from './types.ts';

export type Message =
  | { type: 'CART_READ'; store: string; url: string; read: CartRead }
  | { type: 'PING' };

export type Reply<M extends Message> =
  M extends { type: 'CART_READ' } ? { ok: true } :
  M extends { type: 'PING' } ? { ok: true; at: number } :
  never;
