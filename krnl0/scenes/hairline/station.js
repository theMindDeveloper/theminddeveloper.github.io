/**
 * Station: KRNL0's whole day as one desk tray. Four panels stand along the back
 * (timer, to-dos, habits, calendar), the day clock sits at the right, and the
 * canvas lies in front holding a chain of three tasks. The part under the
 * pointer lifts out of the tray and takes the bright edge; the others settle,
 * staggered outwards by their distance from it. At rest the timer stands a
 * little proud: it is the one running. The slider is the stagger, in ms.
 */
const {
  Cam, circ, fit, open, poly, proj, prism, rings, ringAt, rrect, seg, unproj, facing,
  tdone, tset, tval, tween, disposer, mk, put, solid, place, pointer, reflect, register,
} = HL;

const BX0 = -6, BY0 = -6, BX1 = 246, BY1 = 146, BH = 6;      // the tray
const H = 7, LIFT = 30, PROUD = 6;                           // a part's height, its lift, and the running timer's
// back to front (ascending x + y), each [name, x0, y0, x1, y1, height]
const PARTS = [
  ["timer", 4, 4, 58, 54, H], ["to-dos", 64, 4, 118, 54, H], ["habits", 124, 4, 178, 54, H],
  ["canvas", 4, 62, 178, 138, 3], ["calendar", 184, 4, 238, 54, H], ["clock", 184, 62, 238, 138, H],
];
const REST = [PROUD, 0, 0, 0, 0, 0];
const at = (ring, dx, dy) => ring.map((q) => ({ ...q, u: q.u + dx, v: q.v + dy }));

/** The marks each part really has, on its top face at height z: [d, class] pairs, and dots as [x, y, class]. */
function marks(P, name, x0, y0, x1, y1, z) {
  const L = [], D = [], ln = (a, b, c, d, cls) => L.push([seg(P(a, b, z), P(c, d, z)), cls]);
  const box = (a, b, c, d, r, cls) => L.push([poly(ringAt(P, rrect(a, b, c, d, r, 3), z)), cls]);
  if (name === "timer") {                                   // a day track with the minutes so far, and the stop button
    box(x0 + 7, y0 + 24, x1 - 7, y0 + 29, 2, "nf lo"); ln(x0 + 9, y0 + 26.5, x0 + 34, y0 + 26.5, "nf");
    box(x0 + 22, y1 - 15, x1 - 7, y1 - 8, 2.5, "nf");
  } else if (name === "to-dos") {                           // three rows: a box, and the line of the to-do
    for (let k = 0; k < 3; k++) { const v = y0 + 12 + k * 11; box(x0 + 7, v - 2.5, x0 + 12, v + 2.5, 1.2, "nf"); ln(x0 + 16, v, x1 - 10 - k * 6, v, "nf lo"); }
  } else if (name === "habits") {                           // three habits, a week of days each, some kept
    const kept = ["1110100", "1101111", "1111000"];
    for (let k = 0; k < 3; k++) for (let d = 0; d < 7; d++) D.push([x0 + 9 + d * 6, y0 + 14 + k * 11, kept[k][d] === "1" ? "dot m" : "dot off"]);
  } else if (name === "calendar") {                          // the week's columns and the block of today
    for (let d = 1; d < 5; d++) ln(x0 + d * 10.8, y0 + 7, x0 + d * 10.8, y1 - 6, "nf lo");
    box(x0 + 33, y0 + 22, x0 + 42, y0 + 36, 1.5, "nf");
  } else if (name === "clock") {                             // the dial and its two hands
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    L.push([poly(ringAt(P, at(circ(21, 28), cx, cy), z)), "nf"]);
    ln(cx, cy, cx - 1, cy - 15, "nf"); ln(cx, cy, cx + 11, cy + 4, "nf lo");
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; D.push([cx + Math.cos(a) * 17.5, cy + Math.sin(a) * 17.5, "dot off"]); }
  }
  return { L, D };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 1.08);
  fit(C, [[BX0, BY0, 0], [BX1, BY1, -6], [BX1, BY0, 0], [BX0, BY1, 0], [4, 4, BH + H + LIFT + PROUD], [238, 4, BH + H + LIFT], [238, 138, BH + H + LIFT]], 200, 170);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [tr, trIn] = rings(BX0, BY0, BX1, BY1, 9, 2.2);
  reflect(svg, g, P, front, tr, 0, 16);
  put(solid(g), prism(P, front, tr, trIn, 0, BH));

  const parts = PARTS.map(([name, x0, y0, x1, y1, h], i) => {
    const grp = mk("g", {}, g), body = solid(grp), top = mk("g", {}, grp);
    const [ring, inner] = rings(x0, y0, x1, y1, 5, 1.6);
    return { name, x0, y0, x1, y1, h, ring, inner, body, top, z: tween(REST[i]), last: null };
  });
  // the canvas's three tasks, chained: small tiles riding on the canvas
  const TASKS = [[18, 84, 52, 108], [72, 84, 106, 108], [126, 84, 160, 108]];
  const tasks = TASKS.map(() => solid(parts[3].top));
  const wires = mk("path", { class: "nf dash" }, parts[3].top);

  function draw(p, z) {
    if (p.last === z) return; p.last = z;
    const z0 = BH + z, z1 = z0 + p.h;
    put(p.body, prism(P, front, p.ring, p.inner, z0, z1));
    if (p.name === "canvas") {
      p.top.replaceChildren(wires, ...tasks.map((t) => t.g));
      TASKS.forEach(([a, b, c, d], k) => { const [r, n] = rings(a, b, c, d, 3, 1.2); put(tasks[k], prism(P, front, r, n, z1, z1 + 4)); tasks[k].sil.classList.toggle("hi", p.hot && k === 0); });
      wires.setAttribute("d", seg(P(52, 96, z1 + 2), P(72, 96, z1 + 2)) + seg(P(106, 96, z1 + 2), P(126, 96, z1 + 2)));
      return;
    }
    const { L, D } = marks(P, p.name, p.x0, p.y0, p.x1, p.y1, z1);
    p.top.replaceChildren();
    for (const [d, cls] of L) mk("path", { d, class: cls }, p.top);
    for (const [x, y, cls] of D) place(mk("circle", { r: 1.15, class: cls }, p.top), P(x, y, z1));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    parts.forEach((p) => { draw(p, Math.round(tval(p.z, now) * 100) / 100); if (!tdone(p.z, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  /** Rule 01: each part is tested at its own resting top, never where it is drawn now. */
  function hit([sx, sy]) {
    let best = -1, bd = Infinity;
    parts.forEach((p, i) => {
      const [x, y] = unproj(C, sx, sy, BH + REST[i] + p.h);
      if (x < p.x0 - 3 || x > p.x1 + 3 || y < p.y0 - 3 || y > p.y1 + 3) return;
      const d = Math.hypot(x - (p.x0 + p.x1) / 2, y - (p.y0 + p.y1) / 2);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  let act = -2;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = parts[a >= 0 ? a : 0];
    act = a;
    parts.forEach((p, i) => {
      const dist = Math.hypot((p.x0 + p.x1 - from.x0 - from.x1) / 2, (p.y0 + p.y1 - from.y0 - from.y1) / 2) / 58;
      tset(p.z, a < 0 ? REST[i] : i === a ? LIFT : 0, now, dist * stag);
      p.hot = a < 0 ? i === 0 : i === a;
      p.body.sil.classList.toggle("hi", p.hot && p.name !== "canvas");
      p.last = null;
    });
    read.textContent = a < 0 ? "rest" : parts[a].name;
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "station",
  means: "Your whole day as one tray: timer, to-dos, habits, calendar, clock and the canvas. Point at a part and it lifts out.",
  rules: [1, 2, 5, 9],
  range: [0, 45, 90],
  tour: [[110, 120], [300, 150], [170, 220], null],
  mount,
});
