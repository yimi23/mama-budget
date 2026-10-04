// The worker's door to our API. Retries once; after two failed calls in a row the badge hides until /health answers.
// The failure count lives in storage.session because worker globals die after 30 seconds.

export const API = 'http://localhost:8787';
const TIMEOUT_MS = 4000;

async function once(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function fails(): Promise<number> {
  const { apiFails = 0 } = await browser.storage.session.get('apiFails');
  return apiFails as number;
}

/** Returns the parsed body, or null once the API has failed twice in a row. Never throws. */
export async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = (await once(path, init)) as T;
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
