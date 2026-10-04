// The home panel on a store page: tap the badge. Kept this week as the hero, one status sentence, the week's
// meter, the last three things she said (docs/PLAN.md "home panel", DESIGN.md: inset grouped list, tabular digits,
// no charts). Opens where the card opens; the badge or Escape closes it. Text only through textContent.

import type { Week } from '@mama/shared/types';
import { meterColor } from './badge.ts';

export interface PanelState {
  week: Week;
  said: string[];
}

const CSS = `
.panel {
  position: fixed; right: 24px; bottom: 112px; z-index: 2147483647; width: 360px; box-sizing: border-box;
  padding: 20px; border-radius: 20px; background: #FBF7EF; color: #22172A; box-shadow: 0 16px 48px rgba(20, 16, 22, 0.3);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45;
  font-variant-numeric: tabular-nums; animation: panel-in 280ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
}
.panel[hidden] { display: none; }
.panel.out { animation: panel-out 200ms cubic-bezier(0.3, 0, 0.8, 0.15) both; }
.kicker { margin: 0; font-size: 13px; color: #5E566B; }
.hero { margin: 2px 0 0; font-size: 40px; font-weight: 800; line-height: 1.1; letter-spacing: -0.01em; }
.status { margin: 6px 0 0; font-size: 14px; color: #22172A; }
.bar { margin: 16px 0 6px; height: 6px; border-radius: 3px; background: rgba(20, 16, 22, 0.12); overflow: hidden; }
.bar > div { height: 100%; border-radius: 3px; transition: width 600ms cubic-bezier(0.05, 0.7, 0.1, 1); }
.barlabel { margin: 0; font-size: 13px; color: #5E566B; }
.said { margin: 16px 0 0; padding: 0; list-style: none; border: 1px solid #EADFCB; border-radius: 12px; overflow: hidden; }
.said li { padding: 10px 14px; font-size: 14px; }
.said li + li { border-top: 1px solid #EADFCB; }
.said li.none { color: #5E566B; }
.close {
  all: unset; position: absolute; top: 14px; right: 16px; width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: #5E566B; font-size: 20px; line-height: 1;
}
.close:hover { background: rgba(20, 16, 22, 0.06); }
.close:focus-visible { outline: 3px solid #22172A; outline-offset: 2px; }
@keyframes panel-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes panel-out { from { opacity: 1; } to { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .panel, .panel.out { animation: none; } .bar > div { transition: none; } }
`;

/** One sentence that says something: "$25 left. 2 days. Rent in 4 days." (DESIGN.md: never "processing"). */
export function statusLine(week: Week): string {
  const days = week.daysLeft === 1 ? '1 day' : `${week.daysLeft} days`;
  const bill = week.bills?.[0];
  const billPart = bill ? ` ${bill.nickname || bill.payee} in ${bill.daysUntil === 1 ? '1 day' : `${bill.daysUntil} days`}.` : '';
  return `$${Math.round(week.left)} left. ${days}.${billPart}`;
}

export interface Panel {
  toggle(s: PanelState): void;
  close(): void;
  readonly open: boolean;
}

export function mountPanel(root: ShadowRoot): Panel {
  const style = document.createElement('style');
  style.textContent = CSS;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Mama Budget, this week');

  const kicker = document.createElement('p'); kicker.className = 'kicker'; kicker.textContent = 'Kept this week';
  const hero = document.createElement('p'); hero.className = 'hero';
  const status = document.createElement('p'); status.className = 'status';
  const bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div'); bar.append(fill);
  const barlabel = document.createElement('p'); barlabel.className = 'barlabel';
  const said = document.createElement('ul'); said.className = 'said'; said.setAttribute('aria-label', 'The last things she said');
  const close = document.createElement('button'); close.className = 'close'; close.type = 'button';
  close.setAttribute('aria-label', 'Close'); close.textContent = '×';
  panel.append(close, kicker, hero, status, bar, barlabel, said);
  root.append(style, panel);

  let isOpen = false;
  let returnFocus: Element | null = null;

  const hide = () => {
    if (!isOpen) return;
    isOpen = false;
    const done = () => { panel.hidden = true; panel.classList.remove('out'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else { panel.classList.add('out'); panel.addEventListener('animationend', done, { once: true }); }
    if (returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
  };

  close.addEventListener('click', hide);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); e.stopPropagation(); });

  return {
    get open() { return isOpen; },
    close: hide,
    toggle(s) {
      if (isOpen) return hide();
      const { week } = s;
      hero.textContent = `$${Math.round(week.kept)}`;
      status.textContent = statusLine(week);
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, week.ratio)) * 100)}%`;
      fill.style.backgroundColor = meterColor(week.ratio);
      barlabel.textContent = `$${Math.round(week.spent)} of $${Math.round(week.budget)} fun money this week`;
      said.replaceChildren();
      if (s.said.length === 0) {
        const li = document.createElement('li'); li.className = 'none'; li.textContent = 'She has not said anything yet.'; said.append(li);
      }
      for (const line of s.said.slice(0, 3)) { const li = document.createElement('li'); li.textContent = line; said.append(li); }
      panel.classList.remove('out');
      panel.hidden = false;
      isOpen = true;
      returnFocus = document.activeElement;
      close.focus({ preventScroll: true });
    },
  };
}
