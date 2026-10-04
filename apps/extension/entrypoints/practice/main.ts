// The practice cart, the finale of onboarding (design/screens/01, docs/ONBOARDING.md last row). A page of our own,
// read by lib/readers/sites/practice.ts, judged by the same API and shown by the same badge and card as a real store.
// Rice and soap are already in; the AirPods land 1.5s after load so she asks in front of you. Her buttons write
// memory for real, because this is the real session code. It ends with "Open a real store".

import type { Cue } from '@mama/shared/types';
import { start } from '../../lib/session';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) => `$${n}`;
const cue = (c: Cue) => browser.runtime.sendMessage({ type: 'CUE', cue: c }).catch(() => {});

function addItem(name: string, price: number) {
  const li = document.createElement('li');
  li.className = 'item new'; li.setAttribute('data-row', '');
  const thumb = document.createElement('span'); thumb.className = 'thumb';
  const n = document.createElement('span'); n.className = 'name'; n.setAttribute('data-name', ''); n.textContent = name;
  const p = document.createElement('span'); p.className = 'price'; p.setAttribute('data-price', ''); p.textContent = money(price);
  li.append(thumb, n, p);
  $('#cart').append(li);
  const total = [...document.querySelectorAll<HTMLElement>('[data-price]')].reduce((s, el) => s + Number(el.textContent!.replace(/[^\d.]/g, '')), 0);
  $('#subtotal').textContent = money(total);
  $('#total').textContent = money(total);
}

/** Clicky's draw demo, our version: a dashed line from the card to the badge with "That's me. I live here." */
function drawLine() {
  const W = window.innerWidth, H = window.innerHeight;
  // Card: right 24, bottom 112, 360 wide. Badge: right 24, bottom 24, 64 across. (lib/ui/card.ts, badge.ts)
  const x1 = W - 24 - 300, y1 = H - 112 + 6;
  const x2 = W - 24 - 32, y2 = H - 24 - 68;
  const path = $('#draw-path') as unknown as SVGPathElement;
  path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 60} ${y1 + 60}, ${x2 - 40} ${y2 - 30}, ${x2} ${y2}`);
  const svg = $('#draw');
  svg.classList.add('on');
  const callout = $('#callout');
  callout.hidden = false;
  setTimeout(() => { svg.classList.remove('on'); callout.hidden = true; }, 2000);
}

(async () => {
  const { settings = {} } = await browser.storage.local.get('settings');
  const g = (settings as { grandma?: 'mama' | 'nana' | 'abuela' | 'wong' }).grandma;
  if (g) {
    $('#brand-avatar').className = `avatar ${g}`;
    ($('#brand-face') as HTMLImageElement).src = `/faces/${g}/calm.svg`;
  } else {
    const note = $('#note');
    note.hidden = false;
    note.textContent = 'Pick your grandma first, then come back: ';
    const a = document.createElement('a'); a.href = browser.runtime.getURL('/popup.html'); a.textContent = 'open the setup'; a.target = '_blank';
    note.append(a, '.');
  }
  // The same session as a store page. The gate is ours to open: this page is a cart by definition.
  start({ onInvalidated() {} }, 'cart');
  await sleep(1500);
  addItem('AirPods Pro', 179);
  cue('ask');
  $('#lead').textContent = 'Rice and soap went in and she said nothing. The AirPods just landed and she is asking, not scolding. When you are done, open a real store. She will be there.';
  await sleep(2200);
  drawLine();
})();
