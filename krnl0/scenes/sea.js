// KRNL0 tour backdrop: a Hairline sea, on the Hairline kernel (scenes/hairline/kernel.js, MIT, Lucas Marques).
// Rows of paper-cut crests recede in depth, drawn as single strokes in the KRNL0 palette.
// Hairline's rules, kept:
//   01 the pointer picks a row by its rest baseline, never by the moving crest
//   02/08 rows answer on springs, falling off with their distance from the picked row
//   04 the only highlight is one acid stroke: the picked row, or at rest the row the eye starts on
//   05 rest is composed: uneven heights, a swell
//   06 every row is an opaque plate in the ground colour, appended back to front
//   07 one frame loop (HL.register), asleep offscreen; the drift is the only ambient motion
// The scroll moves each row at its own speed (near rows faster): the parallax.
(() => {
  const stage = document.querySelector('.fly .scene-stage');
  if (!stage || !window.HL) return;
  const { mk, spring, stepS, register, clamp } = HL;
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div'); wrap.className = 'sea'; wrap.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); wrap.append(svg); stage.prepend(wrap);

  const N = 11, REST_ROW = 6;
  let W = 0, H = 0, rows = [], pick = -1, last = '';

  function build() {
    W = wrap.clientWidth; H = wrap.clientHeight; if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.replaceChildren();
    rows = [];
    for (let i = 0; i < N; i++) {                                   // back to front: append order is paint order
      const t = i / (N - 1);                                        // 0 far … 1 near
      const base = H * (0.06 + Math.pow(t, 1.25) * 0.86);           // rows crowd together towards the horizon
      const amp = 6 + t * t * 44;                                   // near crests stand taller
      const lam = 70 + t * 210;                                     // and run wider
      const rest = 0.75 + 0.5 * Math.abs(Math.sin(i * 1.7 + 0.4));  // uneven rest heights: a swell, not a grid
      const cls = t < 0.35 ? 'lo' : t < 0.75 ? '' : 'sil';
      rows.push({ base, amp, lam, rest, speed: 20 + t * t * 260, phase: i * 37.3, sp: spring(rest, { eps: 0.002 }),
        el: mk('path', { class: cls, 'data-cls': cls }, svg) });
    }
    last = '';
  }

  // a paper-cut crest: pointed top, rounded trough; the tip is softened a little (rule 09)
  const crest = (u) => { const s = Math.abs(Math.sin(u)); return 1 - Math.pow(s, 0.62); };
  function path(r, off) {
    const step = Math.max(6, r.lam / 18);
    let d = '';
    for (let x = -step; x <= W + step; x += step) {
      const u = ((x + off + r.phase) / r.lam) * Math.PI;
      const y = r.base - r.amp * r.sp.x * crest(u) * (0.9 + 0.1 * Math.sin(u * 0.37));
      d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + `L${W + step} ${H + 2}L${-step} ${H + 2}Z`;
  }

  const section = stage.closest('.fly');
  let clock = 0;
  const B = register(stage, (dt) => {
    if (!rows.length) build();
    if (!rows.length) return true;
    if (!reduced) clock += dt;
    const p = parseFloat(getComputedStyle(section).getPropertyValue('--p')) || 0;
    let moving = !reduced;
    const want = pick < 0 ? REST_ROW : pick;
    rows.forEach((r, i) => {
      if (stepS(r.sp, dt)) moving = true;
      r.el.setAttribute('d', path(r, p * r.speed * 6 + clock * r.speed * 0.08));
      const hi = i === want;
      if (r.hi !== hi) { r.hi = hi; r.el.setAttribute('class', hi ? 'hi' : r.el.dataset.cls); }
    });
    return moving || p.toFixed(4) !== last && ((last = p.toFixed(4)), true);
  });

  // pointer: the row whose rest baseline is nearest, and its neighbours, lift on their springs
  const retarget = () => {
    rows.forEach((r, i) => { r.sp.t = pick < 0 ? r.rest : clamp(r.rest + 1.1 * Math.exp(-((i - pick) ** 2) / 3), 0.5, 2.2); });
    B.wake();
  };
  stage.addEventListener('pointermove', (e) => {
    const b = wrap.getBoundingClientRect(), y = e.clientY - b.top;
    if (y < 0) { if (pick !== -1) { pick = -1; retarget(); } return; }
    let best = 0; rows.forEach((r, i) => { if (Math.abs(r.base - y) < Math.abs(rows[best].base - y)) best = i; });
    if (best !== pick) { pick = best; retarget(); }
  });
  stage.addEventListener('pointerleave', () => { pick = -1; retarget(); });
  addEventListener('scroll', () => B.wake(), { passive: true });
  new ResizeObserver(() => { rows = []; B.wake(); }).observe(wrap);
})();
