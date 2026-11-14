/**
 * Public-facing pages added by the TerangaLunar redesign: the live 3D map, the
 * guided tour, the site catalogue and the science space.
 *
 * All three reuse the same engine as the mission sheets, so there is exactly
 * one source of numbers on the site.
 */

import {
  t, tValue, siteName, fmtNum, fmtDate, fmtTime, fmtDuration, getLang,
} from './i18n.js';
import {
  buildSeries, seriesFor, aggregate, score, bestDates, HOUR_MS, DAY_MS,
  SUN_LIMB_DEG, LUNAR_DAY_DAYS,
} from './metrics.js';
import { siteGeometry } from './ephemeris.js';
import { horizonProfile, horizonAt } from './horizon.js';
import {
  horizonSvg, timelineSvg, heatmapSvg, escapeXml as esc,
} from './charts.js';
import { mountMoon } from './moon3d.js';
import { siteCard } from './views.js';
import { probeBackend, fetchSubsolar } from './live.js';

const RAD = Math.PI / 180;

function pageHead(kicker, title, lede) {
  return `<section class="container page-head">
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(title)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  </section>`;
}

function siteSunState(site, ms) {
  const g = siteGeometry(site, ms);
  const limit = horizonAt(horizonProfile(site), g.sun.az) + SUN_LIMB_DEG;
  return { sun: g.sun, earth: g.earth, lit: g.sun.alt > limit, g };
}

/* -------------------------------------------------------------- catalogue */

export function renderSites(root, ctx) {
  const { config } = ctx;
  const sites = config.sites;

  root.innerHTML = `
    ${pageHead(t('sites.kicker'), t('sites.title'), t('sites.lede'))}
    <section class="container section" aria-labelledby="catalogue-title">
      <header class="section-head">
        <h2 id="catalogue-title">${esc(t('home.list.title'))}</h2>
        <p>${esc(t('sites.filterHint'))}</p>
      </header>
      <div class="filters" role="group" aria-label="${esc(t('home.filter.company'))}">
        <label class="field">
          <span>${esc(t('home.filter.company'))}</span>
          <select id="filter-company">
            <option value="">${esc(t('home.filter.all'))}</option>
            ${[...new Set(sites.map((s) => s.company))].map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>${esc(t('home.filter.status'))}</span>
          <select id="filter-status">
            <option value="">${esc(t('home.filter.allStatus'))}</option>
            ${['landed', 'planned', 'lost', 'reference'].map((s) => `<option value="${s}">${esc(tValue('status', s))}</option>`).join('')}
          </select>
        </label>
      </div>
      <ul class="site-grid" id="site-grid">${sites.map(siteCard).join('')}</ul>
    </section>`;

  const grid = root.querySelector('#site-grid');
  const applyFilters = () => {
    const company = root.querySelector('#filter-company').value;
    const status = root.querySelector('#filter-status').value;
    grid.querySelectorAll('li').forEach((li) => {
      li.hidden = !((!company || li.dataset.company === company)
        && (!status || li.dataset.status === status));
    });
  };
  root.querySelector('#filter-company').addEventListener('change', applyFilters);
  root.querySelector('#filter-status').addEventListener('change', applyFilters);
  return null;
}

/* ------------------------------------------------------------------- map */

const SPEEDS = [
  { id: 'x1', factor: 1, label: '1×' },
  { id: 'x60', factor: 60, label: '60×' },
  { id: 'x600', factor: 600, label: '600×' },
  { id: 'x3600', factor: 3600, label: '3600×' },
];

export function renderMap(root, ctx) {
  const { config, actions } = ctx;
  const sites = config.sites;
  const list = sites.filter((s) => s.type !== 'reference');

  root.innerHTML = `
    ${pageHead(t('map.kicker'), t('map.title'), '')}

    <section class="map-stage">
      <div class="globe-host" id="globe-host" role="img"
        aria-label="${esc(t('map.lede'))}"></div>

      <div class="map-hud">
        <div class="hud-line">
          <span class="hud-time mono" id="live-clock">—</span>
          <div class="live-speed" role="group" aria-label="${esc(t('map.speed'))}">
            ${SPEEDS.map((s, i) => `<button type="button" class="chip" data-speed="${s.factor}" aria-pressed="${i === 0}">${s.label}</button>`).join('')}
            <button type="button" class="chip" id="live-pause" aria-pressed="false">${esc(t('map.pause'))}</button>
            <button type="button" class="chip" id="live-now">${esc(t('map.now'))}</button>
          </div>
        </div>
        <div class="hud-line hud-scrub">
          <input type="range" id="time-scrub" min="0" max="708" step="1" value="354"
            aria-label="${esc(t('map.scrub'))}">
          <output class="mono small" id="scrub-offset">0 h</output>
        </div>
      </div>
    </section>

    <section class="container section">
      <div class="map-layout">
        <div class="inset-card">
          <h2>${esc(t('map.inset.title'))}</h2>
          <canvas id="polar-inset" width="320" height="320"></canvas>
          <p class="inset-legend">
            <span><i class="swatch" style="background:#f59e0b"></i>${esc(t('map.legend.sun'))}</span>
            <span><i class="swatch" style="background:#1e293b;border:1px solid #94a3b8"></i>${esc(t('map.legend.night'))}</span>
          </p>
          <dl class="live-readout">
            <div><dt>${esc(t('map.subsolar'))}</dt><dd class="mono" id="live-subsolar">—</dd></div>
            <div><dt>${esc(t('map.poleSun'))}</dt><dd class="mono" id="live-pole">—</dd></div>
            <div><dt>${esc(t('map.sitesLit'))}</dt><dd class="mono" id="live-lit">—</dd></div>
          </dl>
        </div>
        <div class="inset-card">
          <h2>${esc(t('map.list.title'))}</h2>
          <ul class="site-list-live" id="live-list">
            ${list.map((site) => `<li>
              <button type="button" data-site="${esc(site.id)}">
                <span>${esc(siteName(site))}</span>
                <span class="mono" data-state="${esc(site.id)}">—</span>
              </button>
            </li>`).join('')}
          </ul>
        </div>
      </div>
    </section>`;

  const clockEl = root.querySelector('#live-clock');
  const subEl = root.querySelector('#live-subsolar');
  const poleEl = root.querySelector('#live-pole');
  const litEl = root.querySelector('#live-lit');
  const pauseBtn = root.querySelector('#live-pause');
  const inset = root.querySelector('#polar-inset');
  const insetCtx = inset.getContext('2d');
  const poleSite = sites.find((s) => s.id === 'ref_pole') || sites[0];

  const SCRUB_HALF = 354; // half of 29.5 days, in hours
  const scrub = root.querySelector('#time-scrub');
  const scrubOffset = root.querySelector('#scrub-offset');
  let origin = Date.now();
  let simMs = origin;
  let speed = 1;
  let paused = false;
  let last = performance.now();
  let raf = 0;
  let scene = null;
  let disposed = false;
  let backendSub = null;
  let backendAt = 0;
  let lastPaint = 0;

  const paint = () => {
    const g = siteGeometry(poleSite, simMs);
    const sub = backendSub && Math.abs(simMs - backendAt) < 60000
      ? backendSub
      : g.subSolar;
    clockEl.textContent = `${new Date(simMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    subEl.textContent = `${fmtNum(sub.lat, 2)}° / ${fmtNum(sub.lon, 2)}°`;
    poleEl.textContent = `${fmtNum(g.sun.alt, 2)}°`;
    let lit = 0;
    for (const site of list) {
      const state = siteSunState(site, simMs);
      if (state.lit) lit += 1;
      const cell = root.querySelector(`[data-state="${site.id}"]`);
      if (cell) {
        cell.textContent = state.lit
          ? `${t('map.legend.sun')} · ${fmtNum(state.sun.alt, 1)}°`
          : `${t('map.legend.night')} · ${fmtNum(state.sun.alt, 1)}°`;
      }
    }
    litEl.textContent = `${lit} / ${list.length}`;

    // Keep the cursor under the thumb of the clock, and the offset readable.
    const hoursFromOrigin = Math.round((simMs - origin) / HOUR_MS) + SCRUB_HALF;
    scrub.value = String(Math.max(0, Math.min(708, hoursFromOrigin)));
    const shown = Number(scrub.value) - SCRUB_HALF;
    scrubOffset.textContent = `${shown > 0 ? '+' : ''}${shown} ${t('ui.hours')}`;

    drawPolar(insetCtx, sites, simMs, g.subSolarDir);
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
    if (scene && typeof scene.setTime === 'function') scene.setTime(simMs);
    if (now - lastPaint > 240) {
      lastPaint = now;
      paint();
    }
  };
  raf = requestAnimationFrame(tick);

  root.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed) || 1;
      setPaused(false); // choosing a speed means "play at this speed"
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
    if (scene && typeof scene.setTime === 'function') scene.setTime(simMs);
  });

  // The time cursor: dragging it stops the clock and moves the shadow itself.
  scrub.addEventListener('input', () => {
    setPaused(true);
    simMs = origin + (Number(scrub.value) - SCRUB_HALF) * HOUR_MS;
    if (scene && typeof scene.setTime === 'function') scene.setTime(simMs);
    last = performance.now();
    paint();
  });
  root.querySelectorAll('[data-site]').forEach((button) => {
    button.addEventListener('click', () => actions.openSite(button.dataset.site));
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  mountMoon(root.querySelector('#globe-host'), {
    sites,
    live: true,
    dateMs: simMs,
    reducedMotion,
    hint: t('map.hint'),
    onSelect: (id) => actions.openSite(id),
  }).then((api) => {
    if (disposed) {
      api.dispose();
      return;
    }
    scene = api;
    if (typeof scene.setTime === 'function') scene.setTime(simMs);
  }).catch(() => {
    root.querySelector('#globe-host').innerHTML = `<p class="scene-hint">${esc(t('map.fallback'))}</p>`;
  });

  // Use the Python service when it is running; it is queried again as the clock
  // moves so the readout stays meaningful.
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

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearInterval(backendTimer);
    if (scene) scene.dispose();
  };
}

/** Orthographic view from above the south pole, with the real terminator. */
function drawPolar(ctx, sites, ms, sunDir) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = 138;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#080b14';
  ctx.fillRect(0, 0, size, size);

  // Sunlit hemisphere, sampled on a grid: this is the terminator itself.
  const step = 4;
  for (let py = -R; py <= R; py += step) {
    for (let px = -R; px <= R; px += step) {
      if (px * px + py * py > R * R) continue;
      const nx = px / R;
      const ny = -py / R;
      const nz = -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const dot = nx * sunDir.x + ny * sunDir.y + nz * sunDir.z;
      ctx.fillStyle = dot > 0 ? 'rgba(245, 158, 11, 0.20)' : 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(cx + px, cy + py, step, step);
    }
  }

  // Rim and the 80S circle.
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * Math.cos(80 * RAD), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const project = (lat, lon) => ({
    x: cx + Math.cos(lat * RAD) * Math.cos(lon * RAD) * R,
    y: cy - Math.cos(lat * RAD) * Math.sin(lon * RAD) * R,
    front: Math.sin(lat * RAD) < 0,
  });

  for (const site of sites) {
    if (site.type === 'reference') continue;
    const p = project(site.lat, site.lon);
    const state = siteSunState(site, ms);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = state.lit ? '#f59e0b' : '#94a3b8';
    ctx.globalAlpha = p.front ? 1 : 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#080b14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/* ----------------------------------------------------------------- learn */

function polarSites(config) {
  const polar = config.sites.filter((s) => s.type === 'polar');
  return polar.length ? polar : config.sites;
}

export function renderLearn(root, ctx) {
  const { config, state, actions } = ctx;
  const candidates = polarSites(config);
  const local = {
    step: 1,
    siteId: (candidates[0] || config.sites[0]).id,
    dateMs: state.dateMs,
    stayDays: state.stayDays,
  };

  root.innerHTML = `
    ${pageHead(t('learn.kicker'), t('learn.title'), t('learn.lede'))}
    <section class="container section">
      <div class="steps">
        <nav class="step-nav" aria-label="${esc(t('learn.title'))}">
          ${[1, 2, 3, 4].map((n) => `<button type="button" data-step="${n}">
            <span class="step-num">0${n}</span>
            <span>${esc(t(`learn.s${n}`))}</span>
          </button>`).join('')}
        </nav>
        <div class="step-body" id="learn-body" aria-live="polite"></div>
      </div>
      <p class="data-note" style="margin-top:var(--s-5)">
        <a href="#/discover">${esc(t('nav.discover'))}</a> · <a href="#/help">${esc(t('nav.method'))}</a>
      </p>
    </section>`;

  const body = root.querySelector('#learn-body');

  const siteControls = () => `<label class="field">
      <span>${esc(t('learn.site'))}</span>
      <select id="learn-site">
        ${candidates.map((s) => `<option value="${esc(s.id)}"${s.id === local.siteId ? ' selected' : ''}>${esc(siteName(s))}</option>`).join('')}
      </select>
    </label>`;

  const dateControls = () => `<label class="field">
      <span>${esc(t('learn.date'))}</span>
      <input type="date" id="learn-date" value="${new Date(local.dateMs).toISOString().slice(0, 10)}">
    </label>`;

  const bindCommon = (site) => {
    const sel = body.querySelector('#learn-site');
    if (sel) {
      sel.addEventListener('change', () => {
        local.siteId = sel.value;
        paint();
      });
    }
    const date = body.querySelector('#learn-date');
    if (date) {
      date.addEventListener('change', () => {
        const ms = Date.parse(`${date.value}T12:00:00Z`);
        if (Number.isFinite(ms)) {
          local.dateMs = ms;
          paint();
        }
      });
    }
    const open = body.querySelector('[data-open-sheet]');
    if (open) {
      open.addEventListener('click', () => actions.openSite(site.id, local.dateMs));
    }
  };

  const step1 = () => {
    const site = config.byId.get(local.siteId) || candidates[0];
    const series = buildSeries(site, local.dateMs, 25, HOUR_MS);
    return {
      site,
      html: `<h2>${esc(t('learn.s1t'))}</h2>
        <p class="step-lede">${esc(t('learn.s1b'))}</p>
        <div class="step-controls">${siteControls()}${dateControls()}</div>
        <figure class="step-figure">
          <div class="chart-host">${horizonSvg({ series, index: 12, profile: horizonProfile(site) })}</div>
          <figcaption>${esc(t('learn.s1hint'))}</figcaption>
        </figure>`,
    };
  };

  const step2 = () => {
    const site = config.byId.get(local.siteId) || candidates[0];
    const flat = { ...site, id: `${site.id}__flat`, horizon: { max: 0, az: 0, rough: 0 } };
    const relief = aggregate(seriesFor(site, local.dateMs, local.stayDays), 0, Infinity);
    const bare = aggregate(seriesFor(flat, local.dateMs, local.stayDays), 0, Infinity);
    return {
      site,
      html: `<h2>${esc(t('learn.s2t'))}</h2>
        <p class="step-lede">${esc(t('learn.s2b'))}</p>
        <div class="step-controls">${siteControls()}${dateControls()}</div>
        <div class="science-grid" style="margin-top:var(--s-5)">
          <article class="stat tone-sun">
            <h3 class="stat-label">${esc(t('learn.s2relief'))}</h3>
            <p class="stat-value mono">${fmtNum(relief.sunPct, 0)} %</p>
            <p class="stat-help">${esc(t('metric.sun'))} · ${esc(fmtDuration(relief.maxNightHours))}</p>
          </article>
          <article class="stat">
            <h3 class="stat-label">${esc(t('learn.s2flat'))}</h3>
            <p class="stat-value mono">${fmtNum(bare.sunPct, 0)} %</p>
            <p class="stat-help">${esc(t('metric.sun'))} · ${esc(fmtDuration(bare.maxNightHours))}</p>
          </article>
        </div>
        <p class="data-note">${esc(t('learn.flatVsRelief'))} — ${fmtNum(relief.sunPct, 0)} % / ${fmtNum(bare.sunPct, 0)} %</p>`,
    };
  };

  const step3 = () => {
    const site = config.byId.get(local.siteId) || candidates[0];
    const series = seriesFor(site, local.dateMs, local.stayDays);
    const m = aggregate(series, 0, series.count);
    return {
      site,
      html: `<h2>${esc(t('learn.s3t'))}</h2>
        <p class="step-lede">${esc(t('learn.s3b'))}</p>
        <div class="step-controls">${siteControls()}${dateControls()}</div>
        <div class="science-grid" style="margin-top:var(--s-5)">
          <article class="stat tone-earth">
            <h3 class="stat-label">${esc(t('metric.earth'))}</h3>
            <p class="stat-value mono">${fmtNum(m.earthPct, 0)} %</p>
            <p class="stat-help">${esc(fmtDuration(m.hours))}</p>
          </article>
          <article class="stat">
            <h3 class="stat-label">${esc(t('site.stay'))}</h3>
            <p class="stat-value mono">${fmtNum(m.hours / 24, 0)} <span class="stat-unit">${esc(t('ui.days'))}</span></p>
            <p class="stat-help">${esc(fmtDate(m.startMs))} → ${esc(fmtDate(m.endMs))}</p>
          </article>
        </div>
        <figure class="step-figure">
          <div class="chart-host chart-host-timeline">${timelineSvg({
            series, i0: 0, i1: series.count - 1, stayI0: 0, stayI1: series.count - 1, index: Math.floor(series.count / 2),
          })}</div>
          <figcaption>${esc(t('metric.earth.help'))}</figcaption>
        </figure>`,
    };
  };

  const step4 = () => {
    const site = config.byId.get(local.siteId) || candidates[0];
    const yearStart = Date.UTC(new Date(local.dateMs).getUTCFullYear(), 0, 1);
    const year = new Date(yearStart).getUTCFullYear();
    const data = bestDates(site, local.stayDays, state.weights, yearStart);
    return {
      site,
      html: `<h2>${esc(t('learn.s4t'))}</h2>
        <p class="step-lede">${esc(t('learn.s4b'))}</p>
        <div class="step-controls">${siteControls()}</div>
        <figure class="step-figure">
          <div class="chart-host chart-host-heatmap">${heatmapSvg({ results: data.results, year })}</div>
        </figure>
        <ol class="plain-list">
          ${data.top.slice(0, 3).map((row) => `<li>${esc(fmtDate(row.startMs))} — ${fmtNum(row.score, 0)} · ${fmtNum(row.sunPct, 0)} % · ${esc(fmtDuration(row.maxNightHours))}</li>`).join('')}
        </ol>
        <div class="step-pager">
          <button type="button" class="btn primary" data-open-sheet>${esc(t('learn.openSheet'))}</button>
        </div>`,
    };
  };

  const builders = { 1: step1, 2: step2, 3: step3, 4: step4 };

  const paint = () => {
    const view = builders[local.step]();
    body.innerHTML = view.html;
    bindCommon(view.site);
    root.querySelectorAll('[data-step]').forEach((button) => {
      button.setAttribute('aria-current', Number(button.dataset.step) === local.step ? 'step' : 'false');
    });
  };

  root.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      local.step = Number(button.dataset.step);
      paint();
    });
  });

  paint();
  return null;
}

/* --------------------------------------------------------------- science */

export function renderScience(root, ctx) {
  const { config, state, actions } = ctx;
  const sites = config.sites;
  const rows = sites.map((site) => {
    const series = seriesFor(site, state.dateMs, state.stayDays);
    const m = aggregate(series, 0, series.count);
    return { site, m, sc: score(m, state.weights) };
  }).sort((a, b) => b.sc - a.sc);

  root.innerHTML = `
    ${pageHead(t('science.kicker'), t('science.title'), t('science.lede'))}
    <section class="container section">
      <p class="data-note" style="border:0;margin:0 0 var(--s-3)">
        ${esc(fmtDate(state.dateMs))} · ${fmtNum(state.stayDays, 0)} ${esc(t('ui.days'))} · ${esc(t('science.table.lede'))}
      </p>
      <div class="table-scroll">
        <table class="data-table">
          <caption>${esc(t('science.table.title'))}</caption>
          <thead><tr>
            <th scope="col">${esc(t('science.col.site'))}</th>
            <th scope="col">${esc(t('science.col.coords'))}</th>
            <th scope="col">${esc(t('science.col.sun'))}</th>
            <th scope="col">${esc(t('science.col.night'))}</th>
            <th scope="col">${esc(t('science.col.earth'))}</th>
            <th scope="col">${esc(t('science.col.score'))}</th>
            <th scope="col">${esc(t('science.col.status'))}</th>
          </tr></thead>
          <tbody>
            ${rows.map(({ site, m, sc }) => `<tr>
              <td><a href="#/site/${encodeURIComponent(site.id)}?d=${new Date(state.dateMs).toISOString().slice(0, 16)}&n=${state.stayDays}">${esc(siteName(site))}</a></td>
              <td class="mono">${fmtNum(site.lat, 2)}° / ${fmtNum(site.lon, 2)}°</td>
              <td class="mono">${fmtNum(m.sunPct, 0)} %</td>
              <td class="mono">${esc(fmtDuration(m.maxNightHours))}</td>
              <td class="mono">${fmtNum(m.earthPct, 0)} %</td>
              <td class="mono">${fmtNum(sc, 0)}</td>
              <td>${esc(tValue('status', site.status))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="data-note">${esc(t('science.precision.pass'))}</p>
    </section>

    <section class="container section">
      <div class="link-row">
        <a href="#/help">${esc(t('science.openMethod'))}</a>
        <a href="data/sites.json">${esc(t('science.data.sites'))}</a>
        <a href="data/precomputed/index.json">${esc(t('science.data.precomputed'))}</a>
        <a href="data/sources.json">${esc(t('science.data.sources'))}</a>
        <span class="mono small" style="color:var(--muted)">${esc(t('science.api.status'))} : <span id="api-status">…</span></span>
      </div>
    </section>`;

  probeBackend().then((status) => {
    const el = root.querySelector('#api-status');
    if (!el) return;
    el.textContent = status?.online ? t('science.api.online') : t('science.api.offline');
  });

  return null;
}

export { pageHead };
