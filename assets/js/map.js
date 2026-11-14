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
 *  4. the Sun–Earth–Moon diagram, to scale for the radii, and the same globe
 *     seen from under the south pole.
 *
 * Every number on the page comes from `ephemeris.js` and from the LOLA horizon
 * masks loaded at boot — nothing is decorative.
 */

import { t, siteName, fmtNum, fmtDate } from './i18n.js';
import { siteGeometry } from './ephemeris.js';
import { horizonProfile, horizonAt, isMeasured } from './horizon.js';
import { SUN_LIMB_DEG } from './metrics.js';
import { mountMoon } from './moon3d.js';
import { createOrrery } from './orrery.js';
import { probeBackend, fetchSubsolar } from './live.js';
import { escapeXml as esc } from './charts.js';

const SPEEDS = [
  { factor: 1, label: '1×' },
  { factor: 60, label: '60×' },
  { factor: 600, label: '600×' },
  { factor: 3600, label: '3600×' },
];

const SCRUB_HALF = 354; // half a lunar day, in hours

export function renderMap(root, ctx) {
  const { config, state, actions } = ctx;
  const sites = config.sites;
  const list = sites.filter((s) => s.type !== 'reference');
  const poleSite = sites.find((s) => s.id === 'ref_pole') || sites[0];

  let probe = state.probe ? { ...state.probe } : null;

  root.innerHTML = `
    <section class="map-hero">
      <h1 class="sr-only">${esc(t('map.title'))}</h1>
      <div class="globe-host map-globe" id="globe-host" role="img"
        aria-label="${esc(t('map.lede'))}"></div>

      <div class="map-shadow">
        <div class="shadow-top">
          <p class="shadow-kicker">${esc(t('map.kicker'))}</p>
          <p class="hud-time mono" id="live-clock">—</p>
          <p class="shadow-offset mono" id="scrub-offset">0 h</p>
        </div>

        <canvas class="shadow-strip" id="shadow-strip" height="34"
          aria-label="${esc(t('map.subsolar'))}"></canvas>

        <div class="shadow-bottom">
          <div class="live-speed" role="group" aria-label="${esc(t('map.speed'))}">
            ${SPEEDS.map((s, i) => `<button type="button" class="chip" data-speed="${s.factor}" aria-pressed="${i === 0}">${s.label}</button>`).join('')}
            <button type="button" class="chip" id="live-pause" aria-pressed="false">${esc(t('map.pause'))}</button>
            <button type="button" class="chip" id="live-now">${esc(t('map.now'))}</button>
          </div>
          <dl class="shadow-facts">
            <div><dt>${esc(t('map.subsolar'))}</dt><dd class="mono" id="live-subsolar">—</dd></div>
            <div><dt>${esc(t('map.poleSun'))}</dt><dd class="mono" id="live-pole">—</dd></div>
            <div><dt>${esc(t('map.sitesLit'))}</dt><dd class="mono" id="live-lit">—</dd></div>
          </dl>
        </div>

        <div class="hud-scrub">
          <input type="range" id="time-scrub" min="0" max="708" step="1" value="354"
            aria-label="${esc(t('map.scrub'))}">
          <p class="hint">${esc(t('map.scrubHint'))}</p>
        </div>
      </div>

      <form class="map-probe" id="probe-form" novalidate>
        <div class="probe-head">
          <h2>${esc(t('map.probe.title'))}</h2>
          <p>${esc(t('map.probe.lede'))}</p>
        </div>
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
          <button type="submit" class="btn primary">${esc(t('map.probe.place'))}</button>
          <button type="button" class="btn quiet" id="probe-clear">${esc(t('map.probe.clear'))}</button>
        </div>
        <dl class="probe-out" id="probe-out" aria-live="polite"></dl>
      </form>
    </section>

    <section class="container section map-mid">
      <div class="orbit-card">
        <header>
          <h2>${esc(t('map.orbit.title'))}</h2>
          <p>${esc(t('map.orbit.lede'))}</p>
        </header>
        <canvas id="orrery" height="260"></canvas>
      </div>

      <div class="map-list">
        <header>
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
    </section>

    <section class="map-south">
      <header class="container south-head">
        <h2>${esc(t('map.south.title'))}</h2>
        <p>${esc(t('map.south.lede'))}</p>
      </header>
      <div class="globe-host globe-host-south" id="south-host"></div>
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
  let south = null;
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

    // One column per degree of longitude; the lit hemisphere is the 180°
    // centred on the subsolar point, so the dark bands are the night side.
    for (let lon = 0; lon < 360; lon += 1) {
      const delta = Math.abs(((lon - subLon + 540) % 360) - 180);
      const lit = delta < 90;
      const x = (lon / 360) * w;
      c.fillStyle = lit ? 'rgba(246, 178, 60, 0.55)' : 'rgba(30, 41, 59, 0.85)';
      c.fillRect(x, 0, w / 360 + 0.6, h);
    }

    // The terminator, then where it will be in 24 h: the shadow really moves.
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const lon of [subLon + 90, subLon - 90]) {
      const x = (((lon % 360) + 360) % 360) / 360 * w;
      c.fillRect(x - 0.7, 0, 1.4, h);
    }
    c.fillStyle = 'rgba(168, 242, 255, 0.75)';
    for (const lon of [nextLon + 90, nextLon - 90]) {
      const x = (((lon % 360) + 360) % 360) / 360 * w;
      c.fillRect(x - 0.6, h - 5, 1.2, 5);
    }

    c.font = '9px ui-monospace, monospace';
    c.fillStyle = 'rgba(203,213,225,0.7)';
    c.textAlign = 'center';
    for (const lon of [0, 90, 180, 270]) {
      c.fillText(`${lon}°`, (lon / 360) * w + (lon === 0 ? 12 : 0), h - 8);
    }
    c.textAlign = 'left';
    c.fillStyle = 'rgba(246, 178, 60, 0.9)';
    c.fillText(t('map.legend.sun'), 10, 13);
    c.fillStyle = 'rgba(203,213,225,0.55)';
    c.textAlign = 'right';
    c.fillText(t('map.legend.night'), w - 10, 13);
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
    south?.setProbe(probe);
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
      <div><dt>${esc(t('map.probe.relief'))}</dt>
        <dd class="mono" title="${esc(t('map.probe.flat'))}">0.00° <span class="muted">${esc(t('map.probe.flat'))}</span></dd></div>
      <div><dt>${esc(t('map.probe.lat'))} / ${esc(t('map.probe.lon'))}</dt>
        <dd class="mono">${fmtNum(probe.lat, 2)}° / ${fmtNum(probe.lon, 2)}°</dd></div>
      <div class="probe-state" data-lit="${lit}">
        <span class="chip-dot" aria-hidden="true"></span>
        ${esc(lit ? t('map.probe.lit') : t('map.probe.shadow'))}
      </div>`;
  };

  /* ------------------------------------------------------------------ clock */

  const paint = () => {
    const g = siteGeometry(poleSite, simMs);
    const sub = backendSub && Math.abs(simMs - backendAt) < 60000 ? backendSub : g.subSolar;

    clockEl.textContent = `${new Date(simMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    subEl.textContent = `${fmtNum(sub.lat, 2)}° / ${fmtNum(sub.lon, 2)}°`;
    poleEl.textContent = `${fmtNum(g.sun.alt, 2)}°`;

    const next = siteGeometry(poleSite, simMs + 86400000).subSolar;
    drawStrip(sub.lon, next.lon);

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
    south?.setTime(simMs);
    orrery?.setSun(g.subSolarDir);
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
    root.querySelector('#globe-host').innerHTML = `<p class="scene-hint">${esc(t('map.fallback'))}</p>`;
  });

  mountMoon(root.querySelector('#south-host'), {
    ...common,
    view: 'south',
    hint: '',
  }).then((api) => {
    if (disposed) { api.dispose(); return; }
    south = api;
    api.setProbe(probe);
    api.setTime(simMs);
  }).catch(() => {});

  const orrery = createOrrery(root.querySelector('#orrery'), {
    getMs: () => simMs,
    setMs: (ms) => {
      setPaused(true);
      simMs = ms;
      paint();
    },
  });

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
    orrery.destroy();
    scene?.dispose();
    south?.dispose();
  };
}

export { SCRUB_HALF };
void fmtDate;
