// The row mark (design/screens/12 and 13): the offending cart row gets a coral bar on its left and a pale wash, the way
// a spell checker underlines the exact word. Drawn from our shadow host over the row's rectangle; the store's own
// DOM is never touched. Follows scroll and resize while shown; gone when the card closes. Visual emphasis only: the
// card carries the words, so nothing is lost without it.

const CSS = `
.mark {
  position: fixed; z-index: 2147483646; pointer-events: none; box-sizing: border-box;
  border-left: 4px solid #D4462C; border-radius: 12px; background: rgba(212, 70, 44, 0.07);
  animation: mark-in 250ms cubic-bezier(0.05, 0.7, 0.1, 1) both;
}
.mark[hidden] { display: none; }
.mark[data-tone="ask"] { border-left-color: #D4462C; background: rgba(212, 70, 44, 0.05); }
@keyframes mark-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mark { animation: none; } }
`;

export interface Mark {
  /** Shows the mark over whatever `find()` returns, re queried on every scroll and resize. Nothing if it returns null. */
  show(find: () => Element | null, tone: 'ask' | 'alarm'): void;
  hide(): void;
}

export function mountMark(root: ShadowRoot): Mark {
  const style = document.createElement('style');
  style.textContent = CSS;
  const el = document.createElement('div');
  el.className = 'mark';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  root.append(style, el);

  let finder: (() => Element | null) | null = null;
  let raf = 0;

  const place = () => {
    raf = 0;
    const row = finder?.();
    if (!row) { el.hidden = true; return; }
    const r = row.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) { el.hidden = true; return; }
    el.style.left = `${Math.round(r.left - 8)}px`;
    el.style.top = `${Math.round(r.top - 6)}px`;
    el.style.width = `${Math.round(r.width + 16)}px`;
    el.style.height = `${Math.round(r.height + 12)}px`;
    el.hidden = false;
  };
  const schedule = () => { if (!raf && finder) raf = requestAnimationFrame(place); };
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule, { passive: true });

  return {
    show(find, tone) {
      finder = find;
      el.dataset.tone = tone;
      place();
    },
    hide() {
      finder = null;
      el.hidden = true;
    },
  };
}
