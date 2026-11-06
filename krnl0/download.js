/* Download page: asks GitHub for the releases, offers the newest one for this computer, and lets you pick any
   other version. Every link starts on the releases page, so without script (or without GitHub) it still works. */
(() => {
  const REPO = 'theMindDeveloper/krnl0';
  const PAGE = `https://github.com/${REPO}/releases`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const k = (name, r = document) => $(`[data-k="${name}"]`, r);
  const OSES = ['windows', 'mac', 'linux'];
  const NAME = { windows: 'Windows', mac: 'Mac', linux: 'Linux' };
  const ICON = { windows: '#i-win', mac: '#i-mac', linux: '#i-linux' };
  const KIND = { windows: 'installer', mac: 'disk image', linux: 'AppImage' };

  // a link to a section of the home page may open there (the home page otherwise always opens at the top)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="index.html#"]'); if (!a) return;
    try { sessionStorage.setItem('krnl-jump', '#' + a.getAttribute('href').split('#')[1]); } catch (_) {}
  });

  // which computer is this
  const ua = navigator.userAgent, plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const phone = /iPhone|iPad|iPod|Android/i.test(ua) || (/Mac/i.test(plat) && navigator.maxTouchPoints > 1);
  const detected = /Win/i.test(plat) || /Windows/i.test(ua) ? 'windows' : /Mac/i.test(plat) || /Mac OS X/i.test(ua) ? 'mac' : /Linux|X11/i.test(plat + ua) && !/Android/i.test(ua) ? 'linux' : 'windows';
  const os = phone ? 'windows' : detected;
  if (phone) { const p = $('.dx-phone'); if (p) p.hidden = false; }
  if (!phone) $$('.dx-plate').forEach((p) => p.classList.toggle('is-yours', p.dataset.os === os));

  // the installer for each system in one release
  const pick = (assets) => {
    const real = assets.filter((a) => !/\.blockmap$|\.yml$/i.test(a.name));
    const one = (re) => real.find((a) => re.test(a.name));
    return { windows: one(/\.exe$/i), mac: one(/arm64.*\.dmg$/i) || one(/\.dmg$/i), linux: one(/\.AppImage$/i) || one(/\.deb$/i) };
  };
  const mb = (b) => `${Math.round(b / 1048576)} MB`;

  const go = k('go'), ver = $('.dx-ver'), btn = $('#ver-b'), list = $('#ver-list');
  const setIcon = (o) => { const u = k('go-icon'); if (u) u.setAttribute('href', ICON[o]); };
  setIcon(os); k('go-t').textContent = `Download for ${NAME[os]}`;

  let releases = [], cur = 0;
  const newest = (o) => releases.find((x) => x.files[o]);

  const show = (i) => {
    cur = i; const r = releases[i]; if (!r) return;
    k('ver').textContent = i === 0 ? `${r.tag} · latest` : r.tag;
    $$('[role="option"]', list).forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    // the big button: this computer's file for the chosen version
    const mine = r.files[os];
    if (mine) { go.href = mine.url; k('go-t').textContent = `Download for ${NAME[os]}`; k('meta').textContent = `${r.tag} · ${mine.size} · ${mine.name}`; }
    else { go.href = r.page; k('go-t').textContent = 'See this release'; k('meta').textContent = `${r.tag} has no ${NAME[os]} file yet. Pick another version.`; }
    // each system: its plate and its section
    OSES.forEach((o) => {
      const f = r.files[o], alt = f ? null : newest(o), sec = document.getElementById(o), plate = $(`.dx-plate[data-os="${o}"]`);
      const href = f ? f.url : alt ? alt.files[o].url : PAGE;
      const text = f ? `${f.name} · ${f.size}` : alt ? `Get ${alt.tag}, the newest ${NAME[o]} version` : 'Coming soon';
      if (sec) { sec.classList.toggle('is-none', !f && !alt); const a = k('file', sec); a.href = href; k('file-t', sec).textContent = f || alt ? text : 'Coming soon · see the releases'; }
      if (plate) { plate.classList.toggle('is-none', !f); k('state', plate).textContent = f ? `${KIND[o]} · ${r.tag} · ${f.size}` : alt ? `newest: ${alt.tag}` : 'coming soon'; }
    });
    const win = r.files.windows || (newest('windows') || { files: {} }).files.windows;
    if (win) { const a = k('win-file'), b = k('win-file2'); if (a) a.textContent = win.name; if (b) b.textContent = win.name; }
    const why = k('linux-why'); if (why && !newest('linux')) why.textContent = 'The Linux version is on its way. It will be an AppImage: one file, nothing to install, runs on most distributions. Until then you can run KRNL0 from its source code.';
  };

  // the version list: keyboard and pointer, and it never scrolls the page (only itself)
  let hi = 0;
  const opts = () => $$('[role="option"]', list);
  const keep = (o) => { const t = o.offsetTop, b = t + o.offsetHeight; if (t < list.scrollTop) list.scrollTop = t - 6; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight + 6; };
  const light = (j) => { const os_ = opts(); if (!os_.length) return; hi = Math.max(0, Math.min(os_.length - 1, j)); os_.forEach((o, n) => o.classList.toggle('hi', n === hi)); list.setAttribute('aria-activedescendant', os_[hi].id); keep(os_[hi]); };
  const open = (on) => { list.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { list.focus({ preventScroll: true }); light(cur); } };
  btn.addEventListener('click', () => open(list.hidden));
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); light(hi + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); light(hi - 1); }
    else if (e.key === 'Home') { e.preventDefault(); light(0); }
    else if (e.key === 'End') { e.preventDefault(); light(releases.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(hi); open(false); btn.focus({ preventScroll: true }); }
    else if (e.key === 'Escape' || e.key === 'Tab') { open(false); if (e.key === 'Escape') btn.focus({ preventScroll: true }); }
  });
  list.addEventListener('click', (e) => { const o = e.target.closest('[role="option"]'); if (!o) return; show(+o.dataset.i); open(false); btn.focus({ preventScroll: true }); });
  document.addEventListener('pointerdown', (e) => { if (!list.hidden && !ver.contains(e.target)) open(false); });

  const fill = (rels) => {
    releases = rels; if (!rels.length) return;
    list.innerHTML = '';
    rels.forEach((r, i) => {
      const li = document.createElement('li');
      li.id = `ver-${i}`; li.setAttribute('role', 'option'); li.dataset.i = String(i);
      li.append(document.createElement('b'), document.createElement('span'));
      li.firstChild.textContent = i === 0 ? `${r.tag} · latest` : r.tag;
      li.lastChild.textContent = `${r.date} · ${OSES.filter((s) => r.files[s]).map((s) => NAME[s]).join(', ')}`;
      list.append(li);
    });
    ver.hidden = false;
    const first = rels.findIndex((r) => r.files[os]);              // start on the newest version this computer can use
    show(first < 0 ? 0 : first);
  };

  // GitHub's answer is kept for an hour, so moving around the site doesn't ask again
  try { const c = JSON.parse(sessionStorage.getItem('krnl-rels') || 'null'); if (c && Date.now() - c.at < 36e5) { fill(c.rels); return; } } catch (_) {}
  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((all) => {
      const rels = all.filter((r) => !r.draft && !r.prerelease).map((r) => {
        const f = pick(r.assets || []), files = {};
        for (const s in f) if (f[s]) files[s] = { url: f[s].browser_download_url, name: f[s].name, size: mb(f[s].size) };
        return { tag: r.tag_name, page: r.html_url || PAGE, date: (r.published_at || '').slice(0, 10), files };
      }).filter((r) => Object.keys(r.files).length);
      try { sessionStorage.setItem('krnl-rels', JSON.stringify({ at: Date.now(), rels })); } catch (_) {}
      fill(rels);
    })
    .catch(() => {});
})();
