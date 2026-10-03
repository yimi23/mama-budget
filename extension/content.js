// Mama in the corner. Grammarly style: a small badge that opens into her card when she has something to say.
// Reads the cart through the site reader, asks the API, animates her face, speaks, and offers two buttons.

(() => {
  const API = 'http://localhost:8787';
  const site = Object.values(window.MamaSites || {}).find((s) => s.matches());
  if (!site) return;

  const MOODS = ['calm', 'watching', 'shocked', 'down', 'proud'];
  const GELE = { calm: 0, watching: 0.35, shocked: 1, down: -0.3, proud: 0.1 }; // gele height, 0 = neat, 1 = towering

  // ---------- UI ----------
  const root = document.createElement('div');
  root.id = 'mama-root';
  root.innerHTML = `
    <button id="mama-badge" aria-label="Mama Budget">
      <img id="mama-face" alt="Mama" src="${chrome.runtime.getURL('assets/calm.svg')}">
      <span id="mama-meter"><i></i></span>
    </button>
    <section id="mama-card" hidden>
      <img id="mama-card-face" alt="" src="${chrome.runtime.getURL('assets/calm.svg')}">
      <div id="mama-card-body">
        <p id="mama-line"></p>
        <p id="mama-sub"></p>
        <div id="mama-actions">
          <button id="mama-agree">You're right, Mama</button>
          <button id="mama-buy">Buy anyway</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector(id);
  const audio = new Audio();

  let current = null; // the item she is talking about
  let lastKey = '';

  function setMood(mood, ratio) {
    const src = chrome.runtime.getURL(`assets/${MOODS.includes(mood) ? mood : 'calm'}.svg`);
    $('#mama-face').src = src;
    $('#mama-card-face').src = src;
    root.dataset.mood = mood;
    // The meter is the gele: month ratio sets the baseline, the mood pushes it.
    const h = Math.max(0, Math.min(1, (ratio || 0) * 0.6 + (GELE[mood] || 0) * 0.4));
    $('#mama-meter i').style.transform = `scaleY(${0.15 + h * 0.85})`;
  }

  function open(line, sub, item) {
    current = item;
    $('#mama-line').textContent = line;
    $('#mama-sub').textContent = sub || '';
    $('#mama-card').hidden = false;
    root.classList.add('open');
  }
  function close() { $('#mama-card').hidden = true; root.classList.remove('open'); current = null; }

  // ---------- Judge ----------
  async function check() {
    const items = site.cart();
    const key = items.map((i) => `${i.item}|${i.price}`).join(';');
    if (key === lastKey) return;
    lastKey = key;
    if (!items.length) { close(); return; }
    let out;
    try {
      const r = await fetch(`${API}/judge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items.map(({ el, ...rest }) => rest) }) });
      out = await r.json();
    } catch { return; }
    setMood(out.mood, out.month.ratio);
    const loud = out.items.find((i) => i.react);
    const ask = out.items.find((i) => i.label === 'ask');
    if (loud) {
      const row = items.find((i) => i.item === loud.item);
      open(loud.line, `${Math.round(out.month.ratio * 100)}% of this month's fun money already gone.`, row);
      if (out.audioUrl) { audio.src = out.audioUrl; audio.play().catch(() => {}); }
    } else if (ask) {
      const row = items.find((i) => i.item === ask.item);
      open(ask.line, 'She is not scolding. She is asking.', row);
      $('#mama-buy').textContent = 'It was for a reason';
    } else {
      close();
    }
  }

  // ---------- Actions ----------
  $('#mama-agree').addEventListener('click', () => {
    if (current) site.remove(current);
    setMood('proud', 0);
    open('Ehen. Good child.', 'Put back. Mama is proud.', null);
    setTimeout(close, 2500);
    lastKey = '';
  });

  $('#mama-buy').addEventListener('click', async () => {
    if (!current) return close();
    const { el, ...item } = current;
    try {
      const r = await fetch(`${API}/buy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) });
      const out = await r.json();
      setMood(out.month.mood, out.month.ratio);
      if (out.month.mood === 'down') open('Is it me you are doing this to?', 'Budget blown. Check your phone.', null);
      else close();
    } catch { close(); }
    lastKey = '';
  });

  $('#mama-badge').addEventListener('click', () => (root.classList.contains('open') ? close() : check()));

  // Poll the cart. Cheap, and it survives whatever the site does to its DOM.
  setInterval(check, 1200);
  fetch(`${API}/month`).then((r) => r.json()).then((m) => setMood(m.mood, m.ratio)).catch(() => setMood('calm', 0));
})();
