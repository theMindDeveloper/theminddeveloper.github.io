// KRNL0 scene: fly. A camera glides through the real parts of the app laid out in depth,
// holding on each one: the live node itself (no box around it) with its words beside it, in the same 3D plane.
// The next part waits behind, out of the dark, and comes forward as you scroll.
// Markup: <section class="scene fly" data-scene="fly"> <div class="scene-stage"> .fly-title, .fly-world > .fp[style="--x;--y;--ry"] …
// Options: hold (screens, default 3).
Scenes['fly'] = (root, opts = {}) => Stage.scene(root, {
  hold: opts.hold ?? 3,
  scrub: opts.scrub ?? 0.6,
  build(tl, { q }) {
    const world = q('.fly-world')[0];
    const panels = q('.fp');
    const gap = parseFloat(getComputedStyle(root).getPropertyValue('--gap-z')) || 800;
    const n = panels.length;
    panels.forEach((p, i) => p.style.setProperty('--z', `${-i * gap}px`));   // depth and camera travel share one spacing at every width
    // each part is scaled to fill most of the screen when it reaches the lens: big enough to read, never past the edges
    panels.forEach((p) => { p.style.removeProperty('--k'); const k = Math.min(1, (innerWidth * 0.8) / p.offsetWidth, (innerHeight * 0.76) / p.offsetHeight); p.style.setProperty('--k', k.toFixed(3)); });

    const INTRO = 0.7, MOVE = 1, HOLD = 0.7;
    const arrive = (i) => INTRO + i * (MOVE + HOLD);
    const end = arrive(n - 1) + HOLD * 0.6;
    const text = (p) => p.querySelector('.fp-text');

    // the camera: comes in from the dark, then glides from part to part and holds on each
    tl.fromTo(world, { z: -500, rotationY: -4, rotationX: 2 }, { z: 0, rotationY: 0, rotationX: 0, duration: INTRO, ease: 'power2.out' }, 0);
    tl.to(q('.fly-title'), { autoAlpha: 0, y: -30, duration: INTRO * 0.6, ease: 'power1.in' }, INTRO * 0.35);
    tl.set(panels.slice(1), { autoAlpha: 0 }, 0);
    tl.fromTo(panels[0].querySelector('.fp-n'), { autoAlpha: 0 }, { autoAlpha: 1, duration: INTRO * 0.5 }, INTRO * 0.6);   // the first number waits for the title to leave
    tl.set(panels.slice(1).map(text), { autoAlpha: 0 }, 0);
    for (let i = 1; i < n; i++) {
      const t = arrive(i);
      const p = panels[i], prev = panels[i - 1];
      tl.to(world, { z: i * gap, duration: MOVE, ease: 'power2.inOut' }, t - MOVE);
      // a little sway on the way, square again on arrival
      tl.to(world, { rotationY: i % 2 ? 3 : -3, duration: MOVE / 2, ease: 'sine.out' }, t - MOVE)
        .to(world, { rotationY: 0, duration: MOVE / 2, ease: 'sine.in' }, t - MOVE / 2);
      tl.to(p, { autoAlpha: 1, duration: MOVE * 0.55, ease: 'none' }, t - MOVE * 0.68);   // it comes up out of the dark once the passed part is gone: nothing shows through
      tl.fromTo(p, { '--turn': `${i % 2 ? 28 : -28}deg` }, { '--turn': '0deg', duration: MOVE, ease: 'power3.out' }, t - MOVE);   // it swings round to face you as it arrives
      tl.to(prev, { autoAlpha: 0, duration: MOVE * 0.35, ease: 'power1.in' }, t - MOVE);  // the passed part leaves before it fills the lens
      tl.fromTo(text(p), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: MOVE * 0.3, ease: 'power2.out' }, t - MOVE * 0.25);
    }
    tl.to({}, { duration: 0.001 }, end);
    // five stops you can jump to: each dot scrolls to the moment its part is held square
    const stage = q('.scene-stage')[0] || root;
    let nav = root.querySelector('.fly-dots');
    if (!nav) {
      nav = document.createElement('nav'); nav.className = 'fly-dots'; nav.setAttribute('aria-label', 'Tour stops');
      panels.forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.querySelector('.fp-k').textContent; nav.append(b); });
      stage.append(nav);
    }
    const dots = [...nav.children];
    const at = (i) => (arrive(i) + HOLD * 0.3) / end;
    dots.forEach((b, i) => { b.onclick = () => { const st = tl.scrollTrigger; if (st) scrollTo({ top: st.start + (st.end - st.start) * at(i), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }; });
    tl.eventCallback('onUpdate', () => {
      const p = tl.progress() * end; let k = 0;
      for (let i = 0; i < n; i++) if (p >= arrive(i) - MOVE * 0.5) k = i;
      dots.forEach((b, i) => b.setAttribute('aria-current', i === k ? 'true' : 'false'));
    });
  },
});
