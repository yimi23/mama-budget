// The worker's door to our API. Retries once; after two failed calls in a row the badge hides until /health answers.
// The failure count lives in storage.session because worker globals die after 30 seconds.

export const DEFAULT_API = 'http://localhost:8787';
const TIMEOUT_MS = 4000;
const SLOW_TIMEOUT_MS = 20000;

/** Where the API lives. localhost by default; a teammate's laptop on the hotspot, or a hosted one, from settings.apiUrl. */
export async function apiBase(): Promise<string> {
  try {
    const { settings = {} } = await browser.storage.local.get('settings');
    const url = String((settings as { apiUrl?: string }).apiUrl || '').trim().replace(/\/+$/, '');
    return /^https?:\/\/[^\s/]+$/.test(url) ? url : DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
}

async function once(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const res = await fetch((await apiBase()) + path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function fails(): Promise<number> {
  const { apiFails = 0 } = await browser.storage.session.get('apiFails');
  return apiFails as number;
}

/**
 * Returns the parsed body, or null once the API has failed twice in a row. Never throws. `slow` is for the one call
 * that legitimately takes seconds (the bank reseed on /reset): a longer timeout and a single attempt, so a slow
 * answer is never counted as the API being down and never runs twice.
 */
export async function call<T>(path: string, init?: RequestInit, slow = false): Promise<T | null> {
  const attempts = slow ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const body = (await once(path, init, slow ? SLOW_TIMEOUT_MS : TIMEOUT_MS)) as T;
      await browser.storage.session.set({ apiFails: 0 });
      return body;
    } catch {
      await browser.storage.session.set({ apiFails: (await fails()) + 1 });
    }
  }
  return null;
}

/** True when the badge may show: the API is answering. */
export async function apiUp(): Promise<boolean> {
  if ((await fails()) < 2) return true;
  try {
    await once('/health');
    await browser.storage.session.set({ apiFails: 0 });
    return true;
  } catch {
    return false;
  }
}
