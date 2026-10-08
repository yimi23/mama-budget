// The practice cart on the site. The judge below is api/judge/rules_v2.js, the part that needs no server: the protected
// list, the ask line, memory first, the week decides the volume. Her lines are from api/lines/writer.js pools. Memory
// lives in this browser, so she asks once and remembers, like the real one. Nothing here touches a bank or a store.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const PROTECTED = ['rent', 'electric', 'bill', 'phone bill', 'prescription', 'medicine', 'insurance', 'tuition', 'lab fee', 'textbook', 'bus pass', 'laundry', 'rice', 'eggs', 'milk', 'bread', 'soap', 'toothpaste', 'toilet paper', 'detergent', 'palm oil', 'crayfish', 'stockfish', 'groceries', 'beans', 'chicken', 'tomato', 'onion'];
  const ASK_LINE = 25; // the Mama tier
  const key = (name) => String(name || '').toLowerCase().replace(/,.*$/, '').replace(/[^a-z0-9 ]/g, '').trim();
  const has = (t, words) => words.some((w) => t.includes(w));

  // rules_v2.judge, without the model and the watched merchants.
  function judge(item, week, memory) {
    const k = key(item.name);
    const ratio = week.budget ? week.spent / week.budget : 0;
    const base = ratio >= 0.75 ? 'watching' : 'calm';
    const out = (label, react, mood, tags) => ({ label, react, mood, tags, key: k, price: item.price, name: item.name });
    const held = memory[k];
    if (held === 'need') return out('need', false, base, ['remembered']);
    const blown = week.spent + item.price > week.budget;
    if (held === 'want') return blown ? out('want', true, 'shocked', ['remembered', 'blown']) : out('want', false, base, ['remembered', 'fits']);
    if (has(k, PROTECTED)) return out('need', false, base, ['protected']);
    if (item.price < ASK_LINE) return out('want', false, base, ['small']);
    return out('ask', false, 'watching', ['ask']);
  }

  // Her lines, per grandma. From writer.js; the shocked line for each is the one her clip says.
  const LINES = {
    mama: { name: 'Mama', ask: ['{item}? Tell me the story first.', '{item}. What is it for?', 'Hold on. {item}, {price}. What is the occasion?'], ackNeed: 'Okay. I will remember.', ackFits: 'Ehen. Within the week. No wahala.', shocked: 'Ehn ehn. {price} for {item}, with {left} left this week. You are sure?', agreed: 'Good. I am watching the cart.', proud: 'My pikin. Come and hug me.', down: 'That is the week gone. {over} over, on {item}.', bought: 'Noted. It is in the book.', nod: 'Ehen. Carry on.' },
    nana: { name: 'Nana', ask: ['Hold on a sec, hon. What’s {item} for?', '{item}? What’s that for?', '{item}, {price}. What’s the occasion?'], ackNeed: 'Okay. Noted.', ackFits: 'Okay, hon. That fits.', shocked: 'Well. {price} for {item}, with {left} left this week. I’ll just leave that there.', agreed: 'Good call, hon.', proud: 'Well look at you. Good for you, hon.', down: 'Okay. {over} over the week, on {item}. I’m not going to say anything.', bought: 'Alright. Noted.', nod: 'Looks good, hon.' },
    abuela: { name: 'Abuela', ask: ['{item}? What is it for, mija?', '{item}, {price}. Tell me what for.', 'Hold on, mi cielo. {item}. What is it for?'], ackNeed: 'Okay, mija. Noted.', ackFits: 'Órale. Within the week.', shocked: 'Híjole. {price} for {item}, mija, with {left} left. There is food in the house.', agreed: 'Bueno. I am watching, mija.', proud: 'Ay, mija. That is my girl.', down: '{over} over the week, on {item}. Ay. Monday we start again.', bought: 'Okay. It is written.', nod: 'Está bien. Go on.' },
    wong: { name: 'Grandma Wong', ask: ['{item}? What is it for?', '{item}. Tell me what for.', '{item}, {price}. What for?'], ackNeed: 'Okay. Noted.', ackFits: 'Fine. It fits.', shocked: '{price} for {item}. {left} left. Did the free ones break?', agreed: 'Good. I am watching.', proud: 'Good. You kept it.', down: '{over} over, on {item}. Hm. Monday.', bought: 'Noted.', nod: 'Fine.' },
  };
  const FACE = (who, mood) => `/assets/faces/${who}/${mood}.svg`;
  const RING = { mama: 'mint', nana: 'orange', abuela: 'rose', wong: 'jade' };

  const money = (n) => `$${Math.round(n)}`;
  const fill = (t, v, week) => t.replace('{item}', v.name).replace('{price}', money(v.price)).replace('{left}', money(Math.max(0, week.budget - week.spent))).replace('{over}', money(Math.max(0, week.spent - week.budget)));
  const pick = (arr, seed) => arr[seed % arr.length];

  // state
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  let who = store.get('mb-try-who', 'mama');
  let memory = store.get('mb-try-memory', {});
  let week = store.get('mb-try-week', { budget: 75, spent: 50, kept: 40 });
  const asked = new Set(); const reacted = new Set();
  let pending = null; // { verdict, resolve }

  const items = $('#items'), bubble = $('#bubble'), card = $('#card'), badge = $('#badge');
  const tile = $('#card-tile'), face = $('#card-face'), badgeFace = $('#badge-face'), badgeRing = $('#badge-ring'), meter = $('#meter-fill');

  function paintWeek() {
    const left = Math.max(0, week.budget - week.spent);
    const ratio = week.spent / week.budget;
    $('#week-line').textContent = `${money(week.spent)} of ${money(week.budget)} fun money gone this week. ${money(left)} left.`;
    meter.style.height = `${Math.round(Math.max(0.08, Math.min(1, ratio)) * 52)}px`;
    meter.style.backgroundColor = ratio >= 1 ? '#D4462C' : ratio >= 0.75 ? '#E2A12A' : '#0F7B5A';
    store.set('mb-try-week', week);
  }
  function paintTotals() {
    const rows = [...items.querySelectorAll('.row:not(.leaving)')];
    const total = rows.reduce((s, r) => s + Number(r.dataset.price), 0);
    $('#subtotal').textContent = money(total); $('#total').textContent = money(total);
    const inCart = new Set(rows.map((r) => r.dataset.name));
    for (const b of document.querySelectorAll('.add button')) b.disabled = inCart.has(b.dataset.add);
  }
  function setFace(mood) { badgeFace.src = FACE(who, mood); badge.dataset.mood = mood; }
  function say(line, num = '', ms = 4500) {
    $('#bubble-say').textContent = line; $('#bubble-num').textContent = num; bubble.hidden = false;
    clearTimeout(say.t); say.t = setTimeout(() => { bubble.hidden = true; }, ms);
  }
  function closeCard() { card.hidden = true; pending = null; for (const r of items.querySelectorAll('.row.marked')) r.classList.remove('marked'); }

  function ask(v) {
    const L = LINES[who];
    return new Promise((resolve) => {
      pending = { verdict: v, resolve };
      tile.className = `tile ${RING[who]}`; face.src = FACE(who, v.react ? 'shocked' : 'watching'); setFace(v.react ? 'shocked' : 'watching');
      card.dataset.tone = v.react ? 'alarm' : 'ask';
      const left = Math.max(0, week.budget - week.spent);
      if (v.react) {
        $('#card-line').textContent = fill(L.shocked, v, week);
        $('#card-sub').textContent = `${money(v.price)} against ${money(left)} left this week.`;
        $('#card-primary').textContent = `You’re right, ${L.name}`; $('#card-secondary').textContent = 'Buy anyway';
        badge.classList.remove('shake'); void badge.offsetWidth; badge.classList.add('shake');
        if (who === 'mama' && v.price === 179) playClip('/audio/mama.mp3');
      } else {
        $('#card-line').textContent = fill(pick(L.ask, v.name.length), v, week);
        $('#card-sub').textContent = `${money(v.price)} against ${money(left)} left this week. She asks once and remembers.`;
        $('#card-primary').textContent = 'It’s for something'; $('#card-secondary').textContent = /s$/i.test(v.name) ? 'I just want them' : 'I just want it';
      }
      card.hidden = false;
      for (const r of items.querySelectorAll('.row')) r.classList.toggle('marked', r.dataset.name === v.name);
    });
  }

  $('#card-primary').addEventListener('click', () => pending && pending.resolve('primary'));
  $('#card-secondary').addEventListener('click', () => pending && pending.resolve('secondary'));

  // The conversation: judge every row, one card at a time, fresh verdict after every answer.
  let talking = false;
  async function talk() {
    if (talking) return; talking = true;
    try {
      for (;;) {
        const rows = [...items.querySelectorAll('.row:not(.leaving)')].map((r) => ({ name: r.dataset.name, price: Number(r.dataset.price) }));
        const verdicts = rows.map((it) => judge(it, week, memory));
        paintWeek();
        const react = verdicts.find((v) => v.react && !reacted.has(v.key));
        const first = verdicts.find((v) => v.label === 'ask' && !asked.has(v.key));
        const L = LINES[who];
        if (react) {
          reacted.add(react.key);
          const choice = await ask(react);
          closeCard();
          if (choice === 'primary') {
            say(L.agreed);
            const row = items.querySelector(`.row[data-name="${CSS.escape(react.name)}"]`);
            setTimeout(() => { row.classList.add('leaving'); setTimeout(() => { row.remove(); paintTotals(); week.kept += react.price; setFace('proud'); say(L.proud, `${money(react.price)} stays in the week. Kept: ${money(week.kept)}.`); }, 250); }, 900);
            return;
          }
          week.spent += react.price; paintWeek();
          const over = week.spent > week.budget;
          setFace(over ? 'down' : 'calm');
          say(fill(over ? L.down : L.bought, react, week), `${money(react.price)} on ${react.name}. ${money(week.spent)} of ${money(week.budget)} gone this week.`);
          return;
        }
        if (first) {
          asked.add(first.key);
          const choice = await ask(first);
          closeCard();
          memory[first.key] = choice === 'primary' ? 'need' : 'want'; store.set('mb-try-memory', memory);
          if (choice === 'primary') { setFace('calm'); say(L.ackNeed, `${money(first.price)}. Needs stay off the meter.`); return; }
          const again = judge(first, week, memory);
          if (!again.react) { setFace('calm'); say(L.ackFits, `${money(first.price)} against ${money(Math.max(0, week.budget - week.spent))} left this week. It fits.`); return; }
          continue; // a want that blows the week: the card comes right back, shocked
        }
        setFace(week.spent / week.budget >= 0.75 ? 'watching' : 'calm');
        return;
      }
    } finally { talking = false; }
  }

  function addItem(name, price) {
    const li = document.createElement('li'); li.className = 'row'; li.dataset.name = name; li.dataset.price = String(price);
    const t = document.createElement('span'); t.className = 'thumb';
    const n = document.createElement('span'); n.className = 'name'; n.textContent = name;
    const p = document.createElement('span'); p.className = 'price'; p.textContent = money(price);
    li.append(t, n, p); items.append(li); paintTotals();
    const v = judge({ name, price }, week, memory);
    if (v.label === 'need' || v.tags.includes('small')) say(LINES[who].nod, v.label === 'need' ? 'A need. She says nothing.' : 'Small. A nod, nothing more.', 2800);
    setTimeout(talk, 350);
  }
  for (const b of document.querySelectorAll('.add button')) b.addEventListener('click', () => { if (items.querySelector(`.row[data-name="${CSS.escape(b.dataset.add)}"]`)) return; addItem(b.dataset.add, Number(b.dataset.cost)); });

  // who checks on you
  function paintWho() {
    for (const b of document.querySelectorAll('.who button')) b.setAttribute('aria-checked', String(b.dataset.who === who));
    badgeRing.className = `ring big`; badgeFace.src = FACE(who, badge.dataset.mood || 'calm');
    store.set('mb-try-who', who);
  }
  for (const b of document.querySelectorAll('.who button')) b.addEventListener('click', () => { who = b.dataset.who; closeCard(); bubble.hidden = true; paintWho(); talk(); });

  $('#try-reset').addEventListener('click', () => {
    memory = {}; week = { budget: 75, spent: 50, kept: 40 }; asked.clear(); reacted.clear();
    store.set('mb-try-memory', memory); store.set('mb-try-week', week);
    for (const r of [...items.querySelectorAll('.row')].slice(2)) r.remove();
    closeCard(); bubble.hidden = true; paintTotals(); paintWeek(); setFace('calm');
  });

  // audio: one clip at a time, the button shows what is playing
  let current = null, currentBtn = null;
  function playClip(src, btn) {
    if (current) { current.pause(); currentBtn && currentBtn.classList.remove('playing'); }
    current = new Audio(src); currentBtn = btn || null; btn && btn.classList.add('playing');
    current.addEventListener('ended', () => btn && btn.classList.remove('playing'));
    current.play().catch(() => btn && btn.classList.remove('playing'));
  }
  for (const b of document.querySelectorAll('.hear')) b.addEventListener('click', () => {
    if (currentBtn === b && current && !current.paused) { current.pause(); b.classList.remove('playing'); return; }
    playClip(b.dataset.audio, b);
  });

  // the closing sentence lights up word by word
  (() => {
    const h = $('.reveal');
    if (!h || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    h.innerHTML = h.textContent.trim().split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
    const words = [...h.querySelectorAll('.w')];
    const io = new IntersectionObserver((es) => { if (!es[0].isIntersecting) return; words.forEach((w, i) => setTimeout(() => w.classList.add('lit'), 120 * i)); io.disconnect(); }, { threshold: 0.6 });
    io.observe(h);
  })();

  // boot: the cart as it is, then the AirPods land once the frame is in view, so she asks in front of you
  paintWho(); paintTotals(); paintWeek(); setFace('calm');
  let landed = false;
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting || landed) return; landed = true; io.disconnect();
    setTimeout(() => { if (!items.querySelector('.row[data-name="AirPods Pro"]')) addItem('AirPods Pro', 179); }, 1500);
  }, { threshold: 0.5 });
  io.observe($('#frame'));
})();
