/* the live app tiles wait their turn: none starts until the hero cube has drawn its first frame (or 2.5s have
   passed), and then each only when it is nearly on screen. They share the page's main thread, so five copies of the
   app starting at once used to hold the cube back. */
(() => {
  const fs = [...document.querySelectorAll('iframe[data-src]')]; if (!fs.length) return;
  // Phones and tablets: every live tile is a whole copy of the app, and Safari on iPhone runs them all in one
  // process. Starting the frame styles' three full apps together (plus the tour's five) used up its memory and the
  // page crashed. There, tiles start one after another, and a tile far off screen is emptied until you come back
  // (the radio is kept, so its music plays on).
  const lite = matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
  const queue = []; let busy = false;
  const next = () => {
    if (busy) return; const f = queue.shift(); if (!f) return;
    busy = true; let done = false;
    const free = () => { if (done) return; done = true; busy = false; setTimeout(next, 250); };
    f.addEventListener('load', free, { once: true }); setTimeout(free, 5000);
    f.src = f.dataset.src;
  };
  // loading="lazy" is dropped as the source is set: Safari never counts a frame placed deep in 3D (the tour) as
  // near the screen, so it would leave it blank
  const load = (f) => {
    if (f.dataset.on) return; f.dataset.on = '1'; f.removeAttribute('loading');
    if (lite) { queue.push(f); next(); } else f.src = f.dataset.src;
  };
  const unload = (f) => {
    if (!f.dataset.on || /solo=radio/.test(f.dataset.src)) return;
    const q = queue.indexOf(f); if (q >= 0) queue.splice(q, 1);
    delete f.dataset.on; f.src = 'about:blank';
  };
  let started = false;
  const go = () => {
    if (started) return; started = true;
    if (!('IntersectionObserver' in window)) { fs.forEach(load); return; }
    // a frame inside a 3D scene is watched through its section, whose box is plain and flat
    const box = (f) => f.closest('.scene') || f;
    const boxes = new Set(fs.map(box));
    const each = (b, fn) => fs.forEach((f) => { if (box(f) === b) fn(f); });
    const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) each(e.target, load); }), { rootMargin: '800px 0px' });
    boxes.forEach((b) => near.observe(b));
    if (lite) {
      const far = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) each(e.target, unload); }), { rootMargin: '1100px 0px' });
      boxes.forEach((b) => far.observe(b));
    }
  };
  const soon = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 600 }) : setTimeout(go, 100));
  if (window.__krnlCube) soon(); else addEventListener('krnl:cube', soon, { once: true });
  setTimeout(go, 2500);
})();

/* KRNL0 site — the live mini-board, the departure board, FAQ and reveals. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const OK = 'ok', SIG = '&gt;';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── state: a tiny board.json ───────────────────────────── */
  const board = {
    todos: [
      { text: 'Review lecture notes', done: false },
      { text: 'Linear algebra set', done: true },
      { text: 'Essay outline', done: false },
    ],
    habits: [
      { name: 'Morning run', color: 'var(--acid)', cells: [1, 1, 0, 1, 1, 1, 0], streak: 3 },
      { name: 'Read 20 pages', color: 'var(--cyan)', cells: [0, 1, 1, 1, 0, 1, 0], streak: 1 },
    ],
    today: 6,
    pomo: { running: false, total: 25, left: 25 * 60, label: 'deep work', session: 0, timer: null },
    edge: null, // habit name wired to pomo:onComplete
  };

  const todoList = $('#todo-list');
  const habitList = $('#habit-list');
  const log = $('#term-log');
  const input = $('#term-input');
  const pomoEl = $('#pomo');
  const clock = $('#clock');
  const fill = $('#pill-fill');
  const meta = $('#pomo-meta');
  const label = $('#pomo-label');
  const pomoBtn = $('#pomo-btn');
  const wireHabit = $('#wire-habit');
  const wireTodo = $('#wire-todo');
  const mini = $('.mini');
  if (todoList) (() => {

  /* ── render ─────────────────────────────────────────────── */
  function renderTodos(newIndex) {
    todoList.innerHTML = '';
    board.todos.forEach((t, i) => {
      const li = document.createElement('li');
      if (t.done) li.className = 'done';
      if (i === newIndex) li.classList.add('new');
      const box = document.createElement('span');
      box.className = 'box';
      box.setAttribute('aria-hidden', 'true');
      
      li.append(box, document.createTextNode(t.text));
      todoList.append(li);
    });
    $('#todo-count').textContent = `(${board.todos.filter(t => !t.done).length})`;
  }

  function renderHabits(popName) {
    habitList.innerHTML = '';
    board.habits.forEach(h => {
      const row = document.createElement('div');
      row.style.setProperty('--hc', h.color);
      const name = document.createElement('div');
      name.className = 'h-name';
      name.innerHTML = `<span></span><span class="h-streak">▲ ${h.streak}</span>`;
      name.firstChild.textContent = h.name;
      const cells = document.createElement('div');
      cells.className = 'h-cells';
      cells.setAttribute('aria-label', `${h.name}: ${h.cells.filter(Boolean).length} of 7 days done`);
      h.cells.forEach((c, i) => {
        const cell = document.createElement('i');
        if (c) cell.classList.add('d');
        if (i === board.today) cell.classList.add('t');
        if (i === board.today && popName === h.name) cell.classList.add('pop');
        cells.append(cell);
      });
      row.append(name, cells);
      habitList.append(row);
    });
  }

  function renderPomo() {
    const p = board.pomo;
    const m = Math.floor(p.left / 60), s = p.left % 60;
    clock.innerHTML = `${String(m).padStart(2, '0')}<span class="colon">:</span>${String(s).padStart(2, '0')}`;
    fill.style.transform = `scaleY(${p.left / (p.total * 60)})`;
    meta.textContent = `session ${p.session} / 4`;
    label.textContent = p.running ? `· ${p.label}` : '· idle';
    pomoBtn.textContent = p.running ? 'Stop' : 'Start';
    pomoEl.classList.toggle('running', p.running);
  }

  /* wires follow the real node positions */
  function layoutWires() {
    const svg = $('.wires');
    if (!svg || getComputedStyle(svg).display === 'none') return;
    const box = mini.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const r = el => el.getBoundingClientRect();
    const a = r($('.n-todo')), b = r(pomoEl), c = r($('.n-habit'));
    const curve = (x1, y1, x2, y2) => {
      const dx = (x2 - x1) / 2;
      return `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    };
    wireTodo.setAttribute('d', curve(a.right - box.left, a.top - box.top + 40, b.left - box.left, b.top - box.top + 70));
    wireHabit.setAttribute('d', curve(b.right - box.left, b.top - box.top + 70, c.left - box.left, c.top - box.top + 44));
  }

  /* ── terminal ───────────────────────────────────────────── */
  function print(text, cls = '') {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.append(p);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function echo(cmd) {
    const p = document.createElement('p');
    p.className = 't-cmd';
    p.innerHTML = `<span class="t-path">~/krnl0</span> <span class="t-sig">${SIG}</span> `;
    p.append(document.createTextNode(cmd));
    log.append(p);
    log.scrollTop = log.scrollHeight;
  }

  const quoted = s => { const m = s.match(/"([^"]+)"|'([^']+)'/); return m ? (m[1] || m[2]) : null; };
  const findHabit = name => board.habits.find(h => h.name.toLowerCase() === (name || '').toLowerCase())
    || board.habits.find(h => h.name.toLowerCase().includes((name || '').toLowerCase()));

  function habitDone(h, via) {
    if (!h) return false;
    if (!h.cells[board.today]) { h.cells[board.today] = 1; h.streak += 1; }
    renderHabits(h.name);
    print(`${OK} habit "${h.name}" done today · streak ${h.streak}${via ? ' · ' + via : ''}`, 't-ok');
    return true;
  }

  function pomoComplete() {
    const p = board.pomo;
    clearInterval(p.timer); p.running = false; p.left = p.total * 60; p.session = Math.min(4, p.session + 1);
    renderPomo();
    pomoEl.classList.remove('flash'); void pomoEl.offsetWidth; pomoEl.classList.add('flash');
    print(`● pomo:onComplete · session ${p.session} / 4 logged`, 't-ok');
    if (board.edge) {
      wireHabit.classList.add('fire');
      setTimeout(() => wireHabit.classList.remove('fire'), 900);
      print(`↳ edge fired: pomo:onComplete → habit:markDone`, 't-dim');
      habitDone(findHabit(board.edge), 'via edge');
    } else {
      print('tip: wire it first — krnl edge add pomo "Morning run"', 't-dim');
    }
  }

  function pomoStart(minutes, lbl) {
    const p = board.pomo;
    clearInterval(p.timer);
    p.total = minutes; p.left = minutes * 60; p.running = true; p.label = lbl || p.label;
    renderPomo();
    print(`▶ pomo started · ${minutes} min · "${p.label}" (demo runs 60× fast)`, 't-ok');
    // demo speed: one real second = one minute of focus
    const step = reduced ? 60 * 5 : 60;
    p.timer = setInterval(() => {
      p.left = Math.max(0, p.left - step);
      renderPomo();
      if (p.left === 0) pomoComplete();
    }, reduced ? 1000 : 1000);
  }
  function pomoStop() {
    const p = board.pomo;
    clearInterval(p.timer); p.running = false; p.left = p.total * 60;
    renderPomo();
    print('■ pomo stopped', 't-dim');
  }

  const commands = [
    [/^help$/, () => {
      print('krnl task add "text"        add a todo', 't-dim');
      print('krnl task done "text"       tick it off', 't-dim');
      print('krnl habit done "name"      mark a habit for today', 't-dim');
      print('krnl edge add pomo "name"   wire the timer to a habit', 't-dim');
      print('krnl pomo start [--minutes 25] · krnl pomo stop', 't-dim');
      print('claude "plan my afternoon" · clear', 't-dim');
    }],
    [/^clear$/, () => { log.innerHTML = ''; }],
    [/^task add/, (c) => {
      const text = quoted(c) || c.replace(/^task add\s*/, '').trim();
      if (!text) return print('krnl: task add needs a title, e.g. krnl task add "Read chapter 4"', 't-err');
      board.todos.push({ text: text.slice(0, 60), done: false });
      if (board.todos.length > 5) board.todos.shift();
      renderTodos(board.todos.length - 1);
      print(`${OK} task added · "${text.slice(0, 60)}"`, 't-ok');
    }],
    [/^task done/, (c) => {
      const q = (quoted(c) || c.replace(/^task done\s*/, '')).toLowerCase();
      const t = board.todos.find(t => !t.done && t.text.toLowerCase().includes(q)) || board.todos.find(t => !t.done);
      if (!t) return print('krnl: nothing left to tick', 't-err');
      t.done = true; renderTodos();
      print(`${OK} done · "${t.text}"`, 't-ok');
    }],
    [/^habit done/, (c) => {
      const h = findHabit(quoted(c) || c.replace(/^habit done\s*/, '')) || board.habits[0];
      habitDone(h);
    }],
    [/^edge add/, (c) => {
      const h = findHabit(quoted(c) || 'Morning run') || board.habits[0];
      board.edge = h.name;
      wireHabit.classList.add('on');
      print(`${OK} edge pomo:onComplete → "${h.name}":markDone`, 't-ok');
    }],
    [/^pomo start/, (c) => {
      const m = c.match(/--minutes\s+(\d+)/);
      const l = c.match(/--label\s+"([^"]+)"/);
      pomoStart(Math.min(90, Math.max(1, m ? +m[1] : 25)), l && l[1]);
    }],
    [/^pomo stop/, () => pomoStop()],
  ];

  let busy = false;
  function run(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    echo(cmd);
    if (/^claude\b/.test(cmd)) return claude(quoted(cmd) || 'plan my afternoon');
    const c = cmd.replace(/^(krnl|sys)\s+/, '');
    const hit = commands.find(([re]) => re.test(c));
    if (hit) hit[1](c);
    else print(`krnl: unknown command "${cmd.slice(0, 40)}" — try help`, 't-err');
  }

  function claude(ask) {
    if (busy) return;
    busy = true;
    print(`◆ claude · "${ask}"`, 't-ai');
    print('► reading board.json and skills/plan-session.md', 't-dim');
    const script = [
      'krnl task add "Outline chapter 3"',
      'krnl task add "Draft section 3.1"',
      'krnl edge add pomo "Read 20 pages"',
      'krnl pomo start --minutes 25 --label "outline"',
    ];
    script.forEach((s, i) => setTimeout(() => {
      print(`► ${s}`, 't-ai');
      run(s);
      if (i === script.length - 1) { print(`${OK} afternoon planned · pomo armed`, 't-ai'); busy = false; }
    }, 700 * (i + 1)));
  }

  $('#term-form').addEventListener('submit', e => {
    e.preventDefault();
    run(input.value);
    input.value = '';
  });
  $$('.chip').forEach(b => b.addEventListener('click', () => { run(b.dataset.cmd); }));
  pomoBtn.addEventListener('click', () => run(board.pomo.running ? 'krnl pomo stop' : 'krnl pomo start'));

  renderTodos(); renderHabits(); renderPomo();
  layoutWires();
  addEventListener('resize', layoutWires);
  document.fonts && document.fonts.ready.then(layoutWires);

  })();

  /* ── departure board rows ───────────────────────────────── */
  const rows = $$('.row');
  function openRow(row) {
    rows.forEach(r => {
      r.classList.toggle('open', r === row);
      r.setAttribute('aria-expanded', r === row ? 'true' : 'false');
      const old = $('.r-detail', r); if (old) old.remove();
    });
    const d = document.createElement('span');
    d.className = 'r-detail';
    d.textContent = row.dataset.detail;
    row.append(d);
  }
  rows.forEach(r => r.addEventListener('click', () => openRow(r)));
  const firstOpen = $('.row.open'); if (firstOpen) openRow(firstOpen);

  /* ── FAQ index ──────────────────────────────────────────── */
  const qs = $$('.q');
  const aText = $('#a-text');
  const phone = matchMedia('(max-width: 640px)');
  qs.forEach(q => {
    const inline = document.createElement('p');
    inline.className = 'q-inline';
    inline.textContent = q.dataset.a;
    q.after(inline);
    q.setAttribute('aria-expanded', q.classList.contains('on'));
    const pick = () => {
      if (q.classList.contains('on') && !phone.matches) return;
      qs.forEach(o => { o.classList.toggle('on', o === q); o.setAttribute('aria-expanded', o === q); o.nextElementSibling.classList.toggle('show', o === q); });
      aText.classList.add('fade');
      setTimeout(() => { aText.textContent = q.dataset.a; aText.classList.remove('fade'); }, 150);
    };
    q.addEventListener('click', pick);
    q.addEventListener('focus', () => { if (!phone.matches) pick(); });
    q.addEventListener('mouseenter', () => { if (!phone.matches) pick(); });
  });
  if (qs[0]) qs[0].nextElementSibling.classList.add('show');

  /* ── entrances: staggered per section ───────────────────── */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px 30% 0px' }) : null;
  $$('section').forEach(sec => {
    $$('.reveal', sec).forEach((el, i) => {
      el.style.setProperty('--d', `${Math.min(i, 6) * 75}ms`);
      if (io) io.observe(el); else el.classList.add('in');
    });
  });
  document.documentElement.classList.add('ready');
})();

/* video loops: pause under reduced motion, and whenever off screen */
(() => {
  const vids = [...document.querySelectorAll('video.loop')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { vids.forEach(v => { v.removeAttribute('autoplay'); v.pause(); }); return; }
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }));
  vids.forEach(v => io.observe(v));
})();

/* the embedded app renders at a real desktop width, scaled to its tile */
document.querySelectorAll('.app-view').forEach((box) => {
  const fit = () => { const f = box.querySelector('iframe'); if (f) box.style.setProperty('--app-scale', (box.clientWidth / f.offsetWidth).toFixed(4)); };
  new ResizeObserver(fit).observe(box); fit();
});

/* frame styles: three live windows in a stack; a tab brings one to the front */
(() => {
  const tabs = [...document.querySelectorAll('.looks-tabs [role="tab"]')];
  const looks = [...document.querySelectorAll('.look')];
  // each window holds a slot in the stack (0 back … 2 front). Picking one shuffles it like a card:
  // it slides out to the side, is laid on top, and slides back in, so no two windows ever pass through each other
  let order = looks.map((_, i) => i);                       // back → front
  const place = () => order.forEach((li, s) => { looks[li].style.setProperty('--s', String(s)); looks[li].style.zIndex = String(s + 1); looks[li].dataset.front = String(s === order.length - 1); });
  place();
  let busy = 0;
  tabs.forEach((t) => t.addEventListener('click', () => {
    const pick = +t.dataset.look;
    tabs.forEach((o) => o.setAttribute('aria-selected', o === t ? 'true' : 'false'));
    if (order[order.length - 1] === pick) return;
    const el = looks[pick];
    clearTimeout(busy);
    el.classList.add('out');                                // 1. pull it out to the side, still behind
    busy = setTimeout(() => {
      order = order.filter((i) => i !== pick).concat(pick); // 2. lay it on top while it is clear of the others
      place();
      requestAnimationFrame(() => el.classList.remove('out'));   // 3. slide it home on top
    }, 320);
  }));
})();

/* scroll depth: the sound words drift apart, the radio floats, the looks fan out */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rows = [...document.querySelectorAll('[data-par]')], ys = [...document.querySelectorAll('[data-par-y]')];
  // on phones and tablets the stack holds still: re-tilting three whole app windows on every scroll frame is what
  // made Safari repaint them over and over
  const stage = matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches ? null : document.querySelector('.looks-stage');
  let raf = 0;
  const pos = (el) => { const r = el.getBoundingClientRect(); return (r.top + r.height / 2 - innerHeight / 2) / innerHeight; };   // -1 … 1 across the screen
  const tick = () => {
    raf = 0;
    rows.forEach((el) => el.style.setProperty('--px', `${(pos(el) * +el.dataset.par).toFixed(1)}px`));
    ys.forEach((el) => el.style.setProperty('--py', `${(pos(el) * +el.dataset.parY).toFixed(1)}px`));
    if (stage) stage.style.setProperty('--sp', Math.min(1, Math.max(0, 0.6 - pos(stage))).toFixed(3));
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  addEventListener('resize', tick); tick();
})();

/* opened straight from disk: the app is built as one classic script, so every embed runs live on file:// too */

/* hero tiles: a line that types itself, a save that keeps happening */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = [...document.querySelectorAll('.hl-line[data-type]')];
  const type = (el, done) => {
    const text = el.dataset.type;
    if (reduced) { el.textContent = text; done && done(); return; }
    let i = 0; el.textContent = '';
    const step = () => { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 38 + Math.random() * 40); else done && done(); };
    step();
  };
  const reply = document.querySelector('.hl-reply');
  const loop = (el) => {
    const isClaude = el.classList.contains('hl-claude');
    if (isClaude && reply) reply.classList.remove('on');
    type(el, () => {
      if (isClaude && reply) setTimeout(() => reply.classList.add('on'), 450);
      if (!reduced) setTimeout(() => loop(el), 5200);
    });
  };
  lines.forEach((el, i) => setTimeout(() => loop(el), 600 + i * 900));
  const ago = document.querySelector('.hl-ago'), dot = document.querySelector('.hl-dot');
  if (ago) {
    let s = 0;
    setInterval(() => {
      s++;
      if (s >= 7) { s = 0; if (dot && !reduced) { dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse'); } }
      ago.textContent = s === 0 ? 'saved just now' : `saved ${s}s ago`;
    }, 1000);
  }
})();

/* hero: today's plan with a needle at the real time */
(() => {
  const box = document.querySelector('.h-today'); if (!box) return;
  const now = box.querySelector('.ht-now');
  const tick = () => {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    box.style.setProperty('--n', `${(Math.min(22, Math.max(6, h)) - 6) / 16 * 100}%`);
    now.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  tick(); setInterval(tick, 30000);
})();

/* parts: pick a word card, the real node opens in the big card */
(() => {
  const btns = [...document.querySelectorAll('.pick-b')];
  const view = document.querySelector('.pick-view'); if (!view) return;
  const frame = view.querySelector('iframe');
  const names = { pomo: 'timer', todo: 'to-do list', habit: 'habit tracker', calendar: 'calendar', clock: 'day clock', radio: 'Ambient Radio' };
  btns.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    btns.forEach((o) => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    const k = b.dataset.solo, radio = k === 'radio';
    view.classList.add('loading');
    setTimeout(() => {
      view.classList.toggle('is-radio', radio);
      if (frame) { frame.src = `app/index.html?solo=${k}&${radio ? 'fit' : 'bare'}=1`; frame.title = `The real ${names[k]}`; }
    }, 180);
  }));
  if (frame) frame.addEventListener('load', () => setTimeout(() => view.classList.remove('loading'), 250));
})();
/* looks: the tile follows the chosen frame style */
(() => {
  const box = document.querySelector('.looks'); if (!box) return;
  const set = () => { const f = box.querySelector('.look[data-front="true"]'); if (f) box.dataset.look = String([...box.querySelectorAll('.look')].indexOf(f)); };
  box.querySelectorAll('.looks-tabs [role="tab"]').forEach((t) => t.addEventListener('click', () => setTimeout(set, 330)));
  set();
})();

/* parts: tap a card, it flips over to the real node; "Back" flips it again. One open at a time. */
(() => {
  const cards = [...document.querySelectorAll('.flip')];
  const close = (c) => { c.classList.remove('open'); c.setAttribute('aria-expanded', 'false'); };
  cards.forEach((c) => {
    c.setAttribute('aria-expanded', 'false');
    c.addEventListener('click', (e) => {
      if (c.classList.contains('open')) { close(c); return; }   // the opened part is a showcase: a tap anywhere on it turns it back
      cards.forEach((o) => o !== c && close(o));
      const back = c.querySelector('.back');
      if (!back.firstChild) {
        const k = c.dataset.solo, radio = k === 'radio';
        if (radio) { const img = document.createElement('img'); img.src = 'assets/stills/radio.webp'; img.alt = 'The KRNL0 Ambient Radio: rain, fire, synth, white, brown noise and YouTube layers'; img.className = 'still-radio'; back.append(img); c.classList.add('open'); c.setAttribute('aria-expanded', 'true'); return; }
        const f = document.createElement('iframe');
        f.src = `app/index.html?solo=${k}&${radio ? 'fit' : 'bare'}=1`; f.title = c.getAttribute('aria-label').replace('Open ', 'The ');
        f.setAttribute('allow', 'autoplay; encrypted-media'); f.tabIndex = -1;
        if (radio) { const w = document.createElement('span'); w.className = 'fit'; w.append(f); back.append(w); w.style.setProperty('--fs', Math.min(1.3, (back.clientWidth - 20) / 300).toFixed(3)); }
        else {
          // the part is laid out at its own full size, then scaled down to the card, so the whole of it shows
          const SIZE = { pomo: [400, 330], todo: [380, 300], habit: [400, 300], clock: [420, 600], calendar: [760, 520], analytics: [760, 560], term: [900, 560] };
          const [w, h] = SIZE[k] || [600, 500];
          const box = document.createElement('span'); box.className = 'fit-part'; box.append(f); back.append(box);
          f.style.width = w + 'px'; f.style.height = h + 'px';
          const size = () => {
            // scale so the part's full content fits, then give the frame the card's exact shape: the part fills the card edge to edge
            const bw = box.clientWidth, bh = box.clientHeight; if (!bw || !bh) return;
            const s = Math.min(1, bw / w, bh / h);
            f.style.width = (bw / s) + 'px'; f.style.height = (bh / s) + 'px';
            f.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
          };
          requestAnimationFrame(size); setTimeout(size, 750); addEventListener("resize", size);
        }
      }
      c.classList.add('open'); c.setAttribute('aria-expanded', 'true');
    });
  });
})();

/* the radio embeds are exactly the widget: when it grows (layers added), its frame grows with it */
addEventListener('message', (e) => {
  const h = e.data && e.data.krnlRadio; if (!h) return;
  document.querySelectorAll('iframe[src*="solo=radio"]').forEach((f) => {
    if (f.contentWindow !== e.source) return;
    f.style.height = `${h}px`;
    const box = f.closest('.sound-radio'); if (box) box.style.setProperty('--rh', String(h));
  });
});

/* hero: the day's blocks are liquid jelly (soft bodies), drawn through an SVG goo filter.
   A held block goes where the pointer says; the others slide with friction. Where two blocks (or a block and the
   day's end) meet, a soft contact force pushes them apart while each draws its share of the overlap as a squash on
   that side, bulging a little taller. The moment of impact kicks an under-damped spring, so a hard hit shudders
   through both blocks; speed makes a block lean. Through the goo filter, touching blocks melt into one blob and
   stretch a neck as they pull apart. A flick throws a block; arrow keys nudge a focused one.
   On first sight the day shows it is alive: Gym slides into Drafts, melts, and pulls free. */
(() => {
  const track = document.querySelector('.ht-track'); if (!track) return;
  const layer = track.querySelector('.ht-goo');
  const els = [...track.querySelectorAll('.ht-b')];
  const hint = document.querySelector('.ht-hint');
  if (!els.length || !layer) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = { K: 240, stick: 240 * 24, MAXO: 34, friction: 4.5, qk: 420, qc: 6, bulge: 0.45, impact: 0.011, impactMax: 6, lean: 8, kk: 240, kc: 6, grab: 3 };

  // the goo itself: blur the blocks together, then cut the blur back to a hard edge
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const filt = document.createElementNS(NS, 'filter'); filt.id = 'krnl-goo';
  filt.setAttribute('x', '-10%'); filt.setAttribute('y', '-60%'); filt.setAttribute('width', '120%'); filt.setAttribute('height', '220%');
  const fe = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); filt.append(n); };
  fe('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '5', result: 'b' });
  fe('feColorMatrix', { in: 'b', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8', result: 'g' });
  fe('feComposite', { in: 'SourceGraphic', in2: 'g', operator: 'atop' });
  svg.append(filt); document.body.append(svg);
  layer.style.filter = 'url(#krnl-goo)';

  const LABEL_MIN = 0.6;    // a name may be squeezed to 60% of its width, never more
  const B = els.map((el) => ({ el, name: el.querySelector('.ht-n'), x0: 0, x: 0, w: 0, tw: 0, fit: false, minW: 0, cap: 0, v: 0, q: 0, qv: 0, k: 0, kv: 0, home: 0 }));
  const touching = new Array(B.length + 1).fill(false), kicked = new Array(B.length + 1).fill(-1e9);
  const rng = document.createRange();
  let W = 0, drag = null, raf = 0, last = 0, placed = false, used = false;

  function measure() {
    const pw = W; W = track.clientWidth;
    B.forEach((b) => {
      b.el.style.transform = ''; if (b.name) b.name.style.transform = '';
      b.x0 = b.el.offsetLeft; b.w = b.el.offsetWidth;
      if (b.name) { rng.selectNodeContents(b.name); b.tw = rng.getBoundingClientRect().width; }
      b.fit = !!b.name && b.tw + 8 <= b.w;
      if (b.name) b.name.classList.toggle('nofit', !b.fit);
      // the squish limit: a named block never gets narrower than its squeezed name; a bare one keeps 45% of itself; every block can give at least a fifth
      b.minW = Math.min(b.w * 0.8, b.fit ? b.tw * LABEL_MIN + 4 : b.w * 0.45);
      b.cap = b.w - b.minW;
    });
    B.forEach((b) => { b.home = b.x0; b.x = placed && pw ? b.x * W / pw : b.x0; });
    placed = true; paint();
  }
  const over = (i) => { const b = B[i], a = B[i - 1], c = B[i + 1]; return [a ? a.x + a.w - b.x : -b.x, c ? b.x + b.w - c.x : b.x + b.w - W]; };
  // contact j sits between B[j-1] and B[j]; contacts 0 and B.length are the two ends of the day
  const depth = (j) => { const a = B[j - 1], b = B[j]; return a && b ? a.x + a.w - b.x : !a ? -b.x : a.x + a.w - W; };
  // two blocks share a contact half each, so each side may take its full squish allowance; an end of the day gives
  // nothing back, so the block takes all of that one and may only spend half its allowance there
  const lim = (j) => { const a = B[j - 1], b = B[j]; return Math.min(P.MAXO, a && b ? Math.min(a.cap, b.cap) : (a || b).cap / 2); };

  // nothing is pushed through anything, nothing is squeezed past its limit, nothing leaves the lane. The contacts form
  // one chain, so this is solved exactly in sweeps (not nudged pair by pair, which fought itself and made a held squeeze
  // stutter): first outward from the held block, then in from each end of the day, which stops the held block only
  // when the row truly has no give left.
  function hold() {
    const n = B.length, h = drag ? drag.i : -1, x0 = B.map((b) => b.x);
    if (h >= 0) {
      for (let i = h + 1; i < n; i++) B[i].x = Math.max(B[i].x, B[i - 1].x + B[i - 1].w - lim(i));
      for (let i = h - 1; i >= 0; i--) B[i].x = Math.min(B[i].x, B[i + 1].x - B[i].w + lim(i + 1));
    }
    for (let i = 0; i < n; i++) B[i].x = Math.max(B[i].x, i ? B[i - 1].x + B[i - 1].w - lim(i) : -lim(0));
    for (let i = n - 1; i >= 0; i--) B[i].x = Math.min(B[i].x, i < n - 1 ? B[i + 1].x - B[i].w + lim(i + 1) : W - B[i].w + lim(n));
    B.forEach((b, i) => { if (i === h) return; if (b.x > x0[i] + 1e-6) b.v = Math.max(b.v, 0); else if (b.x < x0[i] - 1e-6) b.v = Math.min(b.v, 0); });
  }

  function step(dt, now) {
    const f = B.map(() => 0);
    for (let i = 0; i <= B.length; i++) {
      const a = B[i - 1], b = B[i];
      const o = depth(i);
      const closing = (a ? a.v : 0) - (b ? b.v : 0);
      // a contact begins at half a pixel and ends a pixel apart, and wobbles at most every 160ms, so a held squeeze
      // that hovers on the edge of touching never sets off a stream of shudders
      if (touching[i] && o < -1) {
        touching[i] = false;
        if (!still && now - kicked[i] > 160) {                  // they come apart: both spring back past their shape and wobble
          kicked[i] = now; const kick = 1.2 + Math.min(3, Math.max(0, -closing) * 0.006);
          if (a) a.qv -= kick; if (b) b.qv -= kick;
        }
      } else if (!touching[i] && o > 0.5) {
        touching[i] = true;
        const sp = Math.max(0, closing);
        if (!still && sp > 30 && now - kicked[i] > 160) {        // impact: both shudder, harder hits shudder more
          kicked[i] = now; const imp = Math.min(P.impactMax, sp * P.impact), lean = Math.min(40, sp / 14);
          if (a) { a.qv += imp; a.kv -= lean; }
          if (b) { b.qv += imp; b.kv += lean; }
        }
      }
      if (o <= 0) continue;
      const F = P.K * o + 22 * Math.max(0, closing);
      if (a) f[i - 1] -= F; if (b) f[i] += F;
    }
    // jelly first, sliding second: a block at rest holds its ground until it has been pressed about 24px deep, and a
    // moving one gives back part of every push, so a shove dents both blocks before it moves the other one
    B.forEach((b, i) => {
      if (drag && drag.i === i) return;
      const F = f[i], grip = !drag ? 0 : Math.abs(b.v) < 8 ? P.stick : P.stick * 0.6;   // let go, and they spring apart
      const Fe = Math.sign(F) * Math.max(0, Math.abs(F) - grip);
      b.v = (b.v + Fe * dt) * Math.exp(-P.friction * dt); b.x += b.v * dt;
    });
    hold();
  }

  function paint() {
    B.forEach((b, i) => {
      const a = B[i - 1], c = B[i + 1];
      const [oL, oR] = over(i), pl = Math.max(0, oL), pr = Math.max(0, oR);
      // exact contact: two blocks meet at the middle of their overlap, so they never overlap; at an end of the day the
      // end takes all of it, so a block never leaves the lane. The jelly spring then squeezes or stretches what is left
      // around its middle, never below the block's limit, and the lost width bulges up.
      const gl = a ? pl / 2 : pl, gr = c ? pr / 2 : pr;
      const cl = b.x + gl, vw = b.w - gl - gr;
      let ww = Math.max(b.minW, vw * (1 - b.q));
      // a pressed block never stretches; a free one only into half the gap on its tighter side, so two never meet mid-air
      ww = Math.min(ww, vw + (pl > 0 || pr > 0 ? 0 : Math.max(0, Math.min(-oL, -oR))));
      const L = Math.max(0, Math.min(W - ww, cl + (vw - ww) / 2));
      const sx = ww / b.w, sy = Math.min(1.25, Math.max(0.85, 1 + (1 - sx) * P.bulge));
      const k = b.k * Math.max(0, Math.min(1, Math.min(L, W - L - ww) / 14));   // no lean at the day's ends, so no corner pokes out
      b.el.style.transform = `translate3d(${(L - b.x0).toFixed(2)}px,0,0) skewX(${k.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      if (b.name && b.fit) {
        // the name is printed on the jelly: it squeezes with it, never below its limit, never past the edges
        const t = Math.max(LABEL_MIN, Math.min(1, 0.3 + 0.7 * sx, (ww - 4) / b.tw)), ty = 1 + (sy - 1) * 0.6;
        b.name.style.transform = `translate(-50%,-50%) scale(${(t / sx).toFixed(4)},${(ty / sy).toFixed(4)})`;
      }
    });
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - (last || now)) / 1000); last = now;
    // the held block heads for the pointer; where the row stops it, it stops. Its speed is how far it really moved,
    // so pressing into a jam reads as standing still: no lean, no shudder, no fling on release
    const hb = drag ? B[drag.i] : null, hx = hb ? hb.x : 0;
    if (hb) hb.x = drag.want;
    for (let s = 0; s < 4; s++) step(dt / 4, now);
    if (hb && dt > 0) hb.v += ((hb.x - hx) / dt - hb.v) * 0.45;
    let busy = !!drag;
    B.forEach((b, i) => {
      const [oL, oR] = over(i);
      const press = (Math.max(0, oL) + Math.max(0, oR)) / 2 / b.w;
      const sp = b.v;
      const qt = still ? 0 : Math.max(-0.14, Math.min(0.34, press > 0.002 ? press * 0.6 : -Math.min(0.12, Math.abs(sp) / 7000)));
      const kt = still ? 0 : Math.max(-P.lean, Math.min(P.lean, sp / 120));
      b.qv += (-(b.q - qt) * P.qk - b.qv * P.qc) * dt; b.q = Math.max(-0.3, Math.min(0.5, b.q + b.qv * dt));
      b.kv += (-(b.k - kt) * P.kk - b.kv * P.kc) * dt; b.k += b.kv * dt;
      if (still) { b.q = b.qv = b.k = b.kv = 0; }
      if (Math.abs(b.v) > 2 || Math.abs(b.qv) > 0.01 || Math.abs(b.q - qt) > 0.001 || Math.abs(b.kv) > 0.05 || Math.abs(b.k - kt) > 0.02 || oL > 0.05 || oR > 0.05) busy = true;
    });
    paint();
    raf = busy ? requestAnimationFrame(frame) : 0; if (!busy) last = 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const touched = () => { if (used) return; used = true; if (hint) hint.classList.add('gone'); };

  B.forEach((b, i) => {
    b.el.addEventListener('pointerenter', (e) => { if (!drag && e.pointerType === 'mouse' && !still) { b.qv -= 1.4; wake(); } });   // a wobble that says "touch me"
    b.el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault(); try { b.el.setPointerCapture(e.pointerId); } catch (_) {} touched();
      drag = { i, id: e.pointerId, off: e.clientX - b.x, want: b.x };
      b.v = 0; b.qv += P.grab; b.el.classList.add('grab'); wake();
    });
    b.el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      drag.want = Math.min(W - b.w / 2, Math.max(-b.w / 2, e.clientX - drag.off));   // hold() keeps it in the lane
      wake();
    });
    const end = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      b.v = still ? 0 : Math.max(-2200, Math.min(2200, b.v));           // a flick throws it, at the speed it really had
      drag = null; b.el.classList.remove('grab'); wake();
    };
    b.el.addEventListener('pointerup', end); b.el.addEventListener('pointercancel', end);
    b.el.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); touched(); b.v += d * (W / 64) * P.friction; wake();   // slides about a quarter hour
    });
  });

  measure(); if (document.fonts) document.fonts.ready.then(measure);
  new ResizeObserver(() => { if (track.clientWidth && track.clientWidth !== W) measure(); }).observe(track);

  // first sight: Gym slides into Drafts, melts into it with a shudder, then pulls free and goes home
  if (!still) {
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return; io.disconnect();
      const gym = B[4], dr = B[3]; if (!gym || !dr) return;
      setTimeout(() => {
        if (used) return;
        const gap = gym.x - (dr.x + dr.w);
        gym.v = -(Math.max(0, gap) * P.friction + 560); wake();
        setTimeout(() => { if (used) return; gym.v = Math.max(0, gym.home - gym.x) * P.friction; wake(); }, 1300);
        // and whatever it shoved drifts back too, so the day ends the way it started
        setTimeout(() => { if (used) return; B.forEach((b) => { if (Math.abs(b.home - b.x) > 1) b.v = (b.home - b.x) * P.friction; }); wake(); }, 2500);
      }, 1100);
    }, { threshold: 0.6 });
    io.observe(track);
  }
})();
