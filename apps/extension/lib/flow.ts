// What she says next, decided from the judge's verdicts. Pure, so tests run it in plain node.
// One card at a time. A remembered want she may react to comes first; then a new item she asks about.
// At most one reaction per item and three asks per session; everything else stays quiet.

import type { Verdict, Week } from '@mama/shared/types';
import { words } from './onboarding.ts';

export const MAX_ASKS = 3;

export interface Handled {
  asked: Set<string>;
  reacted: Set<string>;
}

export type Next =
  | { kind: 'react'; verdict: Verdict; also: Verdict[] }
  | { kind: 'ask'; verdict: Verdict }
  | { kind: 'askMany'; verdicts: Verdict[] }
  | null;

/**
 * What to show next. A reaction comes first, to the dearest want she may react to; any other reactable wants ride
 * along as `also` so she reacts once, not three times. Then the new items: one card when there is one, one card
 * listing them when there are several (up to what the session's ask budget allows).
 */
export function nextCard(verdicts: Verdict[], h: Handled): Next {
  const reacts = verdicts.filter((v) => v.react && !h.reacted.has(v.key)).sort((a, b) => b.price - a.price);
  if (reacts.length) return { kind: 'react', verdict: reacts[0]!, also: reacts.slice(1) };
  const room = MAX_ASKS - h.asked.size;
  if (room <= 0) return null;
  const asks = verdicts.filter((v) => v.label === 'ask' && !h.asked.has(v.key)).slice(0, room);
  if (!asks.length) return null;
  return asks.length === 1 ? { kind: 'ask', verdict: asks[0]! } : { kind: 'askMany', verdicts: asks };
}

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
/** "Two new things. What are they for?" from the writer's template. */
export function askManyLine(template: string, n: number): string {
  return template.replace('{n}', WORDS[n] ?? String(n));
}

/** "I just want them" for AirPods, "I just want it" for a camera. */
export function wantLabel(short: string): string {
  return /s$/i.test(short.trim()) ? 'I just want them' : 'I just want it';
}

/** The numbers under her acknowledgement: what the answer did to the meter. Null when there is nothing to say. */
export function ackSub(v: Verdict, week: Week): string | null {
  const price = Math.round(v.price);
  if (v.label === 'need' && v.tags.includes('remembered')) return `$${price}. Needs stay off the meter.`;
  if (v.label === 'want' && v.tags.includes('fits')) return `$${price} against $${Math.round(week.left)} left this week. It fits.${week.kept ? ` $${Math.round(week.kept)} kept so far.` : ''}`;
  return null;
}

/** The numbers under a kept moment: what stayed, what the week has kept, the jar when the bank keeps one. */
export function keptSub(price: number, week: Week): string {
  const kept = Math.round(week.kept || 0);
  const parts = [`$${Math.round(price)} stays in the week.`];
  if (kept > Math.round(price)) parts.push(`$${kept} kept this week.`);
  if (week.jar) parts.push(`Jar $${Math.round(week.jar)}.`);
  if (week.streak && week.streak >= 2) parts.push(`${week.streak} weeks in a row.`);
  return parts.join(' ');
}

/** Screen 11: the first time the week turns to watching on a page, she says so, once. Not on the way back down. */
export function crossedIntoWatching(prev: Week | undefined, next: Week): boolean {
  return next.mood === 'watching' && prev?.mood !== 'watching' && (prev == null || prev.ratio < next.ratio);
}

/** What she says out loud: numbers as words ("two hundred and fifty five", never "255"), commas and $ gone. */
export function spoken(text: string): string {
  return text
    .replace(/\$\s?(\d[\d,]*)(?:\.\d+)?/g, (_m, n: string) => `${words(Number(n.replace(/,/g, '')))} dollars`)
    .replace(/(\d[\d,]*)(?:\.\d+)?/g, (_m, n: string) => words(Number(n.replace(/,/g, ''))));
}
