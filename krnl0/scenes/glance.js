/* At a glance: the Hairline station tray is the map, the real app is the territory.
   The part under the pointer (or the tour, when no hand is on it) lights the same part of the screenshot. */
(() => {
  const stage = document.getElementById('gl-stage'), shot = document.querySelector('.gl-shot');
  if (!stage || !shot || !window.HL) return;
  const SAY = {
    timer: ['Timer', 'It records what you are doing, minute by minute.'],
    'to-dos': ['To-dos', 'Every line carries its estimate and the time it really took.'],
    habits: ['Habits', 'One tap a day; the week fills in and the streak counts itself.'],
    calendar: ['Calendar', 'The week, with your tasks and habits already on it.'],
    clock: ['Clock', 'Today drawn on a dial, with what comes next underneath.'],
    canvas: ['Canvas', 'Your plan as a chain of tasks, next to notes, images and videos.'],
  };
  const name = document.getElementById('gl-name'), say = document.getElementById('gl-say');
  const show = (part) => {
    const k = SAY[part] ? part : 'timer';
    shot.dataset.part = k; name.textContent = SAY[k][0]; say.textContent = SAY[k][1];
  };
  window.hairline = (fig) => {
    HL.inject(document);
    stage.setAttribute('data-hairline', fig.name); stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', fig.means);
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
    let text = '';
    const read = { get textContent() { return text; }, set textContent(v) { text = String(v); show(text); } };
    fig.mount({ stage, svg, read }, fig.range[1]);
    // no autoplay: at rest the tray shows the running timer, and it moves only when a hand is on it
  };
})();
