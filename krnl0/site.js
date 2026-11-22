/* KRNL0 home page. Everything on the page is readable without this file; it adds the live app
   parts, the cube you can turn, the day you can drag, the nine-apps scene, the day rail and the arrivals. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 861px)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n) => String(n).padStart(2, '0');

  /* Motion that behaves like a thing, not a film: a spring can be re-aimed at any moment and keeps
     its speed; past an edge things resist more and more; a throw lands where it was heading. */
  const spring = (response, ratio) => { const w = (2 * Math.PI) / response; return { k: w * w, c: 2 * ratio * w }; };
  const stepSpring = (o, to, sp, dt) => { o.v += (sp.k * (to - o.x) - sp.c * o.v) * dt; o.x += o.v * dt; };
  const band = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  const project = (v, rate = 0.996) => (v / 1000) * rate / (1 - rate);

  /* 1. Every live part is drawn at its own size and scaled to its frame, so nothing is ever cut off. */
  const MIN_PAN = 0.6;
  const fit = (el) => {
    const w = parseFloat(getComputedStyle(el).getPropertyValue('--w'));
    if (!w || !el.clientWidth) return;
    let s = el.clientWidth / w;
    if (el.classList.contains('pan')) {
      const pan = s < MIN_PAN;
      if (pan) s = MIN_PAN;
      if (pan !== el.classList.contains('is-pan')) {
        el.classList.toggle('is-pan', pan);
        // open on the middle of the week, where today is
        if (pan) {
          requestAnimationFrame(() => { el.scrollLeft = w > 1200 ? 0 : (el.scrollWidth - el.clientWidth) * 0.45; });
          const win = el.closest('.win');
          if (false && win && !win.querySelector('.pan-hint')) {
            const hint = document.createElement('span');
            hint.className = 'pan-hint';
            hint.textContent = 'Swipe sideways to see more';
            win.append(hint);
            let start0 = 0;
            const gone = () => { if (Math.abs(el.scrollLeft - start0) > 12 && hint.dataset.ready) { hint.classList.add('is-gone'); el.removeEventListener('scroll', gone); } };
            setTimeout(() => { hint.dataset.ready = '1'; start0 = el.scrollLeft; }, 600);
            el.addEventListener('scroll', gone, { passive: true });
          }
        }
      }
    }
    el.style.setProperty('--s', s.toFixed(4));
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
    $$('.fit').forEach((el) => { fit(el); ro.observe(el); });
  } else $$('.fit').forEach(fit);

  /* 2. The real app loads into a frame. The picture shows until then. Every frame is a whole app running on the page's own thread,
        so they load one at a time, only while the page is still, only near the screen, and far-away ones are put away again.
        On phones and slow connections they never load by themselves: a tap opens one. */
  const conn = navigator.connection || {};
  const manual = matchMedia('(pointer: coarse)').matches || innerWidth < 700 || !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
  const wake = (f) => {
    if (f.dataset.woke || !f.dataset.src) return;
    f.dataset.woke = '1';
    f.addEventListener('load', () => { if (f.dataset.woke) setTimeout(() => f.classList.add('is-live'), 450); }, { once: true });
    f.src = f.dataset.src;
  };
  const putAway = (f) => {
    if (!f.dataset.woke) return;
    delete f.dataset.woke;
    f.classList.remove('is-live');
    f.src = 'about:blank';
  };
  $$('iframe').forEach((f) => { f.tabIndex = -1; });
  if (manual) $$('.live').forEach((l) => { if (l.querySelector('iframe')) l.classList.add('is-manual'); });
  else if ('IntersectionObserver' in window) {
    let lastScroll = 0, busy = false;
    const queue = [];
    addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
    const pump = () => {
      if (busy || !queue.length) return;
      if (performance.now() - lastScroll < 180) { setTimeout(pump, 140); return; }
      const f = queue.shift();
      if (f.dataset.woke || f.dataset.want !== '1') { pump(); return; }
      busy = true;
      let over = false;
      const done = () => { if (over) return; over = true; busy = false; setTimeout(pump, 300); };
      f.addEventListener('load', done, { once: true });
      setTimeout(done, 5000);   // never wait for a frame that stays quiet
      wake(f);
    };
    const near = new IntersectionObserver((entries) => entries.forEach((e) => {
      const f = e.target;
      f.dataset.want = e.isIntersecting ? '1' : '0';
      if (e.isIntersecting && !f.dataset.woke && !queue.includes(f)) { queue.push(f); pump(); }
    }), { rootMargin: '1800px 0px' });
    const far = new IntersectionObserver((entries) => entries.forEach((e) => { if (!e.isIntersecting) putAway(e.target); }), { rootMargin: '3800px 0px' });
    $$('iframe[data-src]').forEach((f) => { near.observe(f); far.observe(f); });
  } else $$('iframe[data-src]').forEach(wake);
  if (!manual && 'fetch' in window) {
    const warm = () => {
      fetch('app/index.html').then((r) => (r.ok ? r.text() : '')).then((html) => {
        const m = /<script[^>]+src="\.\/(assets\/app-[^"]+\.js)"/.exec(html);
        if (!m) return;
        const l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = 'app/' + m[1];
        document.head.append(l);
      }).catch(() => {});
    };
    const later = () => ('requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 3000));
    if (document.readyState === 'complete') setTimeout(later, 1500); else addEventListener('load', () => setTimeout(later, 1500), { once: true });
  }
  // the radio is exactly its widget: when it grows (a sound is added), its frame grows with it
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const h = e.data && e.data.krnlRadio;
    if (!h || typeof h !== 'number') return;
    const frames = $$('iframe[data-src*="solo=radio"]');
    // the frame the message came from; Safari does not always give the same window object, so with one radio on the page it is that one
    const f = frames.find((x) => x.contentWindow === e.source) || (frames.length === 1 ? frames[0] : null);
    const box = f && f.closest('.live');
    if (box) { box.style.setProperty('--h', String(Math.max(320, Math.min(960, h)))); f.height = h; }
  });

  /* A live part waits for a click or tap before it takes the wheel, so scrolling the page never gets stuck inside it. */
  const lock = (live) => {
    if (!live.querySelector('iframe')) return;
    live.classList.add('is-locked');
    live.addEventListener(manual ? 'click' : 'pointerdown', (e) => {
      if (!live.classList.contains('is-locked')) return;
      live.classList.remove('is-locked');
      live.classList.add('is-active');
      const f = live.querySelector('iframe');
      if (f) wake(f);
      e.preventDefault();
    });
    live.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { live.classList.add('is-locked'); live.classList.remove('is-active'); } });
  };
  $$('.live').forEach(lock);
  document.addEventListener('pointerdown', (e) => {
    $$('.live:not(.is-locked)').forEach((l) => { if (!l.contains(e.target)) { l.classList.add('is-locked'); l.classList.remove('is-active'); } });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.live').forEach((l) => { l.classList.add('is-locked'); l.classList.remove('is-active'); }); });

  /* 3. The cube: six faces, the front one the nine parts of KRNL0. It builds itself, is lit by one
        lamp, leans toward the pointer, and can be grabbed, turned right round and thrown. */
  const hero = $('.hero');
  const cube = $('#cube');
  const scene = $('#cube-scene');
  if (hero && cube && scene) {
    const say = $('#cube-say');
    const sayText = say ? $('span', say) || say : null;
    const idle = sayText ? sayText.textContent : '';
    const tiles = $$('.f-front .t', cube);
    const pose = () => (wide.matches ? { x: -19, y: -31 } : { x: -18, y: -27 });
    let REST = pose();
    const TILT = [-66, 30];
    const SOFT = spring(0.9, 1), THROWN = spring(0.8, 0.68), ARRIVE = spring(1.6, 0.8);
    const rx = { x: REST.x, v: 0 }, ry = { x: REST.y, v: 0 };
    const aim = { x: 0, y: 0 };   // how far the pointer leans it away from rest
    let sp = SOFT, k = 1, turns = 0, held = false, moved = false, over = false, grab = null, trail = [], seen = true, raf = 0, t0 = 0;

    // the lamp: each face is shaded by how far it has turned away from it
    const LAMP = [-0.35, -0.35, 0.87];
    const faces = [['.f-front', 0, 0, 1], ['.f-back', 0, 0, -1], ['.f-right', 1, 0, 0], ['.f-left', -1, 0, 0], ['.f-top', 0, -1, 0], ['.f-bottom', 0, 1, 0]]
      .map(([sel, x, y, z]) => ({ el: $(sel, cube), x, y, z })).filter((f) => f.el);
    // shading and glare are elements of their own, so changing them never re-styles the tiles
    const swaying = fine.matches && !calm.matches;
    let litv = calm.matches ? 1 : 0;
    faces.forEach((f) => {
      f.shade = document.createElement('span');
      f.shade.className = 'shade';
      f.shade.setAttribute('aria-hidden', 'true');
      f.el.append(f.shade);
    });
    const front = faces.find((f) => f.z === 1 && f.x === 0 && f.y === 0);
    const glare = document.createElement('span');
    glare.className = 'glare';
    glare.setAttribute('aria-hidden', 'true');
    if (front) front.el.append(glare);
    const balls = $$('.core b', cube).map((el, i) => ({ el, p: [i < 4 ? -1 : 1, i % 4 < 2 ? -1 : 1, i % 2 ? 1 : -1] }));
    const paint = () => {
      cube.style.transform = 'rotateX(' + rx.x.toFixed(2) + 'deg) rotateY(' + ry.x.toFixed(2) + 'deg)';
      const counter = 'rotateY(' + (-ry.x).toFixed(2) + 'deg) rotateX(' + (-rx.x).toFixed(2) + 'deg)';
      balls.forEach((b) => { b.el.style.transform = 'translate3d(' + b.p[0] * 188 + 'px, ' + b.p[1] * 188 + 'px, ' + b.p[2] * 188 + 'px) ' + counter; });
      const a = (rx.x * Math.PI) / 180, b = (ry.x * Math.PI) / 180;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      faces.forEach((f) => {
        const x1 = f.x * cb + f.z * sb, z1 = -f.x * sb + f.z * cb;
        const y2 = f.y * ca - z1 * sa, z2 = f.y * sa + z1 * ca;
        const lit = x1 * LAMP[0] + y2 * LAMP[1] + z2 * LAMP[2];
        f.shade.style.opacity = (clamp((0.8 - lit) * 0.38, 0, 0.5) * litv).toFixed(3);
      });
      glare.style.backgroundPosition = 'calc(50% + ' + clamp((ry.x - REST.y - turns * 360) * 2.4, -70, 70).toFixed(1) + '%) 0';
      glare.style.opacity = litv.toFixed(2);
    };
    const soft = (v, [a, b]) => (v < a ? a - band(a - v, 50) : v > b ? b + band(v - b, 50) : v);

    // the cube is as big as the first screen allows, never bigger than its column
    const size = () => {
      const col = scene.parentElement;
      const cs = getComputedStyle(hero);
      const kw = col.clientWidth / (wide.matches ? 624 : 600);
      let kh = wide.matches ? (innerHeight * 0.5) / 610 : col.clientHeight / 610;
      if (wide.matches) {
        const strip = $('#strip');
        const room = innerHeight - hero.offsetTop - (strip ? strip.offsetHeight : 0) - parseFloat(cs.rowGap) - parseFloat(cs.paddingBottom)
          - (say ? say.offsetHeight : 0) - (parseFloat(getComputedStyle(col).rowGap) || 0);
        kh = room / 610;
      }
      k = clamp(Math.min(kw, kh), 0.4, 1.3);
      scene.style.setProperty('--k', k.toFixed(3));
      REST = pose();
    };
    size();
    addEventListener('resize', () => { size(); paint(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);

    // the caption changes calmly: it waits a moment (longer before going back to its resting line,
    // so moving from tile to tile never flashes it), then the words fade over; the box keeps its size
    let sayTimer = 0, sayNow = idle;
    const tell = (words, delay) => {
      clearTimeout(sayTimer);
      if (!sayText || words === sayNow) return;
      sayTimer = setTimeout(() => {
        sayNow = words;
        if (calm.matches) { sayText.textContent = words; return; }
        say.classList.add('is-swap');
        sayTimer = setTimeout(() => { sayText.textContent = words; say.classList.remove('is-swap'); }, 170);
      }, delay);
    };

    // each tile starts somewhere out in front of the cube, and the centre one lands first
    const order = [4, 1, 6, 3, 0, 7, 2, 5, 8];
    tiles.forEach((t, i) => {
      t.draggable = false;
      t.style.setProperty('--sx', ((i % 3) - 1) * 210 + (i % 2 ? 46 : -34) + 'px');
      t.style.setProperty('--sy', (Math.floor(i / 3) - 1) * 180 - 70 + 'px');
      t.style.setProperty('--sz', 280 + ((i * 97) % 260) + 'px');
      t.style.setProperty('--sr', ((i * 53) % 56) - 28 + 'deg');
      t.style.setProperty('--n', String(order[i]));
      const on = () => tell(t.dataset.say || idle, 90);
      const off = () => tell(idle, 520);
      t.addEventListener('pointerenter', on);
      t.addEventListener('focus', on);
      t.addEventListener('pointerleave', off);
      t.addEventListener('blur', off);
    });
    $$('.face:not(.f-front)', cube).forEach((f) => [...f.children].forEach((el, i) => el.style.setProperty('--n', String(i))));

    const tick = (now) => {
      raf = 0;
      const dt = Math.min(0.032, (now - t0) / 1000 || 0.016);
      t0 = now;
      if (!held) {
        let tx = REST.x + aim.x, ty = REST.y + turns * 360 + aim.y;
        if (!over) { ty += Math.sin(now / 2600) * 4; tx += Math.cos(now / 3400) * 1.6; }
        stepSpring(rx, tx, sp, dt);
        stepSpring(ry, ty, sp, dt);
        if (sp !== SOFT && Math.abs(rx.v) + Math.abs(ry.v) < 1.2 && Math.abs(rx.x - tx) + Math.abs(ry.x - ty) < 0.6) {
          sp = SOFT;
          ry.x -= turns * 360;   // back to the plain angle, however many times it went round
          turns = 0;
        }
        if (litv < 1 && cube.classList.contains('is-built')) litv = Math.min(1, litv + dt / 0.7);
        paint();
        const at = Math.abs(rx.v) + Math.abs(ry.v) < 0.05 && Math.abs(rx.x - (REST.x + aim.x)) + Math.abs(ry.x - (REST.y + turns * 360 + aim.y)) < 0.05;
        if (!swaying && at && litv >= 1 && sp === SOFT && cube.classList.contains('is-settled')) return;   // at rest: no more frames
      }
      if (seen) raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && !calm.matches) { t0 = performance.now(); raf = requestAnimationFrame(tick); } };

    // on a phone the headline and the cube drift at different speeds as you scroll, and the scroll turns the cube
    if (!wide.matches && !calm.matches) {
      const title = $('h1', hero), col = scene.parentElement;
      let queued = false;
      const drift = () => {
        queued = false;
        const y = clamp(scrollY, 0, innerHeight * 1.2);
        aim.y = y * 0.14;
        aim.x = -y * 0.02;
        if (title) title.style.transform = 'translate3d(0, ' + (y * 0.2).toFixed(1) + 'px, 0)';
        col.style.transform = 'translate3d(0, ' + (-y * 0.12).toFixed(1) + 'px, 0)';
        run();
      };
      addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(drift); } }, { passive: true });
    }

    if (calm.matches) { cube.classList.add('is-built', 'is-settled'); scene.classList.add('is-built'); paint(); }
    else {
      // it arrives turning, and its tiles land as the front comes round
      rx.x = -50; ry.x = REST.y - 150; sp = ARRIVE; paint();
      requestAnimationFrame(() => requestAnimationFrame(() => { cube.classList.add('is-built'); scene.classList.add('is-built'); run(); }));
      setTimeout(() => cube.classList.add('is-settled'), 2100);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; hero.classList.toggle('is-away', !seen); if (seen) run(); }, { rootMargin: '80px 0px' }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });

    // it leans a little toward the pointer, and holds still while the pointer is on it
    hero.addEventListener('pointermove', (e) => {
      if (!fine.matches || held || over) return;
      const r = hero.getBoundingClientRect();
      aim.y = ((e.clientX - r.left) / r.width - 0.5) * 18;
      aim.x = -((e.clientY - r.top) / r.height - 0.5) * 10;
      run();
    });
    hero.addEventListener('pointerleave', () => { aim.x = 0; aim.y = 0; run(); });
    cube.addEventListener('pointerenter', () => { over = true; });
    cube.addEventListener('pointerleave', () => { over = false; });

    // grab it: the turn follows the hand one to one, and a tap on a tile is still a tap
    cube.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      run();
      grab = { id: e.pointerId, x: e.clientX, y: e.clientY, rx: rx.x, ry: ry.x };
      moved = false;
    });
    cube.addEventListener('pointermove', (e) => {
      if (!grab || e.pointerId !== grab.id) return;
      const dx = e.clientX - grab.x, dy = e.clientY - grab.y;
      if (!held) {
        if (Math.hypot(dx, dy) < 6) return;
        held = moved = true;
        cube.classList.add('is-held');
        try { cube.setPointerCapture(e.pointerId); } catch (_) { /* the pointer is already gone */ }
        grab = { id: e.pointerId, x: e.clientX, y: e.clientY, rx: rx.x, ry: ry.x };   // from where it is now
        trail = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
        return;
      }
      const deg = 0.36 / k;
      rx.x = soft(grab.rx - dy * deg, TILT);
      ry.x = grab.ry + dx * deg;   // sideways it turns as far as you like
      paint();
      trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      if (trail.length > 5) trail.shift();
    });
    const drop = (e) => {
      if (!grab || e.pointerId !== grab.id) return;
      if (held) {
        const a = trail[0], b = trail[trail.length - 1];
        const dt = Math.max(8, b.t - a.t) / 1000, deg = 0.36 / k;
        const still = e.timeStamp - b.t > 90 || trail.length < 2;
        ry.v = still ? 0 : clamp(((b.x - a.x) / dt) * deg, -1100, 1100);
        rx.v = still ? 0 : clamp((-(b.y - a.y) / dt) * deg, -420, 420);
        // a throw carries it on; it comes to rest on the front, by the shorter way round
        turns = Math.round((ry.x + ry.v * 0.3 - REST.y) / 360);
        held = false;
        cube.classList.remove('is-held');
        sp = THROWN;
        if (calm.matches) { rx.x = clamp(rx.x, TILT[0], TILT[1]); paint(); } else run();
      }
      grab = null;
    };
    cube.addEventListener('pointerup', drop);
    cube.addEventListener('pointercancel', drop);
    cube.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    cube.addEventListener('dragstart', (e) => e.preventDefault());
  }

  /* 4. The day strip: grab a block and move it. It follows the hand, a flick carries it on,
        and it lands on the nearest free quarter of an hour. Pick a different kind of day above it. */
  const track = $('#strip-track');
  if (track) {
    const out = $('#strip-out'), nowEl = $('#strip-now'), panBox = track.closest('.strip-pan');
    const H0 = 6, SPAN = 16, STEP = 0.25, SNAP = spring(0.36, 0.8);
    const clock = (h) => { const m = Math.round(h * 60); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
    const V = (c) => 'var(--' + c + ')';
    const DAYS = {
      work: $$('.blk', track).map((el) => [+el.dataset.s, +el.dataset.e, el.style.getPropertyValue('--c').trim(), el.textContent, el.dataset.n]),
      student: [[8, 9.5, V('cyan'), 'Lecture', 'Lecture'], [10, 12, V('purple'), 'Study', 'Study for the exam'], [12.5, 13.25, V('paper'), 'Lunch', 'Lunch'], [14, 15.5, V('rust'), 'Seminar', 'Seminar'], [16, 17.5, V('acid'), 'Library', 'Library'], [18, 19, V('acid'), 'Gym', 'Gym'], [20.5, 21.5, V('purple'), 'Read', 'Read']],
      shifts: [[7, 15, V('cyan'), 'Shift', 'Morning shift'], [15.5, 16.25, V('acid'), 'Shop', 'Groceries'], [17, 18.25, V('rust'), 'Gym', 'Gym'], [19, 20, V('paper'), 'Dinner', 'Dinner'], [20.5, 22, V('purple'), 'Course', 'Online course']],
      home: [[7, 7.75, V('acid'), 'Run', 'Run'], [9, 12, V('purple'), 'Work', 'Focused work'], [12, 13, V('paper'), 'Lunch', 'Lunch'], [13.5, 16, V('cyan'), 'Work', 'Work'], [16.5, 17.5, V('rust'), 'Clean', 'Tidy the flat'], [18.5, 19.75, V('acid'), 'Cook', 'Cook dinner'], [20.5, 21.5, V('purple'), 'Read', 'Read']],
    };
    const blks = [];
    let busy = 0, back = 0;
    const place = (b, s) => { b.el.style.setProperty('--s', s.toFixed(4)); b.el.style.setProperty('--e', (s + b.len).toFixed(4)); };
    const label = (b, s = b.s) => b.name + ', ' + clock(s) + ' to ' + clock(s + b.len);
    const name = (b) => b.el.setAttribute('aria-label', label(b) + '. Drag it, or use the left and right arrow keys.');
    const isFree = (b, s) => s >= H0 - 1e-6 && s + b.len <= H0 + SPAN + 1e-6 && blks.every((o) => o === b || s + b.len <= o.s + 1e-6 || s >= o.s + o.len - 1e-6);
    const nearestFree = (b, want) => {
      const base = Math.round(clamp(want, H0, H0 + SPAN - b.len) / STEP) * STEP;
      for (let i = 0; i <= SPAN / STEP; i++) {
        for (const d of i ? [i, -i] : [0]) { const s = base + d * STEP; if (isFree(b, s)) return s; }
      }
      return b.s;
    };
    const settle = (b) => {
      cancelAnimationFrame(b.raf);
      if (calm.matches) { b.p.x = b.s; b.p.v = 0; place(b, b.s); return; }
      let t0 = performance.now();
      const go = (now) => {
        const dt = Math.min(0.032, (now - t0) / 1000);
        t0 = now;
        stepSpring(b.p, b.s, SNAP, dt);
        if (Math.abs(b.p.x - b.s) < 0.004 && Math.abs(b.p.v) < 0.03) { b.p.x = b.s; b.p.v = 0; place(b, b.s); return; }
        place(b, b.p.x);
        b.raf = requestAnimationFrame(go);
      };
      b.raf = requestAnimationFrame(go);
    };
    const tell = () => {
      const d = new Date();
      let h = d.getHours() + d.getMinutes() / 60;
      if (h < H0 + 0.5 || h > H0 + SPAN - 0.5) h = 14.63;   // at night the strip shows an afternoon
      if (nowEl) { nowEl.style.setProperty('--t', h.toFixed(3)); nowEl.textContent = clock(h); }
      if (busy || !out) return h;
      const cur = blks.find((o) => h >= o.s && h < o.s + o.len);
      const next = blks.filter((o) => o.s > h).sort((x, y) => x.s - y.s)[0];
      out.textContent = cur ? cur.name + ' until ' + clock(cur.s + cur.len) : next ? 'Free until ' + clock(next.s) : 'Free for the rest of the day';
      return h;
    };
    const later = () => { clearTimeout(back); back = setTimeout(() => { busy = 0; tell(); }, 2400); };

    const mount = ([s, e, c, text, full], i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'blk is-new';
      el.textContent = text;
      el.dataset.n = full;
      el.dataset.s = String(s);
      el.dataset.e = String(e);
      el.style.setProperty('--c', c);
      el.style.setProperty('--i', String(i));
      track.insertBefore(el, nowEl);
      const b = { el, s, len: e - s, name: full, p: { x: s, v: 0 }, raf: 0 };
      blks.push(b);
      place(b, s);
      name(b);
      let grab = null, trail = [];
      const hourAt = (cx) => { const r = track.getBoundingClientRect(); return H0 + ((cx - r.left) / r.width) * SPAN; };
      el.addEventListener('animationend', () => el.classList.remove('is-new'));
      el.addEventListener('pointerdown', (ev) => {
        if (ev.button) return;
        cancelAnimationFrame(b.raf);   // caught in flight: carry on from where it is
        try { el.setPointerCapture(ev.pointerId); } catch (_) { /* gone */ }
        grab = { id: ev.pointerId, off: hourAt(ev.clientX) - b.p.x };
        trail = [{ t: ev.timeStamp, h: b.p.x }];
        el.classList.add('is-held');
        busy = 1; clearTimeout(back);
        if (out) out.textContent = label(b, nearestFree(b, b.p.x));
      });
      el.addEventListener('pointermove', (ev) => {
        if (!grab || ev.pointerId !== grab.id) return;
        const lo = H0, hi = H0 + SPAN - b.len;
        let x = hourAt(ev.clientX) - grab.off;
        if (x < lo) x = lo - band(lo - x, 2); else if (x > hi) x = hi + band(x - hi, 2);
        b.p.x = x;
        place(b, x);
        trail.push({ t: ev.timeStamp, h: x });
        if (trail.length > 5) trail.shift();
        if (out) out.textContent = label(b, nearestFree(b, x));
      });
      const drop = (ev) => {
        if (!grab || ev.pointerId !== grab.id) return;
        grab = null;
        el.classList.remove('is-held');
        const f = trail[0], z = trail[trail.length - 1];
        const v = trail.length < 2 || ev.timeStamp - z.t > 90 ? 0 : (z.h - f.h) / (Math.max(8, z.t - f.t) / 1000);
        b.s = nearestFree(b, b.p.x + project(v * 1000));
        b.p.v = v;
        el.dataset.s = String(b.s);
        el.dataset.e = String(b.s + b.len);
        name(b);
        if (out) out.textContent = label(b);
        settle(b);
        later();
      };
      el.addEventListener('pointerup', drop);
      el.addEventListener('pointercancel', drop);
      el.addEventListener('keydown', (ev) => {
        const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        for (let x = b.s + d * STEP; x >= H0 - 1e-6 && x + b.len <= H0 + SPAN + 1e-6; x += d * STEP) {
          if (isFree(b, x)) { b.s = x; break; }
        }
        name(b);
        busy = 1;
        if (out) out.textContent = label(b);
        settle(b);
        later();
      });
    };
    const load = (key) => {
      blks.forEach((b) => { cancelAnimationFrame(b.raf); b.el.remove(); });
      blks.length = 0;
      busy = 0;
      (DAYS[key] || DAYS.work).forEach(mount);
      tell();
    };
    $$('.blk', track).forEach((el) => el.remove());
    load('work');
    $$('.strip-set button').forEach((btn) => btn.addEventListener('click', () => {
      $$('.strip-set button').forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
      load(btn.dataset.set);
    }));
    const h = tell();
    setInterval(tell, 30000);
    // on a narrow screen the day is wider than the screen: open it around now
    if (panBox) requestAnimationFrame(() => { panBox.scrollLeft = ((h - H0) / SPAN) * panBox.scrollWidth - panBox.clientWidth / 2; });
  }

  /* 5. The timer on the cube counts, like the one in the app. */
  if (!calm.matches) {
    let secs = 36 * 60 + 12;
    setInterval(() => {
      if (document.hidden) return;
      secs += 1;
      const s = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
      $$('[data-digits]').forEach((el) => { el.textContent = s; });
    }, 1000);
  }

  /* 6. Nine tabs closed: each app is struck off and its part drops into the face. */
  const nine = $('.nine');
  let nineStep = () => {};
  if (nine) {
    const was = $$('.was li', nine), parts = $$('.grid9 li', nine), count = $('.one-n', nine);
    // the parts are the same tiles as on the cube
    parts.forEach((li) => {
      const t = $('.f-front .t[data-tile="' + li.dataset.tile + '"]');
      if (!t) return;
      const copy = document.createElement('span');
      copy.className = t.className;
      copy.innerHTML = t.innerHTML;
      li.textContent = '';
      li.append(copy);
    });
    let shown = 0;
    const cols = $('.nine-cols', nine);
    const fly = (from, to, done) => {
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const el = document.createElement('i');
      el.className = 'fly';
      el.style.left = a.left + 'px';
      el.style.top = a.top + a.height / 2 - 10 + 'px';
      document.body.append(el);
      const dx = b.left + b.width / 2 - a.left - 28, dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const go = el.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx * 0.45 + 'px, ' + (dy * 0.45 - 46) + 'px) scale(1.25)', opacity: 1, offset: 0.5 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(0.55)', opacity: 0.85 },
      ], { duration: 560, easing: 'cubic-bezier(0.5, 0, 0.2, 1)' });
      go.onfinish = () => { el.remove(); done(); };
    };
    const set = (k) => {
      const prev = shown;
      shown = k;
      was.forEach((li, i) => li.classList.toggle('gone', i < k));
      parts.forEach((li) => {
        const idx = Number(li.dataset.k), has = li.classList.contains('in');
        if (idx >= k) { li.classList.remove('in'); return; }
        if (has) return;
        if (pinned.matches && !calm.matches && k - prev <= 2 && was[idx] && !li.dataset.flying) {
          li.dataset.flying = '1';
          fly(was[idx], li, () => { delete li.dataset.flying; if (idx < shown) li.classList.add('in'); });
        } else li.classList.add('in');
      });
      if (count) count.textContent = String(k);
      nine.classList.toggle('all', k >= 9);
    };
    const pinned = matchMedia('(min-height: 560px) and (prefers-reduced-motion: no-preference)');
    let played = false;
    nineStep = () => {
      const r = nine.getBoundingClientRect();
      if (pinned.matches) {
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        const k = Math.max(0, Math.min(9, Math.floor(p * 10.4)));
        return k === shown ? null : () => set(k);
      }
      if (calm.matches) { if (played) return null; played = true; return () => set(9); }
      // not pinned (phones): the apps close, and their parts arrive, as the list and the grid pass through the screen
      const c = cols.getBoundingClientRect();
      const p = clamp((innerHeight * 0.82 - c.top) / (c.height * 0.8), 0, 1);
      const k = clamp(Math.floor(p * 9.6), 0, 9);
      return k === shown ? null : () => set(k);
    };
    set(pinned.matches || !calm.matches ? 0 : 9);
  }
  if ('IntersectionObserver' in window) {
    const awayWatch = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-away', !e.isIntersecting)), { rootMargin: '80px 0px' });
    [nine, $('.start')].filter(Boolean).forEach((el) => awayWatch.observe(el));
  }

  /* 7. The day rail: the red mark moves through the day as you scroll. */
  const rail = $('.rail');
  const chapters = $$('.ch');
  const railItems = rail ? $$('li', rail) : [];
  const railNow = rail ? $('.rail-now', rail) : null;
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hhmm = (m) => pad(Math.floor(m / 60)) + ':' + pad(Math.floor(m % 60));
  const railStep = () => {
    if (!rail || !chapters.length || !rail.offsetParent) return null;
    const mid = innerHeight / 2;
    let i = 0, p = 0;
    chapters.forEach((ch, k) => {
      const r = ch.getBoundingClientRect();
      if (r.top <= mid) { i = k; p = Math.min(1, (mid - r.top) / r.height); }
    });
    const first = chapters[0].getBoundingClientRect(), last = chapters[chapters.length - 1].getBoundingClientRect();
    const step = railItems[0] ? railItems[0].offsetHeight : 58;
    const off = first.top > mid || last.bottom < mid;
    return () => {
      rail.classList.toggle('off', off);
      const ch = chapters[i];
      const ink = ch.dataset.ink || 'dark';
      if (rail.dataset.ink !== ink) rail.dataset.ink = ink;
      railItems.forEach((li, k) => li.classList.toggle('cur', k === i));
      const y = Math.min((railItems.length - 1) * step + step / 2 + step * 0.35, i * step + step / 2 + p * step);
      railNow.style.setProperty('--y', y.toFixed(1));
      const t = hhmm(mins(ch.dataset.time) + p * (mins(ch.dataset.end) - mins(ch.dataset.time)));
      if (railNow.textContent !== t) railNow.textContent = t;
    };
  };

  /* 8. A window lies back as it comes up the page, faces you in the middle, and tips away as it leaves. */
  const depths = $$('.depth');
  const near = new Set();
  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) near.add(e.target); else near.delete(e.target); }), { rootMargin: '300px 0px' });
    depths.forEach((d) => watch.observe(d));
    chapters.forEach((c) => watch.observe(c));
  } else { depths.forEach((d) => near.add(d)); chapters.forEach((c) => near.add(c)); }
  const tiltStep = () => {
    if (calm.matches || !depths.length) return null;
    const mid = innerHeight / 2, cx = innerWidth / 2;
    const jobs = [];
    depths.forEach((d) => {
      if (!near.has(d)) return;
      const r = d.getBoundingClientRect();
      const p = clamp((r.top + r.height / 2 - mid) / innerHeight, -1, 1);
      const side = r.left + r.width / 2 > cx + 40 ? -1 : r.left + r.width / 2 < cx - 40 ? 1 : 0;
      const ty = p * 8, tx = Math.abs(p) * side * 4;
      // a window facing you is drawn flat, so its text stays crisp; it only leans while it travels
      const flat = Math.abs(ty) < 0.9 && Math.abs(tx) < 0.9;
      jobs.push(() => { d.style.transform = flat ? 'none' : 'perspective(1500px) rotateX(' + ty.toFixed(2) + 'deg) rotateY(' + tx.toFixed(2) + 'deg)'; });
    });
    chapters.forEach((ch) => {
      if (!near.has(ch)) return;
      const r = ch.getBoundingClientRect();
      const big = ch.querySelector('.ch-big');
      if (big) { const v = (((r.top + r.height / 2 - mid) / innerHeight) * -70).toFixed(1); jobs.push(() => { big.style.transform = 'translateY(' + v + 'px)'; }); }
    });
    const pics = $('.phone-pics');
    if (pics) {
      const r = pics.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200) {
        const p = clamp((r.top + r.height / 2 - mid) / innerHeight, -1, 1);
        const back = pics.lastElementChild, front = pics.firstElementChild;
        jobs.push(() => { back.style.transform = 'translate3d(0,' + (p * -34).toFixed(1) + 'px,0)'; front.style.transform = 'translate3d(0,' + (p * 64).toFixed(1) + 'px,0)'; });
      }
    }
    return () => jobs.forEach((f) => f());
  };

  let queued = false;
  const onScroll = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; const w = [nineStep(), railStep(), tiltStep()]; w.forEach((f) => { if (f) f(); }); }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* 9. Typing a plan: the words are typed, Enter is pressed, and the plan appears with its day, time and length. */
  const typer = $('[data-typer]');
  if (typer && !calm.matches && 'IntersectionObserver' in window) {
    const text = $('.typer-text', typer), card = $('.typer-card', typer), key = $('kbd', typer);
    const slots = ['.tc-name', '.tc-day', '.tc-time', '.tc-len'].map((s) => $(s, card));
    // each of these is read by the app exactly like this
    const lines = [
      ['Gym tomorrow 18:00 1h', 'Gym', 'Tomorrow', '18:00', '1h'],
      ['Call mom tomorrow at 5pm', 'Call mom', 'Tomorrow', '17:00', ''],
      ['Pay rent friday', 'Pay rent', 'Friday', '', ''],
    ];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let on = false, busy = false, i = 0;
    const play = async () => {
      if (busy) return;
      busy = true;
      while (on) {
        const [src, ...vals] = lines[i++ % lines.length];
        card.classList.remove('is-on');
        await wait(380);
        text.textContent = '';
        await wait(420);
        for (const ch of src) { if (!on) break; text.textContent += ch; await wait(ch === ' ' ? 120 : 42 + Math.random() * 56); }
        if (!on) break;
        await wait(380);
        key.classList.add('is-down');
        await wait(170);
        key.classList.remove('is-down');
        slots.forEach((el, n) => { el.textContent = vals[n]; el.hidden = !vals[n]; });
        card.classList.add('is-on');
        await wait(2800);
      }
      busy = false;
    };
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) play(); }, { threshold: 0.6 }).observe(typer);
  }

  /* 10. Arrivals: the parts of a section come in once, in reading order. */
  const arriving = $$('[data-rise], [data-settle], .ch [data-open]');
  if ('IntersectionObserver' in window && !calm.matches) {
    const groups = new Map();
    arriving.forEach((el) => {
      if (!el.hasAttribute('data-rise')) return;
      const box = el.closest('.ch-copy, .news-head, .news-list, .phone-copy, .cta-in, .faq') || el.parentElement;
      const n = groups.get(box) || 0;
      el.style.setProperty('--i', String(Math.min(n, 5)));
      groups.set(box, n + 1);
    });
    const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      seen.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    arriving.forEach((el) => seen.observe(el));
  } else arriving.forEach((el) => el.classList.add('is-in'));

  /* The phone's top bar: a three-dot menu holds the links that the bar has no room for. */
  const menuBtn = $('.nav-menu'), sheet = $('.nav-sheet');
  if (menuBtn && sheet) {
    const shut = () => { sheet.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); const open = sheet.hidden; sheet.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); });
    sheet.addEventListener('click', (e) => { if (e.target.closest('a')) shut(); });
    document.addEventListener('click', (e) => { if (!sheet.hidden && !sheet.contains(e.target)) shut(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
  }

  /* 10b. On a phone a Windows program cannot be installed: a bar offers to send the link to a computer. */
  const dock = $('#dock'), send = $('#dock-send');
  if (dock && send && 'IntersectionObserver' in window) {
    const here = new Set();
    const update = () => dock.classList.toggle('is-on', !here.size);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) here.add(e.target); else here.delete(e.target); });
      update();
    });
    [$('.hero .actions'), $('#get'), $('.foot')].filter(Boolean).forEach((el) => io.observe(el));
    here.add($('.hero .actions'));
    update();
    send.addEventListener('click', () => {
      const url = location.href.split('#')[0].replace(/index\.html$/, '');
      if (navigator.share) { navigator.share({ title: 'KRNL0', text: 'Your whole day, one canvas', url }).catch(() => {}); return; }
      const done = () => { send.textContent = 'Link copied'; setTimeout(() => { send.textContent = 'Send to my computer'; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => {});
    });
  }

  /* 11. Films play only while they are on screen, and not at all when motion is reduced. */
  const films = $$('video[data-autoplay]');
  if (films.length && 'IntersectionObserver' in window && !calm.matches) {
    const watch = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { const p = e.target.play(); if (p && p.catch) p.catch(() => {}); } else e.target.pause();
    }), { threshold: 0.15 });
    films.forEach((v) => watch.observe(v));
  }

  /* 12. The version shown is the newest published release; the number in the page is the fallback.
         GitHub's answer is kept for an hour (GitHub allows 60 questions an hour per address, and offices share one). */
  const showVersion = (v) => { $$('[data-krnl-v]').forEach((e) => { e.textContent = v; }); };
  try {
    const kept = JSON.parse(sessionStorage.getItem('krnl-ver') || 'null');
    if (kept && Date.now() - kept.at < 36e5 && /^[0-9]+[.][0-9]+[.][0-9]+$/.test(kept.v)) showVersion(kept.v);
    else {
      fetch('https://api.github.com/repos/theMindDeveloper/krnl0/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((x) => {
          const v = x && typeof x.tag_name === 'string' ? x.tag_name.replace(/^v/, '') : '';
          if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(v)) return;
          showVersion(v);
          try { sessionStorage.setItem('krnl-ver', JSON.stringify({ at: Date.now(), v })); } catch (_) { /* private mode */ }
        })
        .catch(() => {});
    }
  } catch (_) { /* offline or storage blocked: the fallback stays */ }
})();
