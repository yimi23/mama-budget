// The badge: her face in a 64px gold ring, the gele meter as a 6px bar to its left (design/screens/10, 11).
// One host element on documentElement, open shadow root, all: initial. Never touches the page's own DOM.
// Built with createElement only; no page data ever goes through innerHTML.

import type { Mood } from '@mama/shared/types';

export type Grandma = 'mama' | 'nana';

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
:host { all: initial; }
.wrap {
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
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
  transition: height 600ms cubic-bezier(0.05, 0.7, 0.1, 1), background-color 600ms cubic-bezier(0.05, 0.7, 0.1, 1);
}
.badge {
  all: unset; box-sizing: border-box; cursor: pointer;
  width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${GOLD};
  background: #FBF7EF; overflow: hidden; box-shadow: 0 8px 24px rgba(20, 16, 22, 0.25);
  display: flex; align-items: flex-end; justify-content: center;
  transition: transform 150ms cubic-bezier(0.05, 0.7, 0.1, 1);
}
.badge:hover { transform: scale(1.04); }
.badge:focus-visible { outline: 3px solid #22172A; outline-offset: 3px; }
.face { width: 100%; height: 100%; display: block; pointer-events: none; }
.badge.shake { animation: shake 300ms cubic-bezier(0.3, 0, 0.8, 0.15); }
@keyframes shake { 0%, 100% { transform: none; } 20% { transform: rotate(-8deg); } 40% { transform: rotate(7deg); } 60% { transform: rotate(-5deg); } 80% { transform: rotate(3deg); } }
@keyframes enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .wrap { animation: none; }
  .fill, .badge { transition: none; }
  .badge.shake { animation: none; }
}
`;

export function meterColor(ratio: number): string {
  if (ratio >= 1) return CORAL;
  if (ratio >= 0.75) return GOLD;
  return GREEN;
}

/** Fill height in px. Never empty, so the bar always reads as a meter. */
export function meterHeight(ratio: number): number {
  return Math.round(Math.max(0.08, Math.min(1, ratio)) * METER_PX);
}

export function describe(s: BadgeState): string {
  const days = s.daysLeft === 1 ? '1 day' : `${s.daysLeft} days`;
  return `Mama Budget. $${Math.round(s.left)} left this week, ${days} to go.`;
}

export interface Badge {
  /** The shared shadow root, so the card lives in the same single host. */
  root: ShadowRoot;
  update(s: BadgeState): void;
  /** Mood change only: 300ms, skipped under reduced motion. */
  shake(): void;
  hide(): void;
  destroy(): void;
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

  let faceKey = '';
  return {
    root,
    shake() {
      badge.classList.remove('shake');
      void badge.offsetWidth; // restart the animation
      badge.classList.add('shake');
    },
    update(s) {
      const key = `${s.grandma}/${s.mood}`;
      if (key !== faceKey) {
        faceKey = key;
        face.src = browser.runtime.getURL(`/faces/${key}.svg` as `/faces/mama/calm.svg`);
      }
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
