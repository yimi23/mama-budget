// The onboarding popup (docs/ONBOARDING.md, design/screens 02 to 09) and, once it has run, her settings.
// She talks you through it and does things while you watch. Every action here is real: the month is read from the
// API, the text goes through /schedule, the envelope is written to the ledger. Nothing is narrated that did not happen.
// Her voice and the cue sounds come from the worker (SPEAK, CUE), which honours the sounds toggle and quiet hours.

import type { Message, Reply } from '@mama/shared/messages';
import type { Cue, Month, Week } from '@mama/shared/types';
import type { Grandma } from '../../lib/ui/badge';
import { COPY, DOTS, MOTHERS_LINE, TIERS, countUp, dotIndex, formatPhone, naira, next, skip, speechSeconds, toE164, words, type Loudness, type Progress, type Settings, type Step } from '../../lib/onboarding';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send<M extends Message>(msg: M): Promise<Reply<M> | null> {
  try { return (await browser.runtime.sendMessage(msg)) as Reply<M>; } catch { return null; }
}

// ---------- state ----------
interface Flow extends Progress { step: Step | 'home'; month?: Month; sentText?: string | null }
let settings: Settings = {};
let flow: Flow = { step: 'welcome', bank: false, texted: false };
const grandma = (): Grandma => settings.grandma ?? 'mama';

async function load() {
  const { settings: s = {}, onboarding = {} } = await browser.storage.local.get(['settings', 'onboarding']);
  settings = s as Settings;
  const o = onboarding as Partial<Flow>;
  flow = settings.onboarded ? { step: 'home', bank: false, texted: false } : { bank: false, texted: false, ...o, step: (o.step as Step) ?? 'welcome' };
  if (flow.step === 'reading' || flow.step === 'saw' || flow.step === 'watch') flow.step = flow.month ? flow.step : 'bank';
}
async function saveSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  await browser.storage.local.set({ settings });
}
async function saveFlow() {
  const { month: _m, ...rest } = flow;
  await browser.storage.local.set({ onboarding: rest });
}

// ---------- voice and sound ----------
let speakingTimer: ReturnType<typeof setTimeout> | undefined;
/** Plays her line and shows the marker for as long as she speaks. Resolves when she has started (or could not). */
async function speak(text: string, marker?: HTMLElement, who: Grandma = grandma()): Promise<boolean> {
  const r = await send({ type: 'SPEAK', text, grandma: who });
  const ok = !!r?.ok;
  if (marker) {
    clearTimeout(speakingTimer);
    marker.hidden = !ok;
    if (ok) speakingTimer = setTimeout(() => { marker.hidden = true; }, ((r?.duration ?? speechSeconds(text)) + 0.2) * 1000);
  }
  return ok;
}
const cue = (c: Cue) => void send({ type: 'CUE', cue: c });

// ---------- frame: dots, mute, show ----------
const frame = $('#frame');
const dots = $('#dots');
const mute = $<HTMLButtonElement>('#mute');
const SPEAKER_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SPEAKER_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';

function paintMute() {
  const on = settings.sounds !== false;
  mute.innerHTML = on ? SPEAKER_ON : SPEAKER_OFF; // fixed markup, never page data
  mute.setAttribute('aria-label', on ? 'Sound on. Tap to mute.' : 'Muted. Tap for sound.');
}
mute.addEventListener('click', () => { void saveSettings({ sounds: settings.sounds === false }).then(paintMute); });

function paintDots(step: Step | 'home') {
  const i = step === 'home' ? -1 : dotIndex(step);
  dots.hidden = i < 0;
  dots.replaceChildren(...DOTS.map((_, k) => { const s = document.createElement('span'); if (k < i) s.className = 'done'; if (k === i) s.className = 'now'; return s; }));
}

const SHOW: Partial<Record<Step | 'home', () => void | Promise<void>>> = {};

async function show(step: Step | 'home') {
  clearTimeout(speakingTimer);
  flow.step = step;
  await saveFlow();
  frame.dataset.step = step;
  for (const s of document.querySelectorAll<HTMLElement>('section[data-step]')) s.hidden = s.dataset.step !== step;
  paintDots(step);
  mute.hidden = step === 'welcome' || step === 'grandma' || step === 'home';
  const first = document.querySelector<HTMLElement>(`section[data-step="${step}"] h1`);
  first?.setAttribute('tabindex', '-1'); first?.focus({ preventScroll: true });
  await SHOW[step]?.();
}
async function advance() {
  const n = flow.step === 'home' ? 'done' : next(flow.step, flow);
  if (n === 'done') return finish('home');
  await show(n);
}
async function finish(then: 'home') {
  await saveSettings({ onboarded: true });
  await show(then);
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-go="next"]')) b.addEventListener('click', () => void advance());
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-go="skip"]')) b.addEventListener('click', () => { const s = flow.step === 'home' ? null : skip(flow.step); if (s) void show(s); });

// ---------- 02 welcome ----------
SHOW.welcome = async () => {
  const g = grandma();
  const copy = COPY[g];
  $('#welcome-title').textContent = copy.welcomeTitle;
  $('#welcome-body').textContent = copy.welcome;
  $('#welcome-sub').textContent = copy.welcomeSub;
  ($('#welcome-face') as HTMLImageElement).src = `/faces/${g}/calm.svg`;
  const reveal = [$('#welcome-title'), $('#welcome-body'), $('#welcome-sub')];
  for (const el of reveal) { el.classList.add('reveal'); el.classList.remove('on'); }
  const arrival = $('#arrival');
  arrival.classList.remove('in'); void arrival.offsetWidth; arrival.classList.add('in');
  cue('arrive');
  await sleep(600);
  // Text appears with the voice, not before. With sound off or the API down, it simply appears.
  await speak(`${copy.welcomeTitle} ${copy.welcome}`, $('#welcome-speaking'));
  for (const el of reveal) el.classList.add('on');
};

// ---------- 03 grandma ----------
$('#mothers').textContent = MOTHERS_LINE;
for (const tile of document.querySelectorAll<HTMLButtonElement>('.tile[role="radio"]')) {
  tile.addEventListener('click', async () => {
    const g = tile.closest<HTMLElement>('.grandma')!.dataset.grandma as Grandma;
    for (const t of document.querySelectorAll('.tile[role="radio"]')) t.setAttribute('aria-checked', String(t === tile));
    await saveSettings({ grandma: g });
    await advance();
  });
}
for (const hear of document.querySelectorAll<HTMLButtonElement>('.hear')) {
  hear.addEventListener('click', async () => {
    const g = hear.dataset.hear as Grandma;
    hear.classList.add('on');
    const ok = await speak(COPY[g].preview, undefined, g);
    setTimeout(() => hear.classList.remove('on'), ok ? speechSeconds(COPY[g].preview) * 1000 : 300);
  });
}
SHOW.grandma = () => { for (const t of document.querySelectorAll('.tile[role="radio"]')) t.setAttribute('aria-checked', String((t.closest<HTMLElement>('.grandma')!.dataset.grandma) === settings.grandma)); };

// ---------- 04 bank ----------
const bankStatus = $('#bank-status');
const bankConnect = $<HTMLButtonElement>('#bank-connect');
SHOW.bank = () => {
  bankStatus.textContent = ''; bankStatus.className = 'status';
  bankConnect.disabled = false; bankConnect.textContent = 'Let her read it';
  void speak(COPY[grandma()].bank);
};
bankConnect.addEventListener('click', async () => {
  bankConnect.disabled = true;
  bankStatus.textContent = 'Asking the bank…'; bankStatus.className = 'status';
  const r = await send({ type: 'MONTH', grandma: grandma() });
  if (!r?.ok) {
    bankStatus.textContent = 'The bank is not answering. Not now still works.'; bankStatus.className = 'status bad';
    bankConnect.disabled = false;
    return;
  }
  flow.month = r.month; flow.bank = true; flow.hasMonth = !!r.month.lines.trueLine;
  bankConnect.textContent = `Connected. ${r.month.firstName ? `${r.month.firstName}’s account.` : 'Demo student.'}`;
  bankStatus.textContent = 'Capital One Nessie. Simulated.'; bankStatus.className = 'status good';
  await sleep(500);
  await advance();
});

// ---------- 05 reading ----------
SHOW.reading = async () => {
  const g = grandma(); const m = flow.month!;
  $('#reading-title').textContent = COPY[g].reading;
  $('#reading-avatar').className = `avatar ${g}`; ($('#reading-face') as HTMLImageElement).src = `/faces/${g}/calm.svg`;
  const rows = [...document.querySelectorAll<HTMLElement>('#ticks .row')];
  for (const r of rows) r.classList.remove('done');
  const bill = m.bills[0];
  const labels: Record<string, string | null> = {
    purchases: `${m.counts.purchases} purchase${m.counts.purchases === 1 ? '' : 's'}`,
    paychecks: `${m.counts.paychecks} paycheck${m.counts.paychecks === 1 ? '' : 's'}`,
    transfers: m.sentHome || m.toSavings ? [m.sentHome ? `$${m.sentHome} sent home` : '', m.toSavings ? `$${m.toSavings} to savings` : ''].filter(Boolean).join(', ') : null,
    bills: bill ? `${bill.nickname || bill.payee} due in ${bill.daysUntil} day${bill.daysUntil === 1 ? '' : 's'}` : null,
  };
  void speak(COPY[g].reading);
  const started = Date.now();
  // Her first words and the first watch are generated now, so screen 06 speaks the moment it opens.
  const warm = send({ type: 'WARM', grandma: g, texts: [m.lines.trueLine?.spoken ?? '', m.lines.watches[0]?.spoken ?? ''] });
  for (const r of rows) {
    await sleep(400);
    const label = labels[r.dataset.tick!];
    r.querySelector('.row-title')!.textContent = label ?? (r.dataset.tick === 'bills' ? 'No bills coming up' : r.dataset.tick === 'transfers' ? 'Nothing sent or saved' : r.querySelector('.row-title')!.textContent);
    if (label) { r.classList.add('done'); cue('tick'); }
  }
  // Minimum 2.5s so it reads as reading; at 6s advance anyway, text only.
  await Promise.race([warm, sleep(6000 - (Date.now() - started))]);
  await sleep(Math.max(0, 2500 - (Date.now() - started)));
  await advance();
};

// ---------- 06 saw ----------
const range = $<HTMLInputElement>('#envelope-range');
const envelopeValue = $<HTMLOutputElement>('#envelope-value');
const envelopeSub = $('#envelope-sub');
function paintEnvelope() {
  const v = Number(range.value);
  envelopeValue.textContent = `$${v}`;
  envelopeSub.textContent = `A week of what you spend, plus room to breathe. Slide it if she is wrong.${grandma() === 'mama' ? ` About ${naira(v)}.` : ''}`;
}
range.addEventListener('input', paintEnvelope);
SHOW.saw = async () => {
  const g = grandma(); const m = flow.month!;
  const tl = m.lines.trueLine!;
  $('#saw-avatar').className = `avatar square ${g}`;
  const face = $('#saw-face') as HTMLImageElement;
  face.src = `/faces/${g}/shocked.svg`;
  $('#true-line').textContent = tl.text;
  $('#envelope-prefix').textContent = m.firstName ? `Fun money this week, ${m.firstName}:` : 'Fun money this week:';
  range.value = String(Math.max(25, Math.min(300, m.proposedEnvelope || 75)));
  paintEnvelope();
  const marker = $('#saw-speaking');
  const ok = await speak(tl.spoken, marker);
  // Shocked while the line plays, then Watching.
  setTimeout(() => { face.src = `/faces/${g}/watching.svg`; }, ok ? speechSeconds(tl.spoken) * 1000 : 1200);
};
$('#saw-fair').addEventListener('click', async () => {
  const amount = Number(range.value);
  const r = await send({ type: 'SET_ENVELOPE', amount });
  await saveSettings({ envelope: r?.ok ? r.envelope : amount });
  await advance();
});

// ---------- 06b watch ----------
let changing = false;
function paintWatches() {
  const m = flow.month!;
  const ignored = new Set(settings.ignoredWatches ?? []);
  const list = $('#watches');
  const rows = m.lines.watches.filter((w) => !ignored.has(w.title)).slice(0, 3);
  list.replaceChildren(...rows.map((w, i) => {
    const li = document.createElement('li'); li.className = 'row';
    const what = document.createElement('div'); what.className = 'what';
    const title = document.createElement('span'); title.className = 'row-title'; title.textContent = w.title;
    what.append(title);
    if (i === 0) { const sp = document.createElement('span'); sp.className = 'speaking'; sp.id = 'watch-speaking'; sp.hidden = true; sp.append(...'12345'.split('').map(() => document.createElement('i')), 'Speaking'); what.append(sp); }
    if (changing) {
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Don’t watch this';
      rm.addEventListener('click', async () => { await saveSettings({ ignoredWatches: [...ignored, w.title] }); paintWatches(); });
      what.append(rm);
    }
    const line = document.createElement('span'); line.className = 'row-sub'; line.textContent = w.line;
    li.append(what, line);
    return li;
  }));
  if (!rows.length) { const li = document.createElement('li'); li.className = 'row'; li.textContent = 'Nothing to watch yet. She will learn as you shop.'; list.append(li); }
}
SHOW.watch = async () => {
  changing = false; $('#watch-change').textContent = 'Change these';
  paintWatches();
  const first = flow.month!.lines.watches.find((w) => !(settings.ignoredWatches ?? []).includes(w.title));
  if (first) await speak(first.spoken, document.querySelector<HTMLElement>('#watch-speaking') ?? undefined);
};
$('#watch-change').addEventListener('click', () => { changing = !changing; $('#watch-change').textContent = changing ? 'Done' : 'Change these'; paintWatches(); });

// ---------- 07 phone ----------
const phone = $<HTMLInputElement>('#phone');
const phoneSend = $<HTMLButtonElement>('#phone-send');
const phoneStatus = $('#phone-status');
phone.addEventListener('input', () => { const d = phone.value; phone.value = formatPhone(d); phoneSend.disabled = !toE164(phone.value) || phoneSend.dataset.off === '1'; });
SHOW.phone = async () => {
  $('#phone-lead').textContent = grandma() === 'nana' ? 'She texts. Sundays at seven, and when something’s up. iPhone for now.' : 'She texts. A short statement every Sunday at 7pm, and one text when something big happens. iPhone for now.';
  phone.value = settings.phone ? formatPhone(settings.phone) : '';
  phoneStatus.textContent = ''; phoneStatus.className = 'status';
  phoneSend.textContent = 'Text me what you saw'; phoneSend.dataset.off = '0'; phoneSend.disabled = !toE164(phone.value);
  void speak(COPY[grandma()].phone);
  const h = await send({ type: 'HEALTH' });
  if (!h?.texts) { phoneSend.textContent = 'Texts are off right now'; phoneSend.dataset.off = '1'; phoneSend.disabled = true; }
};
phoneSend.addEventListener('click', async () => {
  const to = toE164(phone.value);
  if (!to) return;
  phoneSend.disabled = true; phoneStatus.textContent = 'Sending…'; phoneStatus.className = 'status';
  const r = await send({ type: 'TEXT_NOW', grandma: grandma(), to });
  if (!r?.ok || !r.texted) {
    phoneSend.textContent = 'Texts are off right now'; phoneSend.dataset.off = '1';
    phoneStatus.textContent = r?.reason ?? 'Texts are off right now. Not now still works.'; phoneStatus.className = 'status bad';
    return;
  }
  await saveSettings({ phone: to });
  flow.texted = true; flow.sentText = r.text;
  await advance();
});

// ---------- 07b check ----------
SHOW.check = () => {
  $('#imsg-meta').textContent = `${COPY[grandma()].name} · just now`;
  $('#imsg-text').textContent = flow.sentText ?? '';
  cue('text');
};

// ---------- 08 loud ----------
const tiers = $('#tiers');
const loudNext = $<HTMLButtonElement>('#loud-next');
SHOW.loud = () => {
  const g = grandma();
  loudNext.disabled = !settings.loudness;
  tiers.replaceChildren(...TIERS[g].map((t) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tier'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.loudness === t.key));
    const text = document.createElement('div'); text.className = 'text';
    const name = document.createElement('span'); name.className = 'row-title'; name.textContent = t.name;
    const desc = document.createElement('span'); desc.className = 'row-sub'; desc.textContent = t.desc;
    text.append(name, desc);
    const radio = document.createElement('span'); radio.className = 'radio';
    b.append(text, radio);
    b.addEventListener('click', async () => {
      await saveSettings({ loudness: t.key });
      for (const o of tiers.querySelectorAll('.tier')) o.setAttribute('aria-checked', String(o === b));
      loudNext.disabled = false;
      void speak(t.line); // at the picked tier's volume: the worker reads settings.loudness
    });
    return b;
  }));
};
loudNext.addEventListener('click', () => void advance());

// ---------- 09 go ----------
SHOW.go = async () => {
  const g = grandma();
  $('#go-scene').className = `scene ${g}`; ($('#go-face') as HTMLImageElement).src = `/faces/${g}/proud.svg`;
  cue('proud');
  const w = await send({ type: 'GET_WEEK' });
  const kept = w?.ok ? Math.round((w as { week: Week }).week.kept) : 0;
  $('#kept-sub').textContent = COPY[g].goText(kept).replace(/^\$\d+ /, '');
  const el = $('#kept'); const t0 = performance.now();
  await new Promise<void>((done) => {
    const tick = () => { const t = performance.now() - t0; el.textContent = `$${countUp(kept, 600, t)}`; if (t < 600) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });
  cue('tick');
  void speak(COPY[g].go(words(kept)));
};
$('#go-practice').addEventListener('click', async () => {
  await saveSettings({ onboarded: true });
  await browser.tabs.create({ url: browser.runtime.getURL('/practice.html') }).catch(() => {});
  await show('home');
});
$('#go-store').addEventListener('click', async () => {
  await saveSettings({ onboarded: true });
  await browser.tabs.create({ url: 'https://www.amazon.com/gp/cart/view.html' }).catch(() => {});
  await show('home');
});

// ---------- home: her settings ----------
const homeNote = $('#home-note');
function paintHome() {
  const g = grandma();
  $('#home-title').textContent = `${COPY[g].name} is in your cart.`;
  $('#home-status').textContent = settings.loudness ? `${TIERS[g].find((t) => t.key === settings.loudness)?.name ?? ''}. ${settings.sounds === false ? 'Muted.' : 'Sound on.'}` : 'Pick how loud below.';
  for (const b of document.querySelectorAll<HTMLButtonElement>('#home-grandma button')) b.setAttribute('aria-pressed', String(b.dataset.v === g));
  $('#home-loud').replaceChildren(...TIERS[g].map((t) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t.name; b.setAttribute('aria-pressed', String(settings.loudness === t.key)); b.addEventListener('click', async () => { await saveSettings({ loudness: t.key }); paintHome(); void speak(t.line); }); return b; }));
  ($('#home-sounds') as HTMLInputElement).checked = settings.sounds !== false;
  $('#home-phone').textContent = settings.phone ? formatPhone(settings.phone) : 'Not set';
  $('#home-envelope').textContent = settings.envelope ? `$${settings.envelope}` : '$75';
}
SHOW.home = () => { homeNote.textContent = ''; paintHome(); };
for (const b of document.querySelectorAll<HTMLButtonElement>('#home-grandma button')) b.addEventListener('click', async () => { await saveSettings({ grandma: b.dataset.v as Grandma }); paintHome(); });
$('#home-sounds').addEventListener('change', (e) => { void saveSettings({ sounds: (e.target as HTMLInputElement).checked }).then(() => { paintHome(); paintMute(); }); });
$('#home-over').addEventListener('click', async () => {
  // Start over is a fresh install: the worker clears every store, and this popup goes straight back to Welcome.
  const r = await send({ type: 'START_OVER' });
  if (!r) { homeNote.textContent = 'That did not work. Reload the extension and try again.'; return; }
  settings = {};
  flow = { step: 'welcome', bank: false, texted: false };
  await show('welcome');
});
$('#home-tour').addEventListener('click', async () => {
  await saveSettings({ onboarded: false });
  flow = { step: 'welcome', bank: false, texted: false };
  await show('welcome');
});

// ---------- boot ----------
(async () => {
  if (window.innerWidth > 480) document.body.classList.add('tab');
  await load();
  paintMute();
  await show(flow.step);
})();
