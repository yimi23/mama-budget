// The onboarding flow, pure: the order of the screens, where a skip lands, the dots, the copy per grandma, the
// loudness tiers, and the small formatters the popup needs. docs/ONBOARDING.md is the script this follows.
// Nothing here touches the DOM or storage, so tests run it in plain node.

import type { Grandma } from './ui/badge';

export type Step = 'welcome' | 'grandma' | 'bank' | 'reading' | 'saw' | 'watch' | 'phone' | 'check' | 'loud' | 'go';
export type Loudness = 'gentle' | 'mama' | 'full';

export const ORDER: readonly Step[] = ['welcome', 'grandma', 'bank', 'reading', 'saw', 'watch', 'phone', 'check', 'loud', 'go'];
/** The dots at the top, from screen 03 on. "Check your phone" shares the phone dot (design 07 and 07b). */
export const DOTS: readonly Step[] = ['grandma', 'bank', 'reading', 'saw', 'watch', 'phone', 'loud', 'go'];

export function dotIndex(step: Step): number {
  return DOTS.indexOf(step === 'check' ? 'phone' : step);
}

export interface Progress {
  /** The bank was connected, so she read the month (screens 05, 06, 06b). */
  bank: boolean;
  /** The first statement actually went to the phone (screen 07b). */
  texted: boolean;
  /** There is a month to speak of. Without one, 06 and 06b are skipped even when the bank connected. */
  hasMonth?: boolean;
}

/** The screen after this one. Skipping the bank jumps to the phone; no text means no "Check your phone". */
export function next(step: Step, p: Progress): Step | 'done' {
  switch (step) {
    case 'welcome': return 'grandma';
    case 'grandma': return 'bank';
    case 'bank': return p.bank ? 'reading' : 'phone';
    case 'reading': return p.hasMonth === false ? 'phone' : 'saw';
    case 'saw': return 'watch';
    case 'watch': return 'phone';
    case 'phone': return p.texted ? 'check' : 'loud';
    case 'check': return 'loud';
    case 'loud': return 'go';
    case 'go': return 'done';
  }
}

/** Where "Not now" lands. Only the bank and the phone can be skipped; everything else has no skip (ONBOARDING.md). */
export function skip(step: Step): Step | null {
  if (step === 'bank') return 'phone';
  if (step === 'phone') return 'loud';
  return null;
}

export interface Tier { key: Loudness; name: string; desc: string; line: string }

/** How loud. The dial changes her mouth, never her math. Same three keys for both grandmas. */
export const TIERS: Record<Grandma, readonly Tier[]> = {
  mama: [
    { key: 'gentle', name: 'Gentle Auntie', desc: 'Text only. Speaks up on the big ones.', line: 'Okay.' },
    { key: 'mama', name: 'Mama', desc: 'Her voice on. Speaks up when it matters.', line: 'Okay. I’ll say something when it matters.' },
    { key: 'full', name: 'Full Nigerian Mother', desc: 'Everything. She texts your phone too.', line: 'Good. Now we’re talking.' },
  ],
  nana: [
    { key: 'gentle', name: 'Church Friend', desc: 'Text only. Speaks up on the big ones.', line: 'Alright.' },
    { key: 'mama', name: 'Nana', desc: 'Her voice on. Speaks up when it matters.', line: 'Alright then.' },
    { key: 'full', name: 'Nana Before Coffee', desc: 'Everything. She texts your phone too.', line: 'Finally.' },
  ],
};

export interface Copy {
  name: string;
  welcomeTitle: string;
  welcome: string;
  welcomeSub: string;
  /** "Hear her" on the pick screen. */
  preview: string;
  bank: string;
  reading: string;
  phone: string;
  /** Screen 09, with the kept amount already in words for her voice. */
  go(keptWords: string): string;
  goText(kept: number): string;
}

export const COPY: Record<Grandma, Copy> = {
  mama: {
    name: 'Mama',
    welcomeTitle: 'I’m Mama.',
    welcome: 'You set the fun money for the week. I hold you to it. I sit in your cart and I speak before you pay, not after. The things you need, I never touch.',
    welcomeSub: 'Two questions from you now. The rest I’ll see for myself.',
    preview: 'Rice is at home.',
    bank: 'I only read. The bank never hears from me.',
    reading: 'Give me a second.',
    phone: 'I text. A short one every Sunday at seven, and one when something big happens.',
    go: (k) => `${k} dollars kept this week. Let’s make it grow. Try me on a practice cart first.`,
    goText: (k) => `$${k} kept this week. Let’s make it grow.`,
  },
  nana: {
    name: 'Nana',
    welcomeTitle: 'I’m Nana.',
    welcome: 'You pick a number for the week. I keep you to it. I’m in your cart before you pay, not after. What you need is none of my business.',
    welcomeSub: 'Two questions from you now. The rest I’ll see for myself.',
    preview: 'Well. Let’s have a look.',
    bank: 'I just look. I don’t touch.',
    reading: 'Hang on a sec.',
    phone: 'I text. Sundays at seven, and when something’s up.',
    go: (k) => `${k} kept this week. Not bad. Try me first.`,
    goText: (k) => `$${k} kept this week. Not bad.`,
  },
};

/** The one line on screen 03 about the test. From docs/RESULTS.md, one rater so far. Update when raters 2 and 3 land. */
export const MOTHERS_LINE = 'Checked against a real mother, 50 purchases. She agreed with her 75% of the time. Your bank’s categories managed 70%.';

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Whole numbers in words, for her voice. Mirrors api/lines/onboarding.js. */
export function words(n: number): string {
  n = Math.round(Math.abs(n) || 0);
  if (n === 0) return 'zero';
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '');
  return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
}

/** Digits typed into the phone field, shown as "(989) 555 0142" while typing. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** A US number as E.164 for the API, or null until ten digits are there. */
export function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10})/, '');
  return d.length === 10 ? `+1${d}` : null;
}

/** "₦120,000" for Mama's envelope line. Nana gets no conversion. */
export function naira(usd: number, perUsd = 1600): string {
  return `₦${Math.round(usd * perUsd).toLocaleString('en-US')}`;
}

/** How long she will be speaking, when the player did not say: about 2.4 words a second plus a breath. */
export function speechSeconds(text: string): number {
  const n = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((n / 2.4 + 0.4) * 10) / 10);
}

/** Decelerating count from 0 to `to` over `ms`, sampled at `t` ms. Screen 09's kept number. */
export function countUp(to: number, ms: number, t: number): number {
  const x = Math.max(0, Math.min(1, ms ? t / ms : 1));
  const eased = 1 - Math.pow(1 - x, 3);
  return Math.round(to * eased);
}

/** The settings the onboarding writes. Everything she needs to run lives here (CLAUDE.md: state in chrome.storage). */
export type Home = 'NGN' | 'GHS' | 'KES' | 'INR' | 'PHP' | 'MXN' | 'none';
export const HOMES: readonly { code: Home; name: string }[] = [
  { code: 'NGN', name: 'Naira' }, { code: 'GHS', name: 'Cedi' }, { code: 'KES', name: 'Shilling' },
  { code: 'INR', name: 'Rupee' }, { code: 'PHP', name: 'Peso (PHP)' }, { code: 'MXN', name: 'Peso (MXN)' }, { code: 'none', name: 'None' },
];
/** Until chosen: naira with Mama, none with Nana. The grandma never decides it after that. */
export function homeFor(s: Settings): Home {
  return s.home ?? (s.grandma === 'nana' ? 'none' : 'NGN');
}

export interface Settings {
  grandma?: Grandma;
  /** Currency back home for her loud lines. */
  home?: Home;
  loudness?: Loudness;
  sounds?: boolean;
  phone?: string;
  envelope?: number;
  ignoredWatches?: string[];
  onboarded?: boolean;
}
