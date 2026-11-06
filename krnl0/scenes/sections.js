/* one app instead of nine: as the list passes the middle of the screen, each old app is crossed out and its part arrives */
(() => {
  const was = [...document.querySelectorAll('.was li')], parts = [...document.querySelectorAll('.one-parts li')];
  const count = document.querySelector('.one-n'); if (!was.length) return;
  let raf = 0;
  const tick = () => {
    raf = 0; let n = 0;
    was.forEach((li, i) => {
      const on = li.getBoundingClientRect().top < innerHeight * 0.62;
      li.classList.toggle('gone', on); if (parts[i]) parts[i].classList.toggle('in', on); if (on) n++;
    });
    if (count) count.textContent = String(n);
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  addEventListener('resize', tick); tick();
})();

/* a day: drag (or arrow-key) the first task; the chain follows, back to back.
   Fluid in the Apple sense: the lead tracks the pointer 1:1 from where it was grabbed, resists softly past the
   ends of the day (rubber-band), and on release projects its momentum and settles on the nearest quarter hour.
   Every block rides its own critically damped spring, retargeted from where it is, so it can be grabbed mid-flight;
   the two followers are a touch softer, so the chain visibly trails its lead. */
(() => {
  const plan = document.querySelector('.plan'); if (!plan) return;
  const day = plan.querySelector('.plan-day'), lead = plan.querySelector('.pc-0');
  const blocks = [...plan.querySelectorAll('.pc')], DUR = [50, 25, 30].map((m) => m / 60);
  const fixed = [...plan.querySelectorAll('.plan-fixed')].map((el) => ({ el, s: +el.style.getPropertyValue('--s'), e: +el.style.getPropertyValue('--e'), name: el.textContent.trim() }));
  const out = plan.querySelector('.plan-out'), warn = plan.querySelector('.plan-warn');
  const D0 = 12, D1 = 20, TOTAL = DUR.reduce((a, b) => a + b, 0), MIN = D0, MAX = D1 - TOTAL;
  const vertical = matchMedia('(max-width: 900px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hhmm = (h) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const snap = (h) => Math.min(MAX, Math.max(MIN, Math.round(h * 4) / 4));

  // springs: damping 1.0 (no overshoot); response 0.28s for the lead, a little looser down the chain
  const RESP = [0.28, 0.36, 0.44];
  const springs = blocks.map((_, i) => ({ x: 14, v: 0, t: 14, k: (2 * Math.PI / RESP[i]) ** 2, c: 2 * (2 * Math.PI / RESP[i]) }));
  let target = 14, raf = 0, last = 0;
  const offsets = DUR.map((_, i) => DUR.slice(0, i).reduce((a, b) => a + b, 0));

  const draw = () => {
    springs.forEach((sp, i) => {
      const s = sp.x + offsets[i];
      blocks[i].style.setProperty('--s', s.toFixed(4)); blocks[i].style.setProperty('--e', (s + DUR[i]).toFixed(4));
    });
  };
  const report = (start) => {
    const clashes = new Set(); let t = start;
    DUR.forEach((d) => { const s = t, e = t + d; t = e; fixed.forEach((f) => { if (s < f.e && e > f.s) clashes.add(f); }); });
    fixed.forEach((f) => f.el.classList.toggle('clash', clashes.has(f)));
    out.textContent = `${hhmm(start)} to ${hhmm(start + TOTAL)}`;
    warn.textContent = clashes.size ? `Overlaps ${[...clashes].map((f) => f.name).join(' and ')}. Slide it a little.` : '';
    lead.setAttribute('aria-valuenow', String(start));
    lead.setAttribute('aria-valuetext', `Starts ${hhmm(start)}, done by ${hhmm(start + TOTAL)}`);
  };
  const tick = (now) => {
    const dt = Math.min(0.032, (now - (last || now)) / 1000); last = now;
    let moving = false;
    springs.forEach((sp, i) => {
      const goal = i === 0 && grab ? sp.t : target;           // while dragging, the lead is the finger
      if (i === 0 && grab) { sp.x = goal; sp.v = 0; return; }
      const a = -sp.k * (sp.x - goal) - sp.c * sp.v;
      sp.v += a * dt; sp.x += sp.v * dt;
      if (Math.abs(sp.x - goal) < 0.0005 && Math.abs(sp.v) < 0.001) { sp.x = goal; sp.v = 0; } else moving = true;
    });
    draw();
    raf = moving || grab ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  };
  const go = () => { if (reduced) { springs.forEach((sp) => { sp.x = target; sp.v = 0; }); draw(); return; } if (!raf) raf = requestAnimationFrame(tick); };
  const setTarget = (h) => { target = snap(h); springs.forEach((sp) => { sp.t = target; }); report(target); go(); };

  // pointer: 1:1 from the grab point, rubber-band past the ends, momentum projected on release
  const hours = (e) => { const r = day.getBoundingClientRect(); const f = vertical.matches ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; return D0 + f * (D1 - D0); };
  const span = () => { const r = day.getBoundingClientRect(); return (vertical.matches ? r.height : r.width) / (D1 - D0); };   // px per hour
  const band = (h) => {                                         // progressive resistance beyond the day
    const dim = 1.5, over = h < MIN ? h - MIN : h > MAX ? h - MAX : 0;
    if (!over) return h;
    const eased = (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));
    return (over < 0 ? MIN : MAX) + eased;
  };
  let grab = null, trail = [];
  lead.addEventListener('pointerdown', (e) => {
    lead.setPointerCapture(e.pointerId); lead.classList.add('grab'); lead.focus({ preventScroll: true });
    const sp = springs[0];
    grab = hours(e) - sp.x;                                     // keep the offset from where it was grabbed, even mid-flight
    sp.t = sp.x; trail = [{ h: sp.x, t: performance.now() }]; e.preventDefault(); go();
  });
  lead.addEventListener('pointermove', (e) => {
    if (grab === null) return;
    const h = band(hours(e) - grab);
    springs[0].t = h; target = Math.min(MAX, Math.max(MIN, h));
    springs.slice(1).forEach((sp) => { sp.t = target; });
    report(snap(h));
    springs[0].x = h; springs[0].v = 0; draw();                 // 1:1: the lead is drawn on the pointer event itself, not a frame later
    trail.push({ h, t: performance.now() }); if (trail.length > 6) trail.shift();
  });
  const drop = () => {
    if (grab === null) return;
    grab = null; lead.classList.remove('grab');
    const recent = trail.filter((p) => performance.now() - p.t < 100), a = recent[0] || trail[trail.length - 1], b = trail[trail.length - 1], dt = (b.t - a.t) / 1000;
    const v = dt > 0.008 ? (b.h - a.h) / dt : 0;                // hours per second at release
    const vpx = v * span(), d = 0.99;                           // Apple's projection (the snappier rate): a placed drag stays, a flick travels
    const projected = b.h + ((vpx / 1000) * d / (1 - d)) / span();
    springs[0].v = v;                                           // hand the finger's speed to the spring
    setTarget(projected);
  };
  lead.addEventListener('pointerup', drop); lead.addEventListener('pointercancel', drop); lead.addEventListener('lostpointercapture', drop);

  lead.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 0.25, ArrowDown: 0.25, ArrowLeft: -0.25, ArrowUp: -0.25, PageDown: 1, PageUp: -1 }[e.key];
    if (step) { e.preventDefault(); setTarget(target + step); }
    if (e.key === 'Home') { e.preventDefault(); setTarget(MIN); }
    if (e.key === 'End') { e.preventDefault(); setTarget(MAX); }
  });
  lead.setAttribute('role', 'slider'); lead.setAttribute('aria-valuemin', String(MIN)); lead.setAttribute('aria-valuemax', String(MAX));
  const now = new Date(); const nh = now.getHours() + now.getMinutes() / 60; if (nh > D0 && nh < D1) plan.style.setProperty('--n', String(nh)); else plan.classList.add('no-now');
  draw(); report(target);
})();

/* nav: light the link of the section in view */
(() => {
  const links = [...document.querySelectorAll('.topnav nav a[href^="#"]')];
  const map = new Map(links.map((a) => [document.querySelector(a.getAttribute('href')), a]).filter(([s]) => s));
  if (!('IntersectionObserver' in window) || !map.size) return;
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
    let best = null, top = 0;
    seen.forEach((r, s) => { if (r > top) { top = r; best = s; } });
    links.forEach((a) => a.removeAttribute('aria-current'));
    if (best && top > 0) map.get(best).setAttribute('aria-current', 'true');
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.5, 1] });
  map.forEach((_, s) => io.observe(s));
})();

/* Windows: every download link starts the installer itself, not a GitHub page. The page asks GitHub which release
   is the newest, so a new release is picked up with no change here; the answer is kept for an hour. If GitHub
   cannot be reached the links stay as they are, on the releases page. */
function directDownload() {
  const REL = 'https://github.com/theMindDeveloper/krnl0/releases/latest';
  const links = [...document.querySelectorAll(`a[href="${REL}"]`)]; if (!links.length) return;
  const apply = (r) => links.forEach((a) => { a.href = r.url; a.title = `KRNL0 ${r.tag} for Windows`; a.dataset.version = r.tag; });
  try { const c = JSON.parse(sessionStorage.getItem('krnl-dl') || 'null'); if (c && Date.now() - c.at < 36e5) { apply(c); return; } } catch (_) {}
  fetch('https://api.github.com/repos/theMindDeveloper/krnl0/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((rel) => {
      const exe = (rel.assets || []).find((x) => /\.exe$/i.test(x.name) && !/blockmap/i.test(x.name)); if (!exe) return;
      const r = { url: exe.browser_download_url, tag: rel.tag_name, at: Date.now() };
      try { sessionStorage.setItem('krnl-dl', JSON.stringify(r)); } catch (_) {}
      apply(r);
    })
    .catch(() => {});
}

/* download: say the right thing for the visitor's computer. Windows gets the installer straight away; a Mac or a
   Linux machine goes to its part of the install guide, which always has the newest file for it. A phone or a tablet
   can't run KRNL0 (an iPhone even calls itself "Mac OS X"), so it is pointed at the guide for a computer. */
(() => {
  const ua = navigator.userAgent || '', p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
  const phone = /iphone|ipad|ipod|android/i.test(ua) || (/mac/.test(p) && navigator.maxTouchPoints > 1);
  const os = phone ? 'phone' : /mac/.test(p) ? 'mac' : /linux|x11|cros/.test(p) ? 'linux' : 'windows';
  if (os === 'windows') { directDownload(); return; }
  const say = { phone: ['Get it for your computer', 'download.html'], mac: ['Download for Mac', 'download.html#mac'], linux: ['Download for Linux', 'download.html#linux'] }[os];
  document.querySelectorAll('[data-dl]').forEach((a) => { (a.querySelector('.btn-t') || a).textContent = say[0]; a.href = say[1]; });
})();

/* footer: the mark is built like a day being planned. When the footer comes into view the five blocks
   rise from the baseline one after another, the way tasks fill a day, each letter riding up inside its block.
   It plays once, then the mark stands still. */
(() => {
  const wrap = document.querySelector('.blocks'); if (!wrap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  wrap.classList.add('will-build');
  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; requestAnimationFrame(() => wrap.classList.add('built')); io.disconnect(); }, { threshold: 0.3 });
  io.observe(wrap);
})();

/* footer mark, by hand: the pointer is a lamp along the mark. Each block rises by how near the pointer is
   (a field, falling off with distance, clamped), on a critically damped spring; leave and it settles to rest. */
(() => {
  const wrap = document.querySelector('.blocks'); if (!wrap) return;
  const blocks = [...wrap.querySelectorAll('.b')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const REST = [86, 66, 78, 64, 72], TOP = 100, LIFT = 26;
  const sp = blocks.map((_, i) => ({ x: REST[i], v: 0, t: REST[i] }));
  const k = (2 * Math.PI / 0.42) ** 2, c = 2 * (2 * Math.PI / 0.42);    // response 0.42s, no overshoot
  let raf = 0, last = 0;
  const tick = (now) => {
    const dt = Math.min(0.032, (now - (last || now)) / 1000); last = now; let moving = false;
    sp.forEach((s, i) => {
      s.v += (-k * (s.x - s.t) - c * s.v) * dt; s.x += s.v * dt;
      if (Math.abs(s.x - s.t) > 0.03 || Math.abs(s.v) > 0.03) moving = true; else { s.x = s.t; s.v = 0; }
      blocks[i].style.height = s.x.toFixed(2) + '%';
    });
    raf = moving ? requestAnimationFrame(tick) : 0; if (!raf) last = 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const aim = (clientX) => {
    blocks.forEach((b, i) => {
      const r = b.getBoundingClientRect(), d = Math.abs(clientX - (r.left + r.width / 2)) / r.width;   // in blocks
      const f = Math.max(0.08, Math.exp(-d * d * 1.4));                                                   // field with a floor
      sp[i].t = Math.min(TOP, REST[i] + LIFT * f);
    });
    go();
  };
  const rest = () => { sp.forEach((s, i) => { s.t = REST[i]; }); go(); };
  wrap.addEventListener('pointermove', (e) => aim(e.clientX));
  wrap.addEventListener('pointerdown', (e) => aim(e.clientX));
  wrap.addEventListener('pointerleave', rest);
  sp.forEach((s, i) => { blocks[i].style.height = REST[i] + '%'; });
})();

/* performance: a looping film downloads only when it comes near the screen, plays while it is on screen,
   and pauses when it leaves. Reduced motion keeps the poster frame. Without script the poster shows. */
(() => {
  const vids = [...document.querySelectorAll('video[data-autoplay]')]; if (!vids.length) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play = (v) => { if (still) return; if (v.preload === 'none') v.preload = 'auto'; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? play(e.target) : e.target.pause())), { rootMargin: '300px 0px' });
  vids.forEach((v) => io.observe(v));
})();

/* top bar: hides while reading down, returns on any scroll up, always shown near the top */
(() => {
  const bar = document.querySelector('.topnav'); if (!bar) return;
  let last = scrollY, raf = 0;
  addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const y = scrollY, d = y - last;
      if (y < 120 || d < -6) bar.classList.remove('away'); else if (d > 6 && !bar.contains(document.activeElement)) bar.classList.add('away');
      last = y;
    });
  }, { passive: true });
  bar.addEventListener('focusin', () => bar.classList.remove('away'));
})();

/* hero parallax, at every size: the cube is the nearest layer, so it rises faster than the words as you scroll */
(() => {
  const cube = document.getElementById('cube'), tile = document.getElementById('cube-tile');
  if (!cube || !tile || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let raf = 0;
  const tick = () => { raf = 0; const y = Math.min(Math.max(scrollY, 0), tile.offsetHeight); cube.style.setProperty('--cube-py', (y * -0.28).toFixed(1) + 'px'); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  tick();
})();
