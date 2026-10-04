// Her card: one at a time, above the badge (design/screens/12 ask, 13 reaction). 360 wide, two buttons.
// role="dialog", focus moves in and back, buttons reachable by Tab, her line in aria-live polite.
// Text only through textContent; store names never touch innerHTML.

import type { Mood } from '@mama/shared/types';
import type { Grandma } from './badge';

export interface CardContent {
  grandma: Grandma;
  mood: Mood;
  /** Mint behind the ask, coral wash behind a reaction. */
  tone: 'ask' | 'alarm';
  line: string;
  sub: string;
  primary: string;
  secondary: string;
}

export type CardChoice = 'primary' | 'secondary' | 'dismiss';

const CSS = `
.card {
  position: fixed; right: 24px; bottom: 112px; z-index: 2147483647; width: 360px; box-sizing: border-box;
  display: flex; gap: 14px; padding: 16px; border-radius: 20px;
  background: #FBF7EF; color: #141016; box-shadow: 0 16px 48px rgba(20, 16, 22, 0.3);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45;
  animation: card-in 280ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
}
.card[hidden] { display: none; }
.card.out { animation: card-out 200ms cubic-bezier(0.3, 0, 0.8, 0.15) both; }
.tile {
  width: 96px; height: 110px; flex-shrink: 0; border-radius: 14px; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: center; background: #DDF1E8;
}
.card[data-tone="alarm"] .tile { background: #FFE2D6; }
.tile img { width: 100%; height: 100%; display: block; }
.body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.line { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.25; }
.sub { margin: 0; font-size: 13px; color: #5E566B; font-variant-numeric: tabular-nums; }
.actions { display: flex; gap: 8px; margin-top: 4px; }
.actions button {
  all: unset; box-sizing: border-box; flex: 1; min-height: 44px; padding: 10px 8px; border-radius: 10px;
  font: 600 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; cursor: pointer;
  transition: filter 150ms cubic-bezier(0.05, 0.7, 0.1, 1);
}
.actions button:hover { filter: brightness(0.94); }
.actions button:focus-visible { outline: 3px solid #22172A; outline-offset: 2px; }
.primary { background: #0F7B5A; color: #fff; }
.secondary { background: #EADFCB; color: #141016; }
@keyframes card-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes card-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .card, .card.out { animation: none; } .actions button { transition: none; } }
`;

export interface Card {
  /** Shows the card and resolves with what the person chose. Escape and the page losing her resolve as dismiss. */
  ask(c: CardContent): Promise<CardChoice>;
  close(): void;
  readonly open: boolean;
}

export function mountCard(root: ShadowRoot): Card {
  const style = document.createElement('style');
  style.textContent = CSS;

  const card = document.createElement('section');
  card.className = 'card';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'mama-line');

  const tile = document.createElement('div');
  tile.className = 'tile';
  const face = document.createElement('img');
  face.alt = '';
  tile.append(face);

  const body = document.createElement('div');
  body.className = 'body';
  const line = document.createElement('p');
  line.className = 'line';
  line.id = 'mama-line';
  line.setAttribute('aria-live', 'polite');
  const sub = document.createElement('p');
  sub.className = 'sub';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'primary';
  const secondary = document.createElement('button');
  secondary.type = 'button';
  secondary.className = 'secondary';
  actions.append(primary, secondary);
  body.append(line, sub, actions);
  card.append(tile, body);
  root.append(style, card);

  let settle: ((c: CardChoice) => void) | undefined;
  let returnFocus: Element | null = null;

  const finish = (choice: CardChoice) => {
    if (!settle) return;
    const done = settle;
    settle = undefined;
    card.classList.add('out');
    const hide = () => { card.hidden = true; card.classList.remove('out'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
    else card.addEventListener('animationend', hide, { once: true });
    if (returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
    done(choice);
  };

  primary.addEventListener('click', () => finish('primary'));
  secondary.addEventListener('click', () => finish('secondary'));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') finish('dismiss');
    e.stopPropagation();
  });

  return {
    get open() { return !!settle; },
    ask(c) {
      if (settle) finish('dismiss');
      face.src = browser.runtime.getURL(`/faces/${c.grandma}/${c.mood}.svg` as `/faces/mama/calm.svg`);
      card.dataset.tone = c.tone;
      line.textContent = c.line;
      sub.textContent = c.sub;
      primary.textContent = c.primary;
      secondary.textContent = c.secondary;
      card.classList.remove('out');
      card.hidden = false;
      returnFocus = document.activeElement;
      primary.focus({ preventScroll: true });
      return new Promise<CardChoice>((resolve) => { settle = resolve; });
    },
    close() { finish('dismiss'); },
  };
}
