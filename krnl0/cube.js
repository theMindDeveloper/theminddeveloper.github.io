/* The cube on the download page: the same cube as the home page (it builds itself, leans toward the pointer, and can be grabbed, turned right round and thrown). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 981px)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const spring = (response, ratio) => { const w = (2 * Math.PI) / response; return { k: w * w, c: 2 * ratio * w }; };
  const stepSpring = (o, to, sp, dt) => { o.v += (sp.k * (to - o.x) - sp.c * o.v) * dt; o.x += o.v * dt; };
  const band = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

  /* 3. The cube: six faces, the front one the nine parts of KRNL0. It builds itself, is lit by one
        lamp, leans toward the pointer, and can be grabbed, turned right round and thrown. */
  const hero = $('.hero, .dx-hero');
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

})();
