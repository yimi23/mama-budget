// Her speech bubble, left of the badge (design/screens/11, 15). One line of her, one line of numbers, gone in a
// few seconds. For acknowledgements and nods; anything that needs an answer is a card.

const CSS = `
.bubble {
  position: fixed; right: 112px; bottom: calc(36px + var(--mb-lift, 0px)); z-index: 2147483647; max-width: 300px; box-sizing: border-box;
  padding: 12px 16px; border-radius: 16px 16px 4px 16px;
  background: #FBF7EF; color: #141016; box-shadow: 0 1px 6px rgba(34, 23, 42, 0.06), 0 2px 24px rgba(34, 23, 42, 0.14);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  animation: bubble-in 180ms cubic-bezier(0, 0, 0.2, 1) both;
}
.bubble[hidden] { display: none; }
.bubble.out { animation: bubble-out 120ms cubic-bezier(0.4, 0, 1, 1) both; }
.bubble .say { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; }
.bubble .num { margin: 4px 0 0; font-size: 13px; color: #5E566B; line-height: 1.4; font-variant-numeric: tabular-nums; }
.bubble .num:empty { display: none; }
@keyframes bubble-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bubble-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .bubble, .bubble.out { animation: none; } }
`;

const SHOW_MS = 4500;

export interface Bubble {
  say(line: string, sub?: string): void;
  hide(): void;
}

export function mountBubble(root: ShadowRoot): Bubble {
  const style = document.createElement('style');
  style.textContent = CSS;
  const el = document.createElement('div');
  el.className = 'bubble';
  el.hidden = true;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const say = document.createElement('p');
  say.className = 'say';
  const num = document.createElement('p');
  num.className = 'num';
  el.append(say, num);
  root.append(style, el);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    if (el.hidden) return;
    const done = () => { el.hidden = true; el.classList.remove('out'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else { el.classList.add('out'); el.addEventListener('animationend', done, { once: true }); }
  };

  return {
    say(line, sub = '') {
      clearTimeout(timer);
      el.classList.remove('out');
      say.textContent = line;
      num.textContent = sub;
      el.hidden = false;
      timer = setTimeout(hide, SHOW_MS);
    },
    hide,
  };
}
