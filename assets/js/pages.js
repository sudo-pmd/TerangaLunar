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
import { siteCard } from './views.js';
import { probeBackend } from './live.js';
import { mountMoon } from './moon3d.js';

/**
 * Small circular globe used as a figure on the catalogue and science pages.
 * Same scene, same texture, same terminator as the big map — only the framing
 * differs, and it is not interactive.
 */
function mountMini(host, opts) {
  if (!host) return { setView() {}, dispose() {} };
  let scene = null;
  let disposed = false;
  mountMoon(host, { ...opts, mini: true, live: true, hint: '', onSelect: undefined }).then((api) => {
    if (disposed) { api.dispose(); return; }
    scene = api;
    if (Number.isFinite(opts.lat)) api.setView(opts.lat, opts.lon || 0);
  }).catch(() => {});
  return {
    setView(lat, lon) { scene?.setView(lat, lon); },
    setProbe(point) { scene?.setProbe(point); },
    dispose() {
      disposed = true;
      scene?.dispose();
    },
  };
}

// Longitude 0 is the centre of the near side, but the shader samples the
// equirectangular map mirrored, so the camera that shows the near side sits at
// longitude 180 in selenographic coordinates.
const GLOBE_VIEWS = [
  ['south', -90, 0],
  ['near', 6, 180],
  ['far', 6, 0],
];

function globeFigure({ id, title, note, extra = '' }) {
  return `<section class="container globe-figure">
    <div class="globe-circle" id="${id}" role="img" aria-label="${esc(title)}"></div>
    <div class="globe-caption">
      <h2>${esc(title)}</h2>
      <p>${esc(note)}</p>
      ${extra}
    </div>
  </section>`;
}

function globeSwitcher(root, mini) {
  const buttons = [...root.querySelectorAll('[data-globe-view]')];
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const found = GLOBE_VIEWS.find(([key]) => key === button.dataset.globeView);
      if (!found) return;
      mini.setView(found[1], found[2]);
      buttons.forEach((other) => {
        other.classList.toggle('is-active', other === button);
        other.setAttribute('aria-pressed', String(other === button));
      });
    });
  });
}

function viewButtons() {
  return `<div class="segmented globe-views" role="group" aria-label="${esc(t('globe.view.label'))}">
    ${GLOBE_VIEWS.map(([key], i) => `<button type="button" class="seg${i === 0 ? ' is-active' : ''}"
      data-globe-view="${key}" aria-pressed="${i === 0}">${esc(t(`globe.view.${key}`))}</button>`).join('')}
  </div>`;
}

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
    <div class="container sites-layout">
    <div class="sites-main">
    <section class="section" aria-labelledby="catalogue-title">
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
    </section>
    </div>

    <aside class="sites-aside">
      <div class="science-globe-card">
        <div class="globe-circle" id="sites-globe" role="img" aria-label="${esc(t('globe.sites.title'))}"></div>
        <h2>${esc(t('globe.sites.title'))}</h2>
        <p>${esc(t('globe.sites.note'))}</p>
        <p class="globe-readout mono" id="sites-focus">—</p>
        ${viewButtons()}
      </div>
    </aside>
    </div>`;

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

  const mini = mountMini(root.querySelector('#sites-globe'), {
    sites,
    dateMs: Date.now(),
    lat: -90,
    lon: 0,
  });
  globeSwitcher(root, mini);

  // Hovering or focusing a card turns the globe to that site's real position:
  // the list and the sphere say the same thing.
  const byId = new Map(sites.map((site) => [site.id, site]));
  const focus = (target) => {
    const link = target.closest?.('.site-card-link');
    if (!link) return;
    const id = decodeURIComponent((link.getAttribute('href') || '').replace('#/site/', ''));
    const site = byId.get(id);
    if (!site) return;
    mini.setView(site.lat, site.lon);
    mini.setProbe({ lat: site.lat, lon: site.lon });
    const readout = root.querySelector('#sites-focus');
    if (readout) readout.textContent = `${siteName(site)} · ${fmtNum(site.lat, 2)}° / ${fmtNum(site.lon, 2)}°`;
  };
  grid.addEventListener('pointerover', (event) => focus(event.target));
  grid.addEventListener('focusin', (event) => focus(event.target));

  return () => mini.dispose();
}

/* The live map lives in its own module: it owns two WebGL scenes. */
export { renderMap } from './map.js';

/* ----------------------------------------------------------------- learn */

function polarSites(config) {
  const polar = config.sites.filter((s) => s.type === 'polar');
  return polar.length ? polar : config.sites;
}

export function renderLearn(root, ctx) {
  const { config, state, actions } = ctx;
  const candidates = polarSites(config);
  const local = {
    step: 'clps',
    siteId: (candidates[0] || config.sites[0]).id,
    dateMs: state.dateMs,
    stayDays: state.stayDays,
  };

  const steps = [
    ['clps', t('learn.s0')],
    [1, t('learn.s1')],
    [2, t('learn.s2')],
    [3, t('learn.s3')],
    [4, t('learn.s4')],
  ];

  root.innerHTML = `
    ${pageHead(t('learn.kicker'), t('learn.title'), t('learn.lede'))}
    <section class="container learn-layout">
      <div class="learn-main">
        <nav class="step-nav" aria-label="${esc(t('learn.title'))}">
          ${steps.map(([key, label], i) => `<button type="button" data-step="${key}">
            <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
            <span>${esc(label)}</span>
          </button>`).join('')}
        </nav>
        <div class="step-body" id="learn-body" aria-live="polite"></div>
      </div>

      <aside class="learn-globe">
        <div class="globe-circle" id="learn-globe" role="img"
          aria-label="${esc(t('globe.science.title'))}"></div>
        ${viewButtons()}
        <p class="globe-readout mono" id="learn-readout">—</p>
      </aside>
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
    if (open && site) {
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

  /* What CLPS is, before any number: the programme, then what it delivers. */
  const stepClps = () => {
    const landers = config.sites.filter((s) => s.type !== 'reference');
    return {
      site: null,
      html: `<h2>${esc(t('learn.c1t'))}</h2>
        <p class="step-lede">${esc(t('learn.c1b1'))}</p>

        <div class="science-grid" style="margin-block:var(--s-4)">
          <article class="stat tone-sun">
            <h3 class="stat-label">${esc(t('learn.c1k1'))}</h3>
            <p class="stat-value mono">17</p>
            <p class="stat-help">${esc(t('learn.c1h1'))}</p>
          </article>
          <article class="stat">
            <h3 class="stat-label">${esc(t('learn.c1k2'))}</h3>
            <p class="stat-value mono">${landers.length}</p>
            <p class="stat-help">${esc(t('learn.c1h2'))}</p>
          </article>
        </div>

        <p class="step-lede">${esc(t('learn.c1b2'))}</p>

        <ul class="mission-list">
          ${landers.map((site) => `<li>
            <button type="button" class="mission-chip" data-focus-site="${esc(site.id)}">
              <span class="m-name">${esc(siteName(site))}</span>
              <span class="m-meta mono">${fmtNum(site.lat, 1)}° / ${fmtNum(site.lon, 1)}°</span>
            </button>
          </li>`).join('')}
        </ul>

        <p class="data-note">${esc(t('learn.c1b3'))}</p>`,
    };
  };

  const builders = { clps: stepClps, 1: step1, 2: step2, 3: step3, 4: step4 };

  // The globe on the right follows the step: it points at the site under
  // discussion, and the mission chips turn it here and there.
  const mini = mountMini(root.querySelector('#learn-globe'), {
    sites: config.sites,
    dateMs: Date.now(),
    lat: -90,
    lon: 0,
  });
  globeSwitcher(root, mini);
  const readout = root.querySelector('#learn-readout');

  const pointAt = (site) => {
    if (!site) return;
    mini.setView(site.lat, site.lon);
    mini.setProbe({ lat: site.lat, lon: site.lon });
    if (readout) readout.textContent = `${siteName(site)} · ${fmtNum(site.lat, 2)}° / ${fmtNum(site.lon, 2)}°`;
  };

  const paint = () => {
    const view = builders[local.step]();
    body.innerHTML = view.html;
    bindCommon(view.site);
    root.querySelectorAll('[data-step]').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.step) === String(local.step) ? 'step' : 'false');
    });

    body.querySelectorAll('[data-focus-site]').forEach((chip) => {
      const site = config.byId.get(chip.dataset.focusSite);
      const activate = () => pointAt(site);
      chip.addEventListener('pointerenter', activate);
      chip.addEventListener('focus', activate);
      chip.addEventListener('click', activate);
    });

    if (view.site) pointAt(view.site);
  };

  root.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      local.step = button.dataset.step === 'clps' ? 'clps' : Number(button.dataset.step);
      paint();
    });
  });

  paint();
  return () => mini.dispose();
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
    <div class="container science-layout">
    <div class="science-main">
    <section class="section">
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

    <section class="section">
      <div class="link-row">
        <a href="#/help">${esc(t('science.openMethod'))}</a>
        <a href="data/sites.json">${esc(t('science.data.sites'))}</a>
        <a href="data/precomputed/index.json">${esc(t('science.data.precomputed'))}</a>
        <a href="data/sources.json">${esc(t('science.data.sources'))}</a>
        <span class="mono small" style="color:var(--muted)">${esc(t('science.api.status'))} : <span id="api-status">…</span></span>
      </div>
    </section>
    </div>

    <aside class="science-aside">
      <div class="science-globe-card">
        <div class="globe-circle" id="science-globe" role="img" aria-label="${esc(t('globe.science.title'))}"></div>
        <h2>${esc(t('globe.science.title'))}</h2>
        <p>${esc(t('globe.science.note'))}</p>
        <p class="globe-readout mono" id="science-subsolar">—</p>
        ${viewButtons()}
      </div>
    </aside>
    </div>`;

  probeBackend().then((status) => {
    const el = root.querySelector('#api-status');
    if (!el) return;
    el.textContent = status?.online ? t('science.api.online') : t('science.api.offline');
  });

  // The globe here shows the terminator at the moment the page was drawn, with
  // the real subsolar point printed beside it.
  const when = Date.now();
  const mini = mountMini(root.querySelector('#science-globe'), {
    sites,
    dateMs: when,
    lat: -20,
    lon: 0,
  });
  const g = siteGeometry(sites[0], when);
  const subsolar = root.querySelector('#science-subsolar');
  if (subsolar) {
    subsolar.textContent = `${t('globe.subsolar')} · ${fmtNum(g.subSolar.lat, 2)}° / ${fmtNum(g.subSolar.lon, 2)}°`;
  }
  globeSwitcher(root, mini);

  return () => mini.dispose();
}

export { pageHead };
