// The onboarding popup (docs/ONBOARDING.md, design/screens 02 to 09) and, once it has run, her settings.
// She talks you through it and does things while you watch. Every action here is real: the month is read from the
// API, the text goes through /schedule, the envelope is written to the ledger. Nothing is narrated that did not happen.
// Her voice and the cue sounds come from the worker (SPEAK, CUE), which honours the sounds toggle and quiet hours.

import type { Message, Reply } from '@mama/shared/messages';
import type { Cue, Month, Saw, Week } from '@mama/shared/types';
import type { Grandma } from '../../lib/ui/badge';
import { COPY, DOTS, HOMES, MOTHERS_LINE, TIERS, countUp, homeFor, dotIndex, formatPhone, inHome, next, skip, speechSeconds, toE164, words, type Home, type Loudness, type Progress, type Settings, type Step } from '../../lib/onboarding';

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
  // Until onboarding has been completed once it always starts at Welcome. Closing the popup halfway, or reloading the
  // extension, never drops anyone into the middle of it. What was already answered (grandma, bank) is still saved.
  flow = settings.onboarded ? { step: 'home', bank: false, texted: false } : { bank: false, texted: false, ...o, step: 'welcome' as Step };
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
  // The product says hello before anyone is picked; nobody speaks yet, she is not chosen.
  const arrival = $('#arrival');
  arrival.classList.remove('in'); void arrival.offsetWidth; arrival.classList.add('in');
  cue('arrive');
};
SHOW.hello = async () => {
  const g = grandma();
  const copy = COPY[g];
  $('#hello-title').textContent = copy.welcomeTitle;
  $('#hello-body').textContent = copy.welcome;
  $('#hello-sub').textContent = copy.welcomeSub;
  ($('#hello-face') as HTMLImageElement).src = `/faces/${g}/calm.svg`;
  const reveal = [$('#hello-title'), $('#hello-body'), $('#hello-sub')];
  for (const el of reveal) { el.classList.add('reveal'); el.classList.remove('on'); }
  const arrival = $('#hello-arrival');
  arrival.classList.remove('in'); void arrival.offsetWidth; arrival.classList.add('in');
  cue('arrive');
  await sleep(600);
  // Text appears with the voice, not before. With sound off or the API down, it simply appears.
  await speak(`${copy.welcomeTitle} ${copy.welcome}`, $('#hello-speaking'));
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
  bankDemo.disabled = false;
  // A link that already exists on the API shows as linked; the token field is for a first link.
  void send({ type: 'MONTH', grandma: grandma() }).then((r) => {
    const live = !!(r && r.ok && r.month.live);
    $('#bank-live-row').hidden = !live; $('#bank-token-row').hidden = live;
    if (live && r.ok) $('#bank-live-sub').textContent = `Read only, refreshed about once a day. ${r.month.saw?.paychecks.length ? `${r.month.saw.paychecks.length} paycheck${r.month.saw.paychecks.length === 1 ? '' : 's'} seen.` : ''}`;
  }).catch(() => {});
  void speak(COPY[grandma()].bank);
};
const bankToken = $<HTMLInputElement>('#bank-token');
const bankDemo = $<HTMLButtonElement>('#bank-demo');
async function bankConnected(month: Month, label: string, sub: string) {
  flow.month = month; flow.bank = true; flow.hasMonth = !!month.lines.trueLine;
  bankConnect.textContent = label;
  bankStatus.textContent = sub; bankStatus.className = 'status good';
  await sleep(500);
  await advance();
}
// The real bank: a pasted token, or a link that already exists on the API.
bankConnect.addEventListener('click', async () => {
  bankConnect.disabled = true;
  const token = bankToken.value.trim();
  bankStatus.textContent = token ? 'Linking your bank…' : 'Asking the bank…'; bankStatus.className = 'status';
  const r = token ? await send({ type: 'LINK_BANK', token, grandma: grandma() }) : await send({ type: 'MONTH', grandma: grandma() });
  if (!r?.ok) {
    const reason = (r as { reason?: string } | null | undefined)?.reason;
    bankStatus.textContent = reason || 'The bank is not answering. Not now still works.'; bankStatus.className = 'status bad';
    bankConnect.disabled = false;
    return;
  }
  const live = !!r.month.live;
  await bankConnected(r.month, live ? 'Linked. She is reading.' : `Connected. ${r.month.firstName ? `${r.month.firstName}’s account.` : 'Demo student.'}`, live ? 'Read only. Refreshed about once a day.' : 'Capital One Nessie. Simulated.');
});
bankDemo.addEventListener('click', async () => {
  bankDemo.disabled = true; bankConnect.disabled = true;
  bankStatus.textContent = 'Asking the demo bank…'; bankStatus.className = 'status';
  const r = await send({ type: 'MONTH', grandma: grandma() });
  if (!r?.ok) { bankStatus.textContent = 'The bank is not answering. Not now still works.'; bankStatus.className = 'status bad'; bankDemo.disabled = false; bankConnect.disabled = false; return; }
  await bankConnected(r.month, 'Connected. Demo student.', 'Capital One Nessie. Simulated.');
});

// ---------- 05 reading ----------
SHOW.reading = async () => {
  const g = grandma(); const m = flow.month!;
  $('#reading-title').textContent = COPY[g].reading;
  $('#reading-avatar').className = `avatar ${g}`; ($('#reading-face') as HTMLImageElement).src = `/faces/${g}/calm.svg`;
  const rows = [...document.querySelectorAll<HTMLElement>('#ticks .row')];
  for (const r of rows) r.classList.remove('done');
  const bill = m.bills[0];
  const saw = m.saw;
  const labels: Record<string, string | null> = {
    purchases: `${m.counts.purchases} purchase${m.counts.purchases === 1 ? '' : 's'}`,
    paychecks: saw ? (saw.paychecks.length ? `${saw.paychecks.length} paycheck stream${saw.paychecks.length === 1 ? '' : 's'}: ${saw.paychecks[0]!.from}, ${saw.paychecks[0]!.cadence}` : 'No regular pay found yet') : `${m.counts.paychecks} paycheck${m.counts.paychecks === 1 ? '' : 's'}`,
    transfers: saw ? (saw.transfers ? `${saw.transfers} transfer${saw.transfers === 1 ? '' : 's'} between your accounts${saw.cards.length ? `, ${saw.cards.length} card${saw.cards.length === 1 ? '' : 's'}` : ''}` : null) : (m.sentHome || m.toSavings ? [m.sentHome ? `$${m.sentHome} sent home` : '', m.toSavings ? `$${m.toSavings} to savings` : ''].filter(Boolean).join(', ') : null),
    bills: saw ? (saw.bills.length ? `${saw.bills.length} bill${saw.bills.length === 1 ? '' : 's'} and subscriptions${saw.bills.some((b) => b.confirm) ? ', some to confirm' : ''}` : null) : (bill ? `${bill.nickname || bill.payee} due in ${bill.daysUntil} day${bill.daysUntil === 1 ? '' : 's'}` : null),
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
  const atHome = inHome(v, homeFor(settings));
  const m = flow.month;
  envelopeSub.textContent = m?.live && m.reason ? `${m.reason} Slide it if I am wrong.${atHome ? ` About ${atHome}.` : ''}` : `A week of what you spend, plus room to breathe. Slide it if I am wrong.${atHome ? ` About ${atHome}.` : ''}`;
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
  range.value = String(Math.max(25, Math.min(500, m.proposedEnvelope || 75)));
  paintEnvelope();
  // A real bank: her reason for the number, and the bills she saw, early ones marked to confirm.
  if (m.live && m.saw && m.reason) envelopeSub.textContent = `${m.reason} Slide it if I am wrong.`;
  paintBills(m.live ? m.saw ?? null : null);
  const marker = $('#saw-speaking');
  const ok = await speak(tl.spoken, marker);
  // Shocked while the line plays, then Watching.
  setTimeout(() => { face.src = `/faces/${g}/watching.svg`; }, ok ? speechSeconds(tl.spoken) * 1000 : 1200);
};
// The bills she saw, early ones with two answers. A tap is a correction the API keeps forever; the list repaints
// from what she sees after it, so a confirmed bill loses its flag and a dropped one leaves.
function paintBills(saw: Saw | null) {
  const bills = $('#saw-bills');
  bills.replaceChildren(); bills.hidden = true;
  if (!saw) return;
  for (const b of saw.bills.slice(0, 6)) {
    const li = document.createElement('li'); li.className = 'row';
    const name = document.createElement('span'); name.className = 'row-title'; name.textContent = `${b.merchant}, $${b.amount}${b.variable ? ' about' : ''} ${b.cadence}`;
    if (b.confirm) { const c = document.createElement('span'); c.className = 'confirm'; c.textContent = 'confirm?'; name.append(c); }
    const next = document.createElement('span'); next.className = 'row-sub'; next.textContent = b.next ? `next ${b.next}` : '';
    li.append(name, next);
    if (b.confirm) {
      const decide = document.createElement('div'); decide.className = 'decide';
      const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'yes'; yes.textContent = 'Yes, a bill';
      const no = document.createElement('button'); no.type = 'button'; no.textContent = 'Not a bill';
      const answer = async (kind: 'confirmed' | 'not-recurring') => {
        yes.disabled = no.disabled = true;
        const done = document.createElement('span'); done.className = 'decided'; done.textContent = kind === 'confirmed' ? 'A bill. Noted.' : 'Not a bill. Dropped.';
        decide.replaceWith(done);
        const r = await send({ type: 'CORRECT', merchantKey: b.key, kind });
        if (r?.ok && r.saw) { if (flow.month) flow.month.saw = r.saw; paintBills(r.saw); }
      };
      yes.addEventListener('click', () => void answer('confirmed'));
      no.addEventListener('click', () => void answer('not-recurring'));
      decide.append(yes, no); li.append(decide);
    }
    bills.append(li);
  }
  bills.hidden = saw.bills.length === 0;
}
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
  $('#phone-lead').textContent = `${COPY[grandma()].phone} iPhone for now.`;
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
  $('#home-status').textContent = settings.paused ? 'Paused. She is off every page until you turn her back on.' : settings.loudness ? `${TIERS[g].find((t) => t.key === settings.loudness)?.name ?? ''}. ${settings.sounds === false ? 'Muted.' : 'Sound on.'}` : 'Pick how loud below.';
  for (const b of document.querySelectorAll<HTMLButtonElement>('#home-grandma button')) b.setAttribute('aria-pressed', String(b.dataset.v === g));
  $('#home-loud').replaceChildren(...TIERS[g].map((t) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t.name; b.setAttribute('aria-pressed', String(settings.loudness === t.key)); b.addEventListener('click', async () => { await saveSettings({ loudness: t.key }); paintHome(); void speak(t.line); }); return b; }));
  ($('#home-sounds') as HTMLInputElement).checked = settings.sounds !== false;
  ($('#home-paused') as HTMLInputElement).checked = settings.paused === true;
  const cur = $('#home-currency') as HTMLSelectElement;
  if (!cur.options.length) cur.replaceChildren(...HOMES.map((h) => { const o = document.createElement('option'); o.value = h.code; o.textContent = h.name; return o; }));
  cur.value = homeFor(settings);
  $('#home-phone').textContent = settings.phone ? formatPhone(settings.phone) : 'Not set';
  $('#home-envelope').textContent = settings.envelope ? `$${settings.envelope}` : '$75';
}
// The live week on the home screen: what is left, the jar and the streak, when the bank was last read.
async function paintWeek() {
  const r = await send({ type: 'GET_WEEK' }).catch(() => null);
  const w = r && r.ok ? r.week : null;
  const live = !!(w && w.source === 'bank');
  $('#home-week-row').hidden = !w; $('#home-jar-row').hidden = !live; $('#home-bank-row').hidden = !live;
  if (!w) return;
  $('#home-week').textContent = `$${Math.round(w.spent)} of $${Math.round(w.budget)} gone, $${Math.round(w.left)} left, ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} to go${w.carry ? `, $${Math.round(w.carry)} short from last week` : ''}`;
  if (live) {
    $('#home-jar').textContent = `$${Math.round(w.jar ?? 0)}${w.streak ? `, ${w.streak} week${w.streak === 1 ? '' : 's'} kept in a row` : ''}${w.grace ? `, ${w.grace} grace left` : ''}`;
    const ago = w.pulledAt ? Math.round((Date.now() - w.pulledAt) / 3600000) : null;
    $('#home-bank').textContent = `Read ${ago == null ? 'recently' : ago < 1 ? 'this hour' : `${ago} hour${ago === 1 ? '' : 's'} ago`}${w.payday ? `. Payday in ${w.payday.daysUntil} day${w.payday.daysUntil === 1 ? '' : 's'}` : ''}.`;
  }
}
// The shelf: every kept moment, newest first. "Still want it" remembers the item as planned, so she lets it through
// when it comes back; "Let it go" clears the row. The kept credit stays in the week either way.
async function paintShelf() {
  const r = await send({ type: 'SHELF' }).catch(() => null);
  const rows = r && r.ok ? r.shelf : [];
  $('#home-shelf-wrap').hidden = rows.length === 0;
  const ul = $('#home-shelf');
  ul.replaceChildren(...rows.slice(0, 8).map((s) => {
    const li = document.createElement('li'); li.className = 'row';
    const what = document.createElement('div'); what.className = 'what';
    const name = document.createElement('span'); name.textContent = s.item; name.title = s.item;
    const amt = document.createElement('span'); amt.textContent = `$${Math.round(s.amount)}`;
    what.append(name, amt);
    const sub = document.createElement('span'); sub.className = 'row-sub';
    sub.textContent = `${s.store ? `${s.store}, ` : ''}${shelfDay(s.date)}`;
    li.append(what, sub);
    if (s.still) { const st = document.createElement('span'); st.className = 'still'; st.textContent = 'Still wanted. Planned, so she lets it through.'; li.append(st); return li; }
    const decide = document.createElement('div'); decide.className = 'decide';
    const still = document.createElement('button'); still.type = 'button'; still.className = 'yes'; still.textContent = 'Still want it';
    const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Let it go';
    const act = async (action: 'still' | 'let-go') => { still.disabled = go.disabled = true; const x = await send({ type: 'SHELVE', requestId: s.requestId, action }); if (x?.ok) void paintShelf(); };
    still.addEventListener('click', () => void act('still'));
    go.addEventListener('click', () => void act('let-go'));
    decide.append(still, go); li.append(decide);
    return li;
  }));
}
function shelfDay(date: string): string {
  const d = new Date(`${date}T12:00:00`); const days = Math.round((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
// The report card: five fields from GET /report, the six lines under it. Closed on Sunday 7pm, "so far" before.
async function paintReport() {
  const r = await send({ type: 'REPORT', grandma: grandma() }).catch(() => null);
  $('#home-report-wrap').hidden = !(r && r.ok);
  if (!r || !r.ok) return;
  const f = r.fields;
  $('#report-title').textContent = f.result.closed ? 'Sunday report card' : 'This week so far';
  const row = (title: string, value: string, arrow?: 'better' | 'worse' | 'same' | null) => {
    const d = document.createElement('div'); d.className = 'row';
    const t = document.createElement('span'); t.className = 'row-title'; t.textContent = title;
    const v = document.createElement('span'); v.className = 'val'; v.textContent = value;
    if (arrow) { const a = document.createElement('span'); a.className = `arrow ${arrow}`; a.textContent = arrow === 'better' ? 'better than last week' : arrow === 'worse' ? 'more than last week' : 'same as last week'; v.append(a); }
    d.append(t, v); return d;
  };
  $('#home-report').replaceChildren(
    row('Week', f.result.over ? `$${f.result.over} over` : `$${f.result.stayed} stayed`, f.result.arrow),
    row('Biggest thing', f.biggest ? `${f.biggest.item}, $${f.biggest.amount}${f.biggest.day ? `, ${f.biggest.day}` : ''}` : 'Nothing big'),
    row('Streak', `${f.streak.weeks} week${f.streak.weeks === 1 ? '' : 's'}${f.streak.graced ? ', grace used' : ''}`),
    row('Kept jar', `$${f.jar}`),
    row('Monday', `$${f.monday.envelope} goes in${f.monday.carry ? `, $${f.monday.carry} carried` : ''}`),
  );
  $('#report-lines').textContent = r.lines.join('\n');
}
// The plan: open (no billing on the API) hides the block; a trial or a paid plan shows the days or the renewal; locked
// or free shows the two prices, yearly first. Checkout and the portal open in a new tab through the worker.
const planNote = $('#plan-note');
async function paintPlan() {
  const r = await send({ type: 'ME' }).catch(() => null);
  const wrap = $('#home-plan-wrap');
  wrap.hidden = !(r && r.ok) || r.plan === 'open';
  if (!r || !r.ok || r.plan === 'open') return;
  const actions = $('#plan-actions'), manage = $('#plan-manage');
  const full = r.plan === 'full';
  $('#plan-title').textContent = full ? (r.status === 'trialing' ? 'Trial' : 'Full') : r.plan === 'free' ? 'Free, text only' : 'Her week is paused';
  $('#plan-sub').textContent = full
    ? (r.status === 'trialing' && r.trialDaysLeft != null ? `${r.trialDaysLeft} day${r.trialDaysLeft === 1 ? '' : 's'} left, then ${r.prices.year.label}` : r.periodEnd ? `Renews ${new Date(r.periodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '')
    : r.plan === 'free' ? 'Voice and texts are off.' : 'Seven days free with a card, cancel in one tap.';
  actions.hidden = full;
  manage.hidden = !full && r.status === 'none';
  $('#plan-year').textContent = `${r.prices.year.label}`;
  $('#plan-month').textContent = `${r.prices.month.label}`;
}
for (const [id, plan] of [['#plan-year', 'year'], ['#plan-month', 'month']] as const) $(id).addEventListener('click', async () => { planNote.textContent = 'Opening checkout.'; const x = await send({ type: 'BILLING', action: 'checkout', plan }); planNote.textContent = x?.ok ? 'Checkout opened in a new tab.' : (x && !x.ok ? x.reason : 'Could not open checkout.'); });
$('#plan-manage').addEventListener('click', async () => { const x = await send({ type: 'BILLING', action: 'portal' }); planNote.textContent = x?.ok ? 'Opened in a new tab.' : (x && !x.ok ? x.reason : 'Could not open billing.'); });

// The house: one pot. Not in one: open or join. In one: the code, the people, the envelope (Monday's number for the
// opener), the house week and what the others see (amount, item, day).
const houseNote = $('#house-note');
async function paintHouse(r?: Reply<{ type: 'HOUSE'; action: 'get' }> | null) {
  const x = r ?? (await send({ type: 'HOUSE', action: 'get' }).catch(() => null));
  const inHouse = !!(x && x.ok && x.house);
  $('#house-list').hidden = !inHouse; $('#house-items').hidden = true;
  $('#house-actions').hidden = inHouse; $('#house-member-actions').hidden = !inHouse;
  $('#home-house-wrap').hidden = !x || !x.ok;
  if (!x || !x.ok || !x.house) { $('#house-sub').textContent = 'One envelope for two to four people. Others see the amount, the item and the day, never who.'; return; }
  const h = x.house, w = x.week;
  $('#house-sub').textContent = h.opener ? 'You opened it. Share the code; you set Monday\u2019s number.' : 'Share the code to bring someone in.';
  $('#house-code').textContent = h.code;
  $('#house-members').textContent = `${h.members} of 4`;
  $('#house-envelope').textContent = `$${h.envelope} a week${h.nextEnvelope != null ? `, $${h.nextEnvelope} from Monday` : ''}`;
  $('#house-week').textContent = w ? `$${Math.round(w.spent)} of $${Math.round(w.budget)} gone, $${Math.round(w.left)} left${w.mine ? `, $${w.mine.spent} of it yours` : ''}` : '';
  const setRow = $('#house-set-row'); setRow.hidden = !h.opener;
  if (h.opener) ($('#house-amount') as HTMLInputElement).value = String(h.nextEnvelope ?? h.envelope);
  const items = $('#house-items');
  const list = (w && w.items) || [];
  items.hidden = list.length === 0;
  items.replaceChildren(...list.slice(0, 6).map((i) => { const li = document.createElement('li'); li.className = 'row'; const what = document.createElement('div'); what.className = 'what'; const a = document.createElement('span'); a.textContent = i.kept ? `${i.item}, kept` : i.item; const b = document.createElement('span'); b.textContent = `$${i.amount}`; what.append(a, b); li.append(what); if (i.day) { const d = document.createElement('span'); d.className = 'row-sub'; d.textContent = shelfDay(i.day); li.append(d); } return li; }));
}
$('#house-open').addEventListener('click', async () => { houseNote.textContent = ''; const x = await send({ type: 'HOUSE', action: 'open', amount: settings.envelope || 75 }); if (x && !x.ok) houseNote.textContent = x.reason; else { void paintHouse(x); void paintWeek(); } });
$('#house-join-show').addEventListener('click', () => { $('#house-join-row').hidden = false; ($('#house-code-field') as HTMLInputElement).focus(); });
$('#house-join').addEventListener('click', async () => { houseNote.textContent = ''; const code = ($('#house-code-field') as HTMLInputElement).value.replace(/\D/g, ''); if (code.length !== 6) { houseNote.textContent = 'Six digits.'; return; } const x = await send({ type: 'HOUSE', action: 'join', code }); if (x && !x.ok) houseNote.textContent = x.reason; else { void paintHouse(x); void paintWeek(); } });
$('#house-set').addEventListener('click', async () => { houseNote.textContent = ''; const amount = Number(($('#house-amount') as HTMLInputElement).value); const x = await send({ type: 'HOUSE', action: 'envelope', amount }); if (x && !x.ok) houseNote.textContent = x.reason; else { houseNote.textContent = 'Set. It starts Monday.'; void paintHouse(x); } });
$('#house-leave').addEventListener('click', async () => { houseNote.textContent = ''; const x = await send({ type: 'HOUSE', action: 'leave' }); if (x && !x.ok) houseNote.textContent = x.reason; else { void paintHouse(x); void paintWeek(); } });

SHOW.home = () => { homeNote.textContent = ''; paintHome(); void paintWeek(); void paintPlan(); void paintHouse(); void paintReport(); void paintShelf(); };
for (const b of document.querySelectorAll<HTMLButtonElement>('#home-grandma button')) b.addEventListener('click', async () => { await saveSettings({ grandma: b.dataset.v as Grandma }); paintHome(); });
// The API address: saved on change, checked at once, so a wrong address shows before a judge does.
{
  const field = $('#home-api') as HTMLInputElement;
  const sub = $('#home-api-sub');
  field.value = settings.apiUrl ?? '';
  field.addEventListener('change', async () => {
    const url = field.value.trim().replace(/\/+$/, '');
    await saveSettings({ apiUrl: url || undefined });
    if (!url) { sub.textContent = 'Empty means this computer.'; return; }
    sub.textContent = 'Checking…';
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      const j = (await r.json()) as { ok?: boolean };
      sub.textContent = j.ok ? `She answers at ${url}.` : `Something answers at ${url}, but it is not her.`;
    } catch {
      sub.textContent = `Nothing answers at ${url}. Is the API running there, and are you on the same network?`;
    }
  });
}
$('#home-currency').addEventListener('change', (e) => { void saveSettings({ home: (e.target as HTMLSelectElement).value as Home }).then(paintHome); });
$('#home-sounds').addEventListener('change', (e) => { void saveSettings({ sounds: (e.target as HTMLInputElement).checked }).then(() => { paintHome(); paintMute(); }); });
$('#home-paused').addEventListener('change', (e) => { void saveSettings({ paused: (e.target as HTMLInputElement).checked }).then(paintHome); });
$('#home-over').addEventListener('click', async () => {
  // Start over is a fresh install: the worker clears every store, and this popup goes straight back to Welcome.
  const r = await send({ type: 'START_OVER' });
  if (!r) { homeNote.textContent = 'That did not work. Reload the extension and try again.'; return; }
  settings = {};
  flow = { step: 'welcome', bank: false, texted: false };
  await show('welcome');
});
$('#home-bank-remove').addEventListener('click', async () => {
  // The bank goes, the week stays. The row hides and the demo ledger carries the week until a new link.
  const r = await send({ type: 'UNLINK_BANK' });
  if (!r || !r.ok) { homeNote.textContent = 'She could not reach the API to remove it. Try again.'; return; }
  flow.bank = false;
  homeNote.textContent = 'The bank is gone. Your week, jar and shelf stayed.';
  await paintHome();
});
$('#home-delete').addEventListener('click', async () => {
  // Two taps: the first asks, the second deletes. Everything the API holds for this device and the browser's copy.
  const b = $<HTMLButtonElement>('#home-delete');
  if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to delete everything'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Delete my data'; }, 6000); return; }
  await send({ type: 'DELETE_ME' });
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
