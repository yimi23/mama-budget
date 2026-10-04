// Service worker. Stateless: everything lives in chrome.storage. Every listener is top level and synchronous.

import type { HandledLists, Message } from '@mama/shared/messages';
import type { Answer, BuyReply, CartItem, CartRead, CurrencyCode, JudgeReply, Month, Week } from '@mama/shared/types';
import { API, apiUp, call } from '../lib/api';
import { weekKey } from '@mama/shared/week';
import { quietHours } from '../lib/quiet';

const LAST_CART_TTL_MS = 30 * 60 * 1000;

async function rememberCart(msg: Extract<Message, { type: 'CART_READ' }>) {
  // Kept per store for 30 minutes so a confirmation page on another origin can match it.
  const { lastCart = {} } = await browser.storage.session.get('lastCart');
  const now = Date.now();
  const fresh = Object.fromEntries(
    Object.entries(lastCart as Record<string, { at: number }>).filter(([, v]) => now - v.at < LAST_CART_TTL_MS),
  );
  fresh[msg.store] = { at: now, url: msg.url, read: msg.read } as never;
  await browser.storage.session.set({ lastCart: fresh });
}

async function getWeek() {
  if (!(await apiUp())) return { ok: false as const };
  const week = await call<Week>('/week');
  return week ? { ok: true as const, week } : { ok: false as const };
}

async function judgeCart(store: string, currency: CurrencyCode, items: CartItem[]) {
  if (!(await apiUp())) return { ok: false as const };
  const { memory = {}, settings = {} } = await browser.storage.local.get(['memory', 'settings']);
  const reply = await call<JudgeReply>('/v2/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.map((i) => ({ ...i, store })), memory, currency, grandma: (settings as { grandma?: string }).grandma ?? 'mama' }),
  });
  return reply ? { ok: true as const, ...reply, handled: await handledLists() } : { ok: false as const };
}

// Asks: no repeats and at most three per browser session (storage.session).
// Reactions: once per item per envelope week, durable (storage.local), so an extension reload or a Chrome restart
// never makes her scold the same admitted want twice. The reaction belongs to the moment of admission; for the rest
// of the week a remembered want shows only on her face and the meter. Next week it is fair game again.
async function handledLists(): Promise<HandledLists> {
  const [{ asked = [] }, { reacted = {} }] = await Promise.all([
    browser.storage.session.get('asked'),
    browser.storage.local.get('reacted'),
  ]);
  const week = weekKey();
  const thisWeek = Object.entries(reacted as Record<string, string>).filter(([, w]) => w === week).map(([k]) => k);
  return { asked: asked as string[], reacted: thisWeek };
}

async function mark(kind: keyof HandledLists, key: string) {
  if (kind === 'asked') {
    const { asked = [] } = await browser.storage.session.get('asked');
    if (!(asked as string[]).includes(key)) await browser.storage.session.set({ asked: [...(asked as string[]), key] });
    return;
  }
  const { reacted = {} } = await browser.storage.local.get('reacted');
  // Only this week's entries are kept, so the record never grows past one week of items.
  const week = weekKey();
  const kept = Object.fromEntries(Object.entries(reacted as Record<string, string>).filter(([, w]) => w === week));
  await browser.storage.local.set({ reacted: { ...kept, [key]: week } });
}

// Charges posted this envelope week, by item name, so Buy anyway on the card and a later confirmation page for the
// same order never both post the same item. The API is idempotent per requestId; this guards across requestIds.
const postedKey = (name: string) => name.trim().toLowerCase();

async function postedThisWeek(): Promise<Set<string>> {
  const { posted = {} } = await browser.storage.local.get('posted');
  const week = weekKey();
  return new Set(Object.entries(posted as Record<string, string>).filter(([, w]) => w === week).map(([k]) => k));
}

async function markPosted(name: string) {
  const { posted = {} } = await browser.storage.local.get('posted');
  const week = weekKey();
  const kept = Object.fromEntries(Object.entries(posted as Record<string, string>).filter(([, w]) => w === week));
  await browser.storage.local.set({ posted: { ...kept, [postedKey(name)]: week } });
}

async function grandmaSetting(): Promise<string> {
  const { settings = {} } = await browser.storage.local.get('settings');
  return (settings as { grandma?: string }).grandma ?? 'mama';
}

async function buyItem(msg: Extract<Message, { type: 'BUY' }>) {
  if (!(await apiUp())) return { ok: false as const };
  const reply = await call<BuyReply>('/v2/buy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...msg.item, store: msg.store, currency: msg.currency, tag: 'want', grandma: await grandmaSetting(),
      // One charge per item per week from the card, however many times the card is answered.
      requestId: `card:${weekKey()}:${postedKey(msg.item.name)}`,
    }),
  });
  if (!reply) return { ok: false as const };
  await markPosted(msg.item.name);
  return { ok: true as const, ...reply };
}

/** A real order went through: charge what was in that store's cart, skipping anything the card already posted. */
async function confirmOrder(msg: Extract<Message, { type: 'CONFIRM' }>) {
  const { lastCart = {} } = await browser.storage.session.get('lastCart');
  const entry = (lastCart as Record<string, { read: CartRead }>)[msg.store];
  if (!entry || !(await apiUp())) return { ok: true as const, posted: 0 };
  const [posted, { memory = {} }, grandma] = await Promise.all([postedThisWeek(), browser.storage.local.get('memory'), grandmaSetting()]);
  let n = 0;
  for (const item of entry.read.items) {
    if (posted.has(postedKey(item.name))) continue;
    const reply = await call<BuyReply>('/v2/buy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: item.name, price: item.unitPrice * item.qty, store: msg.store, currency: entry.read.currency, memory, grandma,
        requestId: `order:${msg.orderId}:${postedKey(item.name)}`,
      }),
    });
    if (reply) { n++; await markPosted(item.name); }
  }
  return { ok: true as const, posted: n };
}

// Loudness tiers scale her volume (ONBOARDING.md): Gentle Auntie 0.6, Mama 0.8, Full Nigerian Mother 1.0.
export function volumeFor(loudness: unknown): number {
  return loudness === 'gentle' ? 0.6 : loudness === 'full' ? 1 : 0.8;
}

const OFFSCREEN_URL = 'offscreen.html';

async function offscreenReady(): Promise<boolean> {
  try {
    const contexts = await browser.runtime.getContexts({ contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT] });
    if (contexts.length) return true;
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [browser.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Plays her spoken line when a purchase blows the weekly envelope.',
    });
    return true;
  } catch {
    return false;
  }
}

function toDataUrl(buf: ArrayBuffer): string {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/mpeg;base64,${btoa(bin)}`;
}

const silent = { ok: false, duration: null };

/** Fetches her line as mp3 from /tts and plays it in the offscreen document. Silent on any failure, and in quiet hours. */
async function speak(msg: Extract<Message, { type: 'SPEAK' }>): Promise<{ ok: boolean; duration: number | null }> {
  const { settings = {} } = await browser.storage.local.get('settings');
  const st = settings as { sounds?: boolean; loudness?: string; quietHours?: boolean }; // quiet hours are opt in for the hackathon (Praise, Oct 4): she speaks at any hour unless settings.quietHours is true
  if (st.sounds === false || (st.quietHours === true && quietHours())) return silent;
  if (!(await apiUp())) return silent;
  try {
    const res = await fetch(`${API}/tts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: msg.text, grandma: msg.grandma }), signal: AbortSignal.timeout(8000),
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio/')) return silent;
    const dataUrl = toDataUrl(await res.arrayBuffer());
    if (!(await offscreenReady())) return silent;
    const reply = (await browser.runtime.sendMessage({ type: 'PLAY', dataUrl, volume: volumeFor(st.loudness) })) as { ok?: boolean; duration?: number | null } | undefined;
    return { ok: !!reply?.ok, duration: reply?.duration ?? null };
  } catch {
    return silent;
  }
}

/** Onboarding 05: ask the API to generate (and cache) these lines now, so screen 06 speaks the moment it opens. */
async function warm(msg: Extract<Message, { type: 'WARM' }>): Promise<{ ok: true }> {
  if (!(await apiUp())) return { ok: true };
  await Promise.all(msg.texts.filter(Boolean).map((text) =>
    fetch(`${API}/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, grandma: msg.grandma }), signal: AbortSignal.timeout(12000) }).catch(() => null),
  ));
  return { ok: true };
}

/** One of the six cue sounds, from the offscreen document. Honours the sounds toggle and quiet hours. */
async function cue(msg: Extract<Message, { type: 'CUE' }>): Promise<{ ok: boolean }> {
  const { settings = {} } = await browser.storage.local.get('settings');
  const st = settings as { sounds?: boolean; loudness?: string; quietHours?: boolean }; // quiet hours are opt in for the hackathon (Praise, Oct 4): she speaks at any hour unless settings.quietHours is true
  if (st.sounds === false || (st.quietHours === true && quietHours())) return { ok: false };
  if (!(await offscreenReady())) return { ok: false };
  try {
    const reply = (await browser.runtime.sendMessage({ type: 'PLAY_CUE', cue: msg.cue, volume: volumeFor(st.loudness) })) as { ok?: boolean } | undefined;
    return { ok: !!reply?.ok };
  } catch {
    return { ok: false };
  }
}

/** Onboarding 05: the 30 day read, in the chosen grandma's words. */
async function month(msg: Extract<Message, { type: 'MONTH' }>) {
  if (!(await apiUp())) return { ok: false as const };
  const m = await call<Month>(`/month?grandma=${msg.grandma}`);
  return m ? { ok: true as const, month: m } : { ok: false as const };
}

/** Onboarding 07: the first statement, now. The API answers ok only when a sender accepted the text. */
async function textNow(msg: Extract<Message, { type: 'TEXT_NOW' }>) {
  const off = { ok: false, texted: false, text: null, reason: 'The API is not answering' };
  if (!(await apiUp())) return off;
  const q = new URLSearchParams({ now: '1', grandma: msg.grandma });
  if (msg.to) q.set('to', msg.to);
  const r = await call<{ ok: boolean; texted: boolean; text: string; reason?: string }>(`/schedule?${q}`);
  if (!r) return off;
  return { ok: !!r.ok, texted: !!r.texted, text: r.text ?? null, reason: r.ok ? null : (r.reason ?? 'Texts are off right now') };
}

/** Is the API up, can she text, can she speak. Drives disabled states so nothing is ever shown as done that was not. */
async function health() {
  const api = await apiUp();
  if (!api) return { api, texts: false, voice: false };
  const [photon, voice] = await Promise.all([
    call<{ sender: string }>('/photon/health'),
    fetch(`${API}/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Rice is at home.', grandma: 'mama' }), signal: AbortSignal.timeout(8000) })
      .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')).catch(() => false),
  ]);
  return { api, texts: !!photon && photon.sender !== 'log', voice };
}

async function setEnvelope(msg: Extract<Message, { type: 'SET_ENVELOPE' }>) {
  if (!(await apiUp())) return { ok: false as const };
  const r = await call<{ ok: boolean; envelope: number }>('/envelope', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount: msg.amount }) });
  return r ? { ok: true as const, envelope: r.envelope } : { ok: false as const };
}

/** The popup's Start over: she forgets every answer and asks again, as on a fresh install. */
async function startOver() {
  await browser.storage.local.remove(['memory', 'reacted', 'posted', 'said']);
  await browser.storage.session.remove('asked');
}

/** Her memory of your answers. Durable, keyed by the rules' own item key, shared across every store. */
async function remember(key: string, answer: Answer) {
  const { memory = {} } = await browser.storage.local.get('memory');
  await browser.storage.local.set({ memory: { ...(memory as Record<string, Answer>), [key]: answer } });
}

export default defineBackground(() => {
  // First run: onboarding opens itself in a tab until it has been finished once. She never defaults a grandma.
  browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.get('settings').then(({ settings = {} }) => {
      if (!(settings as { onboarded?: boolean }).onboarded) browser.tabs.create({ url: browser.runtime.getURL('/popup.html') }).catch(() => {});
    }).catch(() => {});
  });

  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      default:
        return false; // PLAY and anything else is not for the worker
      case 'PING':
        sendResponse({ ok: true, at: Date.now() });
        return false;
      case 'CART_READ':
        rememberCart(msg).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'GET_WEEK':
        getWeek().then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'JUDGE':
        judgeCart(msg.store, msg.currency, msg.items).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'MARK':
        mark(msg.kind, msg.key).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'BUY':
        buyItem(msg).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'CONFIRM':
        confirmOrder(msg).then(sendResponse, () => sendResponse({ ok: true, posted: 0 }));
        return true;
      case 'SPEAK':
        speak(msg).then(sendResponse, () => sendResponse(silent));
        return true;
      case 'WARM':
        warm(msg).then(sendResponse, () => sendResponse({ ok: true }));
        return true;
      case 'CUE':
        cue(msg).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'MONTH':
        month(msg).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'TEXT_NOW':
        textNow(msg).then(sendResponse, () => sendResponse({ ok: false, texted: false, text: null, reason: 'The API is not answering' }));
        return true;
      case 'HEALTH':
        health().then(sendResponse, () => sendResponse({ api: false, texts: false, voice: false }));
        return true;
      case 'SET_ENVELOPE':
        setEnvelope(msg).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
      case 'START_OVER':
        startOver().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
      case 'ANSWER':
        remember(msg.key, msg.answer).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: true }));
        return true;
    }
  });
});
