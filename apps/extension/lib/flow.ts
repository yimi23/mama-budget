// What she says next, decided from the judge's verdicts. Pure, so tests run it in plain node.
// One card at a time. A remembered want she may react to comes first; then a new item she asks about.
// At most one reaction per item and three asks per session; everything else stays quiet.

import type { Verdict, Week } from '@mama/shared/types';

export const MAX_ASKS = 3;

export interface Handled {
  asked: Set<string>;
  reacted: Set<string>;
}

export type Next = { kind: 'react' | 'ask'; verdict: Verdict } | null;

export function nextCard(verdicts: Verdict[], h: Handled): Next {
  const react = verdicts.find((v) => v.react && !h.reacted.has(v.key));
  if (react) return { kind: 'react', verdict: react };
  if (h.asked.size >= MAX_ASKS) return null;
  const ask = verdicts.find((v) => v.label === 'ask' && !h.asked.has(v.key));
  return ask ? { kind: 'ask', verdict: ask } : null;
}

/** "I just want them" for AirPods, "I just want it" for a camera. */
export function wantLabel(short: string): string {
  return /s$/i.test(short.trim()) ? 'I just want them' : 'I just want it';
}

/** The numbers under her acknowledgement: what the answer did to the meter. Null when there is nothing to say. */
export function ackSub(v: Verdict, week: Week): string | null {
  const price = Math.round(v.price);
  if (v.label === 'need' && v.tags.includes('remembered')) return `$${price}. Needs stay off the meter.`;
  if (v.label === 'want' && v.tags.includes('fits')) return `$${price} against $${Math.round(week.left)} left this week. It fits.`;
  return null;
}
