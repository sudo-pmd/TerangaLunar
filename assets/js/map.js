/**
 * The live map.
 *
 * Four things happen on one page, in reading order:
 *
 *  1. the shadow ribbon at the top: where the subsolar point is, and where the
 *     terminator sits, driven by the clock or by the cursor;
 *  2. the 3D globe, lit by the same subsolar vector;
 *  3. a free study point (click the globe, or type coordinates) with the Sun
 *     and Earth elevation at that exact spot;
 *  4. nothing else: the globe on the right is the whole 3D story.
 *
 * Every number on the page comes from `ephemeris.js` and from the LOLA horizon
 * masks loaded at boot — nothing is decorative.
 */

import { t, siteName, fmtNum } from './i18n.js';
import { siteGeometry } from './ephemeris.js';
import { horizonProfile, horizonAt, isMeasured } from './horizon.js';
import { SUN_LIMB_DEG } from './metrics.js';
import { mountMoon } from './moon3d.js';
import { probeBackend, fetchSubsolar } from './live.js';
import { escapeXml as esc } from './charts.js';

const SPEEDS = [
  { factor: 1, label: '1×' },
  { factor: 60, label: '60×' },
  { factor: 600, label: '600×' },
  { factor: 3600, label: '3600×' },
];

const SCRUB_HALF = 354; // half a lunar day, in hours

// The side index of the map page, in reading order.
const RAIL = [
  ['shadow', 'map.panel.shadow'],
  ['probe', 'map.panel.probe'],
  ['sites', 'map.panel.sites'],
];

export function renderMap(root, ctx) {
  const { config, state, actions } = ctx;
  const sites = config.sites;
  const list = sites.filter((s) => s.type !== 'reference');
  const poleSite = sites.find((s) => s.id === 'ref_pole') || sites[0];

  let probe = state.probe ? { ...state.probe } : null;

  root.innerHTML = `
    <section class="container map-layout">
      <h1 class="sr-only">${esc(t('map.title'))}</h1>

      <div class="map-main">
      <nav class="step-nav map-rail" aria-label="${esc(t('map.rail'))}">
        ${RAIL.map(([id, key], i) => `<button type="button" data-panel="${id}" aria-current="${i === 0 ? 'step' : 'false'}">
          <span class="step-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span>${esc(t(key))}</span>
        </button>`).join('')}
      </nav>

      <div class="map-panels">
        <div class="map-panel" data-panel="shadow">
          <header class="panel-head">
            <h2>${esc(t('map.kicker'))}</h2>
            <p class="shadow-offset mono" id="scrub-offset">0 h</p>
          </header>

          <canvas class="shadow-strip" id="shadow-strip" height="34"
            aria-label="${esc(t('map.subsolar'))}"></canvas>

          <div class="live-speed" role="group" aria-label="${esc(t('map.speed'))}">
            ${SPEEDS.map((s, i) => `<button type="button" class="chip" data-speed="${s.factor}" aria-pressed="${i === 0}">${s.label}</button>`).join('')}
            <button type="button" class="chip" id="live-pause" aria-pressed="false">${esc(t('map.pause'))}</button>
            <button type="button" class="chip" id="live-now">${esc(t('map.now'))}</button>
          </div>

          <div class="hud-scrub">
            <input type="range" id="time-scrub" min="0" max="708" step="1" value="354"
              aria-label="${esc(t('map.scrub'))}">
            <p class="hint">${esc(t('map.scrubHint'))}</p>
          </div>

          <dl class="shadow-facts">
            <div><dt>${esc(t('map.subsolar'))}</dt><dd class="mono" id="live-subsolar">—</dd></div>
            <div><dt>${esc(t('map.poleSun'))}</dt><dd class="mono" id="live-pole">—</dd></div>
            <div><dt>${esc(t('map.sitesLit'))}</dt><dd class="mono" id="live-lit">—</dd></div>
          </dl>
        </div>

        <div class="map-panel" data-panel="probe" hidden>
          <header class="panel-head">
            <h2>${esc(t('map.probe.title'))}</h2>
            <p>${esc(t('map.probe.lede'))}</p>
          </header>
          <form id="probe-form" novalidate>
            <div class="probe-fields">
              <label class="field">
                <span>${esc(t('map.probe.lat'))}</span>
                <input type="number" id="probe-lat" step="0.01" min="-90" max="90"
                  value="${probe ? probe.lat.toFixed(2) : ''}" placeholder="-84.50">
              </label>
              <label class="field">
                <span>${esc(t('map.probe.lon'))}</span>
                <input type="number" id="probe-lon" step="0.01" min="-180" max="360"
                  value="${probe ? probe.lon.toFixed(2) : ''}" placeholder="12.30">
              </label>
            </div>
            <label class="field">
              <span>${esc(t('map.probe.name'))}</span>
              <input type="text" id="probe-name" maxlength="60" autocomplete="off"
                value="${esc(state.probeName || '')}" placeholder="${esc(t('study.name.ph'))}">
            </label>
            <div class="panel-actions">
              <button type="submit" class="btn primary">${esc(t('map.probe.place'))}</button>
              <button type="button" class="btn quiet" id="probe-clear">${esc(t('map.probe.clear'))}</button>
            </div>
            <dl class="probe-out" id="probe-out" aria-live="polite"></dl>
          </form>
        </div>

        <div class="map-panel" data-panel="sites" hidden>
          <header class="panel-head">
            <h2>${esc(t('map.list.title'))}</h2>
            <p>${esc(t('map.list.lede'))}</p>
          </header>
          <ul class="clps-chips" id="live-list">
            ${list.map((site) => `<li>
              <button type="button" class="clps-chip" data-site="${esc(site.id)}" data-state="${esc(site.id)}">
                <span class="chip-dot" aria-hidden="true"></span>
                <span class="chip-name">${esc(siteName(site))}</span>
                <span class="chip-value mono">—</span>
              </button>
            </li>`).join('')}
          </ul>
          <p class="data-note">${esc(t('map.clockNote'))}</p>
        </div>

      </div>
      </div>

      <aside class="map-globe-col">
        <div class="globe-host map-globe" id="globe-host" role="img"
          aria-label="${esc(t('map.lede'))}"></div>
        <div class="map-hero-bar">
          <p class="hud-time mono" id="live-clock">—</p>
          <p class="map-hero-hint">${esc(t('map.heroHint'))}</p>
        </div>
      </aside>
    </section>`;

  const clockEl = root.querySelector('#live-clock');
  const subEl = root.querySelector('#live-subsolar');
  const poleEl = root.querySelector('#live-pole');
  const litEl = root.querySelector('#live-lit');
  const pauseBtn = root.querySelector('#live-pause');
  const scrub = root.querySelector('#time-scrub');
  const scrubOffset = root.querySelector('#scrub-offset');
  const stripCanvas = root.querySelector('#shadow-strip');
  const stripCtx = stripCanvas.getContext('2d');
  const probeOut = root.querySelector('#probe-out');
  const latInput = root.querySelector('#probe-lat');
  const lonInput = root.querySelector('#probe-lon');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let origin = Date.now();
  let simMs = origin;
  let speed = 1;
  let paused = false;
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  let scene = null;
  let backendSub = null;
  let backendAt = 0;
  let lastPaint = 0;

  /* ----------------------------------------------------------- shadow ribbon */

  const drawStrip = (subLon, nextLon) => {
    const rect = stripCanvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || 640));
    const h = 34;
    if (stripCanvas.width !== w * 2) {
      stripCanvas.width = w * 2;
      stripCanvas.height = h * 2;
    }
    const c = stripCtx;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, w, h);

    const xOf = (lon) => (((lon % 360) + 360) % 360) / 360 * w;

    // Night everywhere, then the lit hemisphere as one arc (two rectangles
    // when it wraps past 0/360). Two crisp bands beat 360 one-pixel columns.
    c.fillStyle = 'rgba(24, 33, 50, 0.92)';
    c.fillRect(0, 0, w, h);

    const start = xOf(subLon - 90);
    const end = xOf(subLon + 90);
    c.fillStyle = 'rgba(246, 178, 60, 0.55)';
    if (start <= end) {
      c.fillRect(start, 0, end - start, h);
    } else {
      c.fillRect(start, 0, w - start, h);
      c.fillRect(0, 0, end, h);
    }

    // Longitude ticks.
    c.fillStyle = 'rgba(8, 12, 20, 0.35)';
    for (let lon = 0; lon < 360; lon += 30) c.fillRect(xOf(lon), 0, 1, h);

    // The terminator now, and where it will be in 24 h: the shadow really moves.
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (const lon of [subLon + 90, subLon - 90]) c.fillRect(xOf(lon) - 0.8, 0, 1.6, h);
    c.fillStyle = 'rgba(168, 242, 255, 0.8)';
    for (const lon of [nextLon + 90, nextLon - 90]) c.fillRect(xOf(lon) - 0.7, h - 6, 1.4, 6);

    c.font = '9px ui-monospace, monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(8, 12, 20, 0.75)';
    for (const lon of [0, 90, 180, 270]) {
      c.fillText(`${lon}°`, Math.min(w - 14, Math.max(14, xOf(lon))), h - 8);
    }

    // Labels sit on a dark pill: they must read over the gold band too.
    const label = (text, x, align) => {
      c.textAlign = align;
      const boxW = c.measureText(text).width + 10;
      c.fillStyle = 'rgba(6, 10, 18, 0.62)';
      c.fillRect(align === 'left' ? x - 5 : x - boxW + 5, 1, boxW, 14);
      c.fillStyle = 'rgba(236, 242, 252, 0.92)';
      c.fillText(text, x, 12);
    };
    label(t('map.legend.sun'), 10, 'left');
    label(t('map.legend.night'), w - 10, 'right');
  };

  /* ----------------------------------------------------------------- probe */

  const probeGeometry = () => {
    if (!probe) return null;
    return siteGeometry({ id: `probe_${probe.lat}_${probe.lon}`, lat: probe.lat, lon: probe.lon }, simMs);
  };

  const setProbe = (next, { commit = true } = {}) => {
    probe = next && Number.isFinite(next.lat) && Number.isFinite(next.lon)
      ? { lat: next.lat, lon: ((next.lon % 360) + 360) % 360 }
      : null;
    if (probe) {
      latInput.value = probe.lat.toFixed(2);
      lonInput.value = probe.lon.toFixed(2);
    } else {
      latInput.value = '';
      lonInput.value = '';
    }
    scene?.setProbe(probe);
    paintProbe();
    if (commit) actions.setProbe(probe, { silent: true });
  };

  const paintProbe = () => {
    const g = probeGeometry();
    if (!g) {
      probeOut.innerHTML = `<div class="probe-empty">${esc(t('map.probe.none'))}</div>`;
      return;
    }
    const lit = g.sun.alt > 0.27;
    probeOut.innerHTML = `
      <div><dt>${esc(t('map.probe.sun'))}</dt>
        <dd class="mono">${fmtNum(g.sun.alt, 2)}° <span class="muted">/ ${fmtNum(g.sun.az, 0)}°</span></dd></div>
      <div><dt>${esc(t('map.probe.earth'))}</dt>
        <dd class="mono">${fmtNum(g.earth.alt, 2)}° <span class="muted">/ ${fmtNum(g.earth.az, 0)}°</span></dd></div>
      <div><dt>${esc(t('map.probe.lat'))} / ${esc(t('map.probe.lon'))}</dt>
        <dd class="mono">${fmtNum(probe.lat, 2)}° / ${fmtNum(probe.lon, 2)}°</dd></div>
      <div class="probe-state" data-lit="${lit}">
        <span class="chip-dot" aria-hidden="true"></span>
        ${esc(lit ? t('map.probe.lit') : t('map.probe.shadow'))}
      </div>
      <div class="probe-actions">
        <button type="button" class="btn primary" data-study>${esc(t('map.probe.study'))}</button>
        <button type="button" class="btn quiet" data-print-study>${esc(t('map.probe.print'))}</button>
      </div>`;
  };

  /* ------------------------------------------------------------------ clock */

  const paint = () => {
    const g = siteGeometry(poleSite, simMs);
    const sub = backendSub && Math.abs(simMs - backendAt) < 60000 ? backendSub : g.subSolar;

    clockEl.textContent = `${new Date(simMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    subEl.textContent = `${fmtNum(sub.lat, 2)}° / ${fmtNum(sub.lon, 2)}°`;
    poleEl.textContent = `${fmtNum(g.sun.alt, 2)}°`;

    // The ribbon only lives in its own panel: do not paint a hidden canvas.
    const stripVisible = stripCanvas.offsetParent !== null;
    if (stripVisible) {
      const next = siteGeometry(poleSite, simMs + 86400000).subSolar;
      drawStrip(sub.lon, next.lon);
    }

    let lit = 0;
    for (const site of list) {
      const sg = siteGeometry(site, simMs);
      const limit = horizonAt(horizonProfile(site), sg.sun.az) + SUN_LIMB_DEG;
      const on = sg.sun.alt > limit;
      if (on) lit += 1;
      const chip = root.querySelector(`[data-state="${site.id}"]`);
      if (chip) {
        chip.dataset.lit = String(on);
        const value = chip.querySelector('.chip-value');
        if (value) value.textContent = `${fmtNum(sg.sun.alt, 1)}°`;
        chip.title = `${siteName(site)} · ${fmtNum(sg.sun.alt, 1)}° ${t('map.probe.sun')}`
          + (isMeasured(site.id) ? ` · ${t('terrain.measured')}` : '');
      }
    }
    litEl.textContent = `${lit} / ${list.length}`;

    const hours = Math.round((simMs - origin) / 3600000) + SCRUB_HALF;
    scrub.value = String(Math.max(0, Math.min(708, hours)));
    const shown = Number(scrub.value) - SCRUB_HALF;
    scrubOffset.textContent = `${shown > 0 ? '+' : ''}${shown} ${t('ui.hours')}`;

    scene?.setTime(simMs);
    paintProbe();
  };

  const setPaused = (next) => {
    paused = next;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? t('map.resume') : t('map.pause');
  };

  const tick = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(2000, now - last);
    last = now;
    if (!paused) simMs += dt * speed;
    if (now - lastPaint > 220) {
      lastPaint = now;
      paint();
    }
  };

  /* -------------------------------------------------------------- wiring */

  root.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed) || 1;
      setPaused(false);
      last = performance.now();
      root.querySelectorAll('[data-speed]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other === button));
      });
    });
  });
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  root.querySelector('#live-now').addEventListener('click', () => {
    origin = Date.now();
    simMs = origin;
    paint();
  });

  scrub.addEventListener('input', () => {
    setPaused(true);
    simMs = origin + (Number(scrub.value) - SCRUB_HALF) * 3600000;
    last = performance.now();
    paint();
  });

  root.querySelectorAll('[data-site]').forEach((button) => {
    button.addEventListener('click', () => actions.openSite(button.dataset.site));
    // Pointing at a row in the list lights that site on the globe, exactly as
    // hovering the marker itself would.
    const light = () => scene?.highlightSite(button.dataset.site);
    const dark = () => scene?.highlightSite(null);
    button.addEventListener('pointerenter', light);
    button.addEventListener('focus', light);
    button.addEventListener('pointerleave', dark);
    button.addEventListener('blur', dark);
  });

  root.querySelector('#probe-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const lat = Number(latInput.value);
    const lon = Number(lonInput.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) {
      probeOut.innerHTML = `<div class="probe-empty">${esc(t('map.probe.none'))}</div>`;
      return;
    }
    setProbe({ lat, lon });
  });
  root.querySelector('#probe-clear').addEventListener('click', () => setProbe(null));

  const nameInput = root.querySelector('#probe-name');
  nameInput.addEventListener('input', () => actions.setProbeName?.(nameInput.value));

  // The readout is repainted on every tick, so the two study buttons are wired
  // by delegation instead of being rebound each time.
  probeOut.addEventListener('click', (event) => {
    if (event.target.closest('[data-study]')) actions.openStudy();
    else if (event.target.closest('[data-print-study]')) actions.openStudy({ print: true });
  });

  /* ---------------------------------------------------------------- scenes */

  const common = {
    sites,
    live: true,
    dateMs: simMs,
    reducedMotion,
    onSelect: (id) => actions.openSite(id),
    onPick: (point) => setProbe(point),
    probe,
  };

  mountMoon(root.querySelector('#globe-host'), {
    ...common,
    hint: t('map.hint'),
  }).then((api) => {
    if (disposed) { api.dispose(); return; }
    scene = api;
    api.setProbe(probe);
    api.setTime(simMs);
  }).catch(() => {
    root.querySelector('#globe-host').innerHTML = `<p class="scene-hint is-fallback">${esc(t('map.fallback'))}</p>`;
  });

  // The lower panels are built the first time they are opened: a hidden
  // canvas has no width, and a second WebGL context costs memory we do not
  // need until the reader asks for the pole view.
  /* ------------------------------------------------------------ side menu */

  const railButtons = [...root.querySelectorAll('.map-rail [data-panel]')];
  const panels = [...root.querySelectorAll('.map-panel')];

  const openPanel = (id) => {
    railButtons.forEach((button) => {
      button.setAttribute('aria-current', button.dataset.panel === id ? 'step' : 'false');
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== id; });
    if (id === 'shadow') paint();
  };

  railButtons.forEach((button) => {
    button.addEventListener('click', () => openPanel(button.dataset.panel));
  });
  openPanel('shadow');

  // The Python service, when it runs, supplies the subsolar point; without it
  // the local ephemeris is already on screen.
  let backendTimer = 0;
  probeBackend().then((status) => {
    if (!status?.online || disposed) return;
    const refresh = async () => {
      if (disposed) return;
      backendAt = simMs;
      backendSub = await fetchSubsolar(simMs);
      paint();
    };
    refresh();
    backendTimer = setInterval(refresh, 5000);
  });

  paint();
  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearInterval(backendTimer);
    scene?.dispose();
  };
}


