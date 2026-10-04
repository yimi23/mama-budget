// The badge: her face in a 64px gold ring, the gele meter as a 6px bar to its left (design/screens/10, 11).
// One host element on documentElement, open shadow root, all: initial. Never touches the page's own DOM.
// Built with createElement only; no page data ever goes through innerHTML.

import type { Mood } from '@mama/shared/types';

export type Grandma = 'mama' | 'nana' | 'abuela' | 'wong';
export const GRANDMAS: readonly Grandma[] = ['mama', 'nana', 'abuela', 'wong'];
export const GRANDMA_NAME: Record<Grandma, string> = { mama: 'Mama', nana: 'Nana', abuela: 'Abuela', wong: 'Grandma Wong' };

export interface BadgeState {
  grandma: Grandma;
  mood: Mood;
  /** Share of this week's envelope spent on wants, 0 to 1+. */
  ratio: number;
  left: number;
  daysLeft: number;
}

const GREEN = '#0F7B5A';
const GOLD = '#E2A12A';
const CORAL = '#D4462C';
const METER_PX = 52;

const CSS = `
:host { all: initial; color-scheme: light; }
.wrap {
  position: fixed; right: 24px; bottom: calc(24px + var(--mb-lift, 0px)); z-index: 2147483647;
  display: flex; align-items: flex-end; gap: 8px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 16px;
  animation: enter 300ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
}
.wrap[hidden] { display: none; }
.meter {
  width: 6px; height: ${METER_PX}px; border-radius: 3px; overflow: hidden;
  background: rgba(20, 16, 22, 0.12); display: flex; align-items: flex-end;
}
.fill {
  width: 6px; border-radius: 3px;
  transition: height 400ms cubic-bezier(0, 0, 0.2, 1), background-color 400ms cubic-bezier(0, 0, 0.2, 1);
}
.badge {
  all: unset; box-sizing: border-box; cursor: pointer;
  width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${GOLD};
  background: #FBF7EF; overflow: hidden; box-shadow: 0 1px 6px rgba(34, 23, 42, 0.08), 0 2px 24px rgba(34, 23, 42, 0.18);
  display: flex; align-items: flex-end; justify-content: center;
  transition: filter 150ms cubic-bezier(0.05, 0.7, 0.1, 1);
}
.badge:hover { filter: brightness(1.04); transform: scale(1.04); }
.badge { transition: filter 150ms cubic-bezier(0, 0, 0.2, 1), transform 150ms cubic-bezier(0, 0, 0.2, 1); }
/* She breathes while watching: 2px over 4s. Still when calm. Mood change and user action are the only motion. */
.badge[data-mood="watching"] { animation: breathe 4s ease-in-out infinite; }
.badge:focus-visible { outline: 3px solid #22172A; outline-offset: 3px; }
.face { width: 100%; height: 100%; display: block; pointer-events: none; }
.badge.shake { animation: shake 300ms cubic-bezier(0.3, 0, 0.8, 0.15); }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes shake { 0%, 100% { transform: none; } 20% { transform: rotate(-8deg); } 40% { transform: rotate(7deg); } 60% { transform: rotate(-5deg); } 80% { transform: rotate(3deg); } }
@keyframes enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .wrap { animation: none; }
  .fill, .badge { transition: none; }
  .badge.shake, .badge[data-mood="watching"] { animation: none; }
}
`;

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export function meterColor(ratio: number): string {
  ratio = finite(ratio);
  if (ratio >= 1) return CORAL;
  if (ratio >= 0.75) return GOLD;
  return GREEN;
}

/** Fill height in px. Never empty, so the bar always reads as a meter. */
export function meterHeight(ratio: number): number {
  return Math.round(Math.max(0.08, Math.min(1, finite(ratio))) * METER_PX);
}

export function describe(s: BadgeState): string {
  const daysLeft = finite(s.daysLeft);
  const days = daysLeft === 1 ? '1 day' : `${daysLeft} days`;
  return `Mama Budget. $${Math.round(finite(s.left))} left this week, ${days} to go.`;
}

export interface Badge {
  /** The shared shadow root, so the card lives in the same single host. */
  root: ShadowRoot;
  update(s: BadgeState): void;
  /** Mood change only: 300ms, skipped under reduced motion. */
  shake(): void;
  /** Tap on her face. */
  onClick(cb: () => void): void;
  hide(): void;
  destroy(): void;
}

/**
 * Stores pin a checkout bar to the bottom of the viewport (Shopify on phones, Walmart, many themes). She steps up above
 * it instead of sitting on the Pay button: the tallest fixed or sticky element touching the bottom edge, up to 200px,
 * becomes --mb-lift on the host, and the badge, card, bubble and panel all read it. Cheap, defensive, at most every 2s.
 */
let lastLiftAt = 0;
function liftAboveStickyBars(host: HTMLElement) {
  const now = Date.now();
  if (now - lastLiftAt < 2000) return;
  lastLiftAt = now;
  try {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let lift = 0;
    const seen = new Set<Element>();
    const candidates: Element[] = [...document.body.children, ...document.querySelectorAll('footer, [class*="sticky"], [class*="fixed"], [class*="bottom-bar"], [class*="checkout-bar"], [data-testid*="sticky"]')];
    for (const el of candidates) {
      if (seen.has(el) || el === host || seen.size > 400) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.height < 40 || r.height > 200 || r.width < vw * 0.5) continue;
      if (r.bottom < vh - 4 || r.top > vh - 20) continue;
      lift = Math.max(lift, Math.round(vh - r.top) + 16);
    }
    host.style.setProperty('--mb-lift', `${lift}px`);
  } catch {
    /* a page that throws on inspection keeps her at the default corner */
  }
}

export function mountBadge(): Badge {
  const host = document.createElement('mama-budget');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; right: 0; bottom: 0; width: 0; height: 0;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = CSS;

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.hidden = true;

  const meter = document.createElement('div');
  meter.className = 'meter';
  meter.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'fill';
  meter.append(fill);

  const badge = document.createElement('button');
  badge.className = 'badge';
  badge.type = 'button';
  const face = document.createElement('img');
  face.className = 'face';
  face.alt = '';
  badge.append(face);

  wrap.append(meter, badge);
  root.append(style, wrap);

  // Keys and scrolls inside her never reach the store's own handlers.
  for (const type of ['keydown', 'keyup', 'keypress', 'wheel']) {
    wrap.addEventListener(type, (e) => e.stopPropagation());
  }

  document.documentElement.append(host);
  liftAboveStickyBars(host);

  let faceKey = '';
  return {
    root,
    onClick(cb) { badge.addEventListener('click', cb); },
    shake() {
      badge.classList.remove('shake');
      void badge.offsetWidth; // restart the animation
      badge.classList.add('shake');
    },
    update(s) {
      liftAboveStickyBars(host);
      const key = `${s.grandma}/${s.mood}`;
      if (key !== faceKey) {
        faceKey = key;
        face.src = browser.runtime.getURL(`/faces/${key}.svg` as `/faces/mama/calm.svg`);
      }
      badge.dataset.mood = s.mood;
      fill.style.height = `${meterHeight(s.ratio)}px`;
      fill.style.backgroundColor = meterColor(s.ratio);
      badge.setAttribute('aria-label', describe(s));
      wrap.hidden = false;
    },
    hide() {
      wrap.hidden = true;
    },
    destroy() {
      host.remove();
    },
  };
}
