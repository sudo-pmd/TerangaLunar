/**
 * Route views. Each renderer returns an optional cleanup function; the router
 * calls it before drawing the next page.
 */

import {
  t, tValue, siteName, fmtNum, fmtDate, fmtDateTime, fmtDuration, fmtPct, getLang,
} from './i18n.js';
import {
  buildSeries, seriesFor, aggregate, score, verdicts, bestDates, rankSites,
  HOUR_MS, DAY_MS, LUNAR_DAY_DAYS,
} from './metrics.js';
import { siteGeometry } from './ephemeris.js';
import { horizonSvg, timelineSvg, heatmapSvg, monthlyBarsSvg, escapeXml as esc } from './charts.js';
import { mountMoon } from './moon3d.js';
import { toUtcInput, fromUtcInput } from './state.js';
import { horizonProfile } from './horizon.js';
import { ensurePrecomputed } from './precomputed.js';

const YEAR_SAMPLES = 366 * 24 + 1;

function yearStartOf(ms) {
  return Date.UTC(new Date(ms).getUTCFullYear(), 0, 1);
}

/** Site shown on the best-dates page. */
function pickDatesSite(config, state) {
  return config.byId.get(state.siteId)
    || config.sites.find((site) => site.id === 'malapert_a')
    || config.sites[0];
}

/** Sites compared side by side, 2 or 3, reference sites excluded. */
function pickCompareIds(config, state) {
  const candidates = config.sites.filter((site) => site.type !== 'reference');
  let selected = (state.compare.length ? state.compare : ['malapert_a', 'mons_mouton', 'mare_crisium'])
    .filter((id) => config.byId.has(id))
    .slice(0, 3);
  if (selected.length < 2) selected = candidates.slice(0, 2).map((site) => site.id);
  return selected;
}

function badge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(tValue('status', status))}</span>`;
}

function statCard({ label, value, unit = '', help = '', tone = '', gloss = '' }) {
  return `<article class="stat ${tone}">
    <div class="stat-head">
      <h3 class="stat-label">${esc(label)}</h3>
      ${gloss}
    </div>
    <p class="stat-value mono">${esc(value)}${unit ? `<span class="stat-unit">${esc(unit)}</span>` : ''}</p>
    ${help ? `<p class="stat-help">${esc(help)}</p>` : ''}
  </article>`;
}

/** Inline glossary definition, native <details> so it works with keyboard and print. */
function glossTerm(termId, config) {
  const term = config.glossaire.terms.find((entry) => entry.id === termId);
  if (!term) return '';
  const lang = getLang();
  const label = term.term[lang] || term.term.fr;
  const def = term.def[lang] || term.def.fr;
  return `<details class="gloss">
    <summary aria-label="${esc(`${t('gloss.label')} : ${label}`)}">?</summary>
    <div class="gloss-body"><strong>${esc(label)}</strong> ${esc(def)}</div>
  </details>`;
}

/* ------------------------------------------------------------------ home */

export function renderHome(root, ctx) {
  const { config, actions } = ctx;
  const sites = config.sites;

  // The landing page is the Moon. Everything else is one gesture away, in the
  // dock: no paragraphs, no statistics, no cards.
  root.innerHTML = `
    <section class="stage" aria-labelledby="stage-title">
      <div class="stage-globe" id="hero-scene" role="img"
        aria-label="${esc(t('home.scene.alt'))}"></div>
      <div class="stage-overlay">
        <img class="stage-logo" src="assets/img/teranga-lunar.svg"
          alt="TerangaLunar — Space &amp; Lunar Missions" width="300" height="72" decoding="async">
        <h1 id="stage-title" class="stage-title">${esc(t('home.hero.title'))}</h1>
      </div>
      <button type="button" class="stage-skip" id="skip-intro">${esc(t('home.scene.skip'))}</button>
    </section>`;

  let scene = null;
  let disposed = false;
  const sceneHost = root.querySelector('#hero-scene');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  mountMoon(sceneHost, {
    sites,
    // The hero shows the real instant, framed to the whole globe.
    dateMs: Date.now(),
    fit: true,
    reducedMotion,
    hint: '',
    onSelect: (id) => actions.openSite(id),
  }).then((api) => {
    if (disposed) {
      api.dispose();
      return;
    }
    scene = api;
    root.querySelector('#skip-intro').addEventListener('click', () => scene.skipIntro());
  });

  return () => {
    disposed = true;
    if (scene) scene.dispose();
  };
}

export function siteCard(site) {
  return `<li class="site-card" data-company="${esc(site.company)}" data-status="${esc(site.status)}">
    <a class="site-card-link" href="#/site/${encodeURIComponent(site.id)}">
      <span class="site-card-top">
        <span class="site-mission">${esc(site.mission)}</span>
        ${badge(site.status)}
      </span>
      <span class="site-name">${esc(siteName(site))}</span>
      <span class="site-meta mono">${fmtNum(site.lat, 2)}° / ${fmtNum(site.lon, 2)}°</span>
      <span class="site-type">${esc(tValue('type', site.type))}</span>
    </a>
  </li>`;
}

/* ------------------------------------------------------------------ site */

export function renderSite(root, ctx) {
  const { config, state, actions } = ctx;
  const site = config.byId.get(state.siteId);
  if (!site) {
    root.innerHTML = `<section class="container section empty-state">
      <h1>${esc(t('site.notFound'))}</h1>
      <p>${esc(t('site.notFoundHelp'))}</p>
      <a class="btn primary" href="#/">${esc(t('site.back'))}</a>
    </section>`;
    return null;
  }

  const yearStart = yearStartOf(state.dateMs);
  const series = buildSeries(site, yearStart, YEAR_SAMPLES, HOUR_MS);
  const idxRaw = Math.round((state.dateMs - yearStart) / HOUR_MS);
  const idx = Math.max(0, Math.min(series.count - 1, idxRaw));
  const staySamples = Math.max(24, Math.round((state.stayDays * DAY_MS) / HOUR_MS));
  const i0 = idx;
  const i1 = Math.min(series.count, i0 + staySamples);
  const clamped = i1 - i0 < staySamples;
  const metrics = aggregate(series, i0, i1);
  const seuils = state.seuils || config.seuils;
  const weights = state.weights;
  const geom = siteGeometry(site, series.startMs + idx * series.stepMs);
  const profile = horizonProfile(site);

  let zoom = 'stay';

  root.innerHTML = `
    <article class="site-page">
      <header class="container page-head">
        <a class="back-link" href="#/">← ${esc(t('site.back'))}</a>
        <p class="kicker">${esc(site.mission)} · ${esc(site.company)}</p>
        <h1>${esc(siteName(site))}</h1>
        <p class="page-meta">
          <span class="mono">${fmtNum(site.lat, 2)}° / ${fmtNum(site.lon, 2)}°</span>
          <span>${esc(tValue('type', site.type))}</span>
          ${badge(site.status)}
          <span class="muted">${esc(t(`site.precision.${site.precision}`))}</span>
        </p>
      </header>

      <section class="container controls" aria-label="${esc(t('site.shift'))}">
        <div class="control-group">
          <span class="control-label" id="shift-label">${esc(t('site.shift'))}</span>
          <div class="shift-buttons" role="group" aria-labelledby="shift-label">
            ${[-7, -1, 1, 7].map((d) => `<button type="button" class="btn shift" data-shift="${d}" aria-label="${esc(t('site.shift'))} ${d} ${esc(t('ui.days'))}">${d > 0 ? '+' : '−'}${Math.abs(d)} ${esc(t('ui.days'))}</button>`).join('')}
          </div>
        </div>

        <label class="field">
          <span>${esc(t('site.dateLabel'))}</span>
          <input type="datetime-local" id="date-input" value="${toUtcInput(series.startMs + idx * HOUR_MS)}">
        </label>

        <label class="field">
          <span>${esc(t('site.stay'))}</span>
          <select id="stay-select">
            ${[[7, '7'], [14, '14'], [LUNAR_DAY_DAYS, '29'], [60, '60']]
              .map(([v, key]) => `<option value="${v}"${Math.abs(state.stayDays - v) < 0.01 ? ' selected' : ''}>${esc(t(`site.stay.${key}`))}</option>`)
              .join('')}
          </select>
        </label>

        <div class="control-group">
          <span class="control-label">${esc(t('site.profile'))}</span>
          <div class="segmented" role="radiogroup" aria-label="${esc(t('site.profile'))}">
            <button type="button" role="radio" class="seg" data-profile="eng" aria-checked="${state.profile === 'eng'}">${esc(t('site.profile.eng'))}</button>
            <button type="button" role="radio" class="seg" data-profile="sci" aria-checked="${state.profile === 'sci'}">${esc(t('site.profile.sci'))}</button>
          </div>
        </div>

        <div class="control-group actions-inline">
          <button type="button" class="btn quiet" id="copy-link">${esc(t('site.copy'))}</button>
          <button type="button" class="btn quiet" id="print-page">${esc(t('site.print'))}</button>
        </div>
        <p class="copy-status" aria-live="polite" id="copy-status"></p>
      </section>

      ${clamped ? `<p class="container notice">${esc(t('site.clamped'))}</p>` : ''}

      <section class="container metrics" aria-label="${esc(t('site.title'))}">
        ${statCard({
          label: t('metric.sun'),
          value: fmtNum(metrics.sunPct, 0),
          unit: '%',
          help: t('metric.sun.help'),
          tone: 'tone-sun',
        })}
        ${statCard({
          label: t('metric.night'),
          value: fmtDuration(metrics.maxNightHours),
          help: metrics.nightTruncated ? `${t('metric.night.help')} — ${t('metric.nightTruncated')}` : t('metric.night.help'),
          tone: 'tone-night',
          gloss: glossTerm('nuit', config),
        })}
        ${statCard({
          label: t('metric.earth'),
          value: fmtNum(metrics.earthPct, 0),
          unit: '%',
          help: `${metrics.earthWindows.length} ${t('metric.windows')} · ${t('metric.earth.help')}`,
          tone: 'tone-earth',
          gloss: glossTerm('fenetre', config),
        })}
      </section>

      <section class="container grid-2">
        <div class="panel panel-dark">
          <header class="panel-head">
            <div class="panel-head-title">
              <h2>${esc(t('horizon.title'))}</h2>
              ${glossTerm('masque', config)}
            </div>
            <p>${esc(t('horizon.lede'))}</p>
          </header>
          <div class="chart-host" id="horizon-host">${horizonSvg({ series, index: idx, profile })}</div>
          <ul class="legend">
            <li><span class="swatch swatch-terrain"></span>${esc(t('horizon.mask'))}</li>
            <li><span class="swatch swatch-sun"></span>${esc(t('horizon.sun'))}</li>
            <li><span class="swatch swatch-earth"></span>${esc(t('horizon.earth'))}</li>
            ${profile.min < 0 ? `<li><span class="swatch swatch-below"></span>${esc(t('horizon.below'))}</li>` : ''}
          </ul>
          <p class="readout mono" id="horizon-readout">${esc(horizonReadout(geom))}</p>
        </div>

        <div class="panel" id="profile-panel">
          ${profilePanel({ site, metrics, geom, series, i0, i1, weights, seuils, profile: state.profile })}
        </div>
      </section>

      <section class="container panel panel-wide">
        <header class="panel-head">
          <h2>${esc(t('timeline.title'))}</h2>
          <p>${esc(t('timeline.lede'))}</p>
        </header>
        <div class="timeline-tools">
          <div class="segmented" role="group" aria-label="${esc(t('timeline.title'))}">
            <button type="button" class="seg" data-zoom="day">${esc(t('timeline.day'))}</button>
            <button type="button" class="seg is-active" data-zoom="stay">${esc(t('timeline.stay'))}</button>
            <button type="button" class="seg" data-zoom="year">${esc(t('timeline.year'))}</button>
          </div>
          <p class="hint">${esc(t('timeline.hover'))}</p>
        </div>
        <div class="chart-host chart-host-wide" id="timeline-host" tabindex="0"></div>
        <div class="timeline-readout" id="timeline-readout" aria-live="polite"></div>
        <ul class="legend">
          <li><span class="swatch swatch-sun"></span>${esc(t('timeline.sun'))}</li>
          <li><span class="swatch swatch-earth"></span>${esc(t('timeline.earth'))}</li>
          <li><span class="swatch swatch-hatch"></span>${esc(t('timeline.shadow'))}</li>
        </ul>
      </section>

      <section class="container panel" id="thresholds-panel">
        ${thresholdTable(metrics, seuils)}
      </section>

      <section class="container panel" id="notes-panel">
        <header class="panel-head">
          <h2>${esc(t('notes.title'))}</h2>
          <p>${esc(t('notes.help'))}</p>
        </header>
        <label class="sr-only" for="notes">${esc(t('notes.title'))}</label>
        <textarea id="notes" rows="4" placeholder="${esc(t('notes.placeholder'))}"></textarea>
        <p class="notes-status" aria-live="polite"></p>
      </section>

      <section class="container">
        ${assumptionsBox(config, site, series)}
      </section>
    </article>`;

  /* ---------------- timeline ---------------- */
  const timelineHost = root.querySelector('#timeline-host');
  const readout = root.querySelector('#timeline-readout');
  const horizonHost = root.querySelector('#horizon-host');
  const horizonReadoutEl = root.querySelector('#horizon-readout');
  let cursor = idx;

  const windows = () => {
    if (zoom === 'day') return [Math.max(0, cursor - 12), Math.min(series.count, cursor + 13)];
    if (zoom === 'year') return [0, series.count];
    return [i0, Math.min(series.count, i1)];
  };

  const drawTimeline = () => {
    const [a, b] = windows();
    timelineHost.innerHTML = timelineSvg({
      series, i0: a, i1: b, stayI0: i0, stayI1: i1, index: cursor,
    });
    updateReadout();
  };

  const updateReadout = (i) => {
    if (i !== undefined) cursor = Math.max(0, Math.min(series.count - 1, i));
    const ms = series.startMs + cursor * series.stepMs;
    const sun = { alt: series.sunAlt[cursor], az: series.sunAz[cursor] };
    const earth = { alt: series.earthAlt[cursor], az: series.earthAz[cursor] };
    readout.innerHTML = `
      <span class="mono">${esc(fmtDateTime(ms))}</span>
      <span class="chip chip-sun">${esc(t('horizon.sun'))} ${fmtNum(sun.alt, 1)}° / ${fmtNum(sun.az, 0)}°</span>
      <span class="chip chip-earth">${esc(t('horizon.earth'))} ${fmtNum(earth.alt, 1)}° / ${fmtNum(earth.az, 0)}°</span>
      <span class="chip ${series.sunVis[cursor] ? 'chip-ok' : 'chip-ko'}">${esc(series.sunVis[cursor] ? t('timeline.sun') : t('timeline.shadow'))}</span>`;
    horizonHost.innerHTML = horizonSvg({ series, index: cursor, profile });
    horizonReadoutEl.textContent = horizonReadoutFor(sun, earth);
  };

  timelineHost.addEventListener('pointermove', (event) => {
    const svg = timelineHost.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const padL = Number(svg.dataset.padl);
    const plotW = Number(svg.dataset.plotw);
    const a = Number(svg.dataset.i0);
    const b = Number(svg.dataset.i1);
    const x = ((event.clientX - rect.left) / rect.width) * svg.viewBox.baseVal.width;
    const frac = Math.min(1, Math.max(0, (x - padL) / plotW));
    updateReadout(Math.round(a + frac * (b - a)));
  });

  timelineHost.addEventListener('click', () => {
    actions.setDate(series.startMs + cursor * series.stepMs);
  });

  timelineHost.addEventListener('keydown', (event) => {
    const step = event.key === 'PageDown' || event.key === 'PageUp' ? 24 : 1;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      updateReadout(cursor + step);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      updateReadout(cursor - step);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      actions.setDate(series.startMs + cursor * series.stepMs);
    }
  });

  root.querySelectorAll('[data-zoom]').forEach((button) => {
    button.addEventListener('click', () => {
      zoom = button.dataset.zoom;
      root.querySelectorAll('[data-zoom]').forEach((b) => b.classList.toggle('is-active', b === button));
      drawTimeline();
    });
  });
  drawTimeline();

  /* ---------------- controls ---------------- */
  root.querySelectorAll('[data-shift]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.setDate(state.dateMs + Number(button.dataset.shift) * DAY_MS);
    });
  });

  root.querySelector('#date-input').addEventListener('change', (event) => {
    const ms = fromUtcInput(event.target.value);
    if (ms) actions.setDate(ms);
  });

  root.querySelector('#stay-select').addEventListener('change', (event) => {
    actions.setStay(Number(event.target.value));
  });

  root.querySelectorAll('[data-profile]').forEach((button) => {
    button.addEventListener('click', () => actions.setProfile(button.dataset.profile));
  });

  root.querySelector('#copy-link').addEventListener('click', async () => {
    const status = root.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText(window.location.href);
      status.textContent = t('site.copied');
    } catch {
      status.textContent = window.location.href;
    }
  });

  root.querySelector('#print-page').addEventListener('click', () => window.print());

  /* ---------------- mission notes (never in the URL) ---------------- */
  const notesEl = root.querySelector('#notes');
  const notesStatus = root.querySelector('.notes-status');
  const notesKey = `clps.notes.${site.id}`;
  try {
    notesEl.value = localStorage.getItem(notesKey) || '';
  } catch {
    notesEl.value = '';
  }
  let notesTimer = 0;
  notesEl.addEventListener('input', () => {
    clearTimeout(notesTimer);
    notesTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(notesKey, notesEl.value);
        notesStatus.textContent = t('notes.saved');
      } catch {
        notesStatus.textContent = '';
      }
    }, 400);
  });

  /* ---------------- live thresholds ---------------- */
  const thresholdPanel = root.querySelector('#thresholds-panel');
  const applyThresholds = () => {
    const next = { ...seuils };
    thresholdPanel.querySelectorAll('input[data-thr]').forEach((input) => {
      const value = Number(input.value);
      if (Number.isFinite(value)) next[input.dataset.thr] = value;
    });
    const list = verdicts(metrics, next);
    list.forEach((v) => {
      const cell = thresholdPanel.querySelector(`[data-verdict="${v.key}"]`);
      if (cell) cell.innerHTML = verdictBadge(v.ok);
    });
    const summary = thresholdPanel.querySelector('[data-thr-summary]');
    if (summary) {
      const failures = list.filter((v) => !v.ok).length;
      summary.textContent = failures ? t('thr.someKo', { n: failures }) : t('thr.allOk');
      summary.dataset.state = failures ? 'ko' : 'ok';
    }
    actions.setSeuils(next);
  };
  thresholdPanel.querySelectorAll('input[data-thr]').forEach((input) => {
    input.addEventListener('input', applyThresholds);
  });

  return null;
}

function horizonReadout(geom) {
  return `${t('horizon.sun')} · ${fmtNum(geom.sun.alt, 1)}° / ${fmtNum(geom.sun.az, 0)}°   ${t('horizon.earth')} · ${fmtNum(geom.earth.alt, 1)}° / ${fmtNum(geom.earth.az, 0)}°`;
}

function horizonReadoutFor(sun, earth) {
  return `${t('horizon.sun')} · ${fmtNum(sun.alt, 1)}° / ${fmtNum(sun.az, 0)}°   ${t('horizon.earth')} · ${fmtNum(earth.alt, 1)}° / ${fmtNum(earth.az, 0)}°`;
}

function verdictBadge(ok) {
  return `<span class="verdict ${ok ? 'verdict-ok' : 'verdict-ko'}">
    <span aria-hidden="true">${ok ? '✓' : '✕'}</span> ${esc(ok ? t('thr.ok') : t('thr.ko'))}
  </span>`;
}

function thresholdTable(metrics, seuils) {
  const list = verdicts(metrics, seuils);
  const rows = [
    { key: 'sun', label: t('thr.sun'), value: fmtPct(metrics.sunPct, 0), input: 'sunMinPct', step: 1, unit: '%' },
    { key: 'night', label: t('thr.night'), value: fmtDuration(metrics.maxNightHours), input: 'maxNightDays', step: 0.5, unit: t('ui.days') },
    { key: 'earth', label: t('thr.earth'), value: fmtPct(metrics.earthPct, 0), input: 'earthMinPct', step: 1, unit: '%' },
  ];
  const failures = list.filter((v) => !v.ok).length;

  return `<header class="panel-head">
      <h2>${esc(t('thr.title'))}</h2>
      <p>${esc(t('thr.lede'))}</p>
    </header>
    <p class="thr-summary" data-thr-summary data-state="${failures ? 'ko' : 'ok'}">${esc(failures ? t('thr.someKo', { n: failures }) : t('thr.allOk'))}</p>
    <div class="table-scroll">
      <table class="data-table">
        <caption>${esc(t('thr.title'))}</caption>
        <thead><tr>
          <th scope="col">${esc(t('thr.criterion'))}</th>
          <th scope="col">${esc(t('thr.measured'))}</th>
          <th scope="col">${esc(t('thr.threshold'))}</th>
          <th scope="col">${esc(t('thr.verdict'))}</th>
        </tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <th scope="row">${esc(row.label)}</th>
            <td class="mono">${esc(row.value)}</td>
            <td>
              <label class="sr-only" for="thr-${row.key}">${esc(row.label)} (${esc(row.unit)})</label>
              <span class="thr-input">
                <input type="number" id="thr-${row.key}" data-thr="${row.input}" value="${seuils[row.input]}" step="${row.step}" min="0">
                <span class="mono">${esc(row.unit)}</span>
              </span>
            </td>
            <td data-verdict="${row.key}">${verdictBadge(list.find((v) => v.key === row.key).ok)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function profilePanel({ geom, metrics, seuils, profile }) {
  const list = verdicts(metrics, seuils);
  if (profile === 'sci') {
    const grazing = metrics.grazingHours ?? 0;
    return `<header class="panel-head">
        <h2>${esc(t('profile.sci.title'))}</h2>
      </header>
      <dl class="kv">
        <div><dt>${esc(t('profile.sci.sun'))}</dt><dd class="mono">${fmtNum(geom.sun.alt, 2)}° <span class="muted">/ ${fmtNum(geom.sun.az, 0)}°</span></dd></div>
        <div><dt>${esc(t('profile.sci.grazing'))}</dt><dd class="mono">${fmtNum(grazing, 0)} ${esc(t('ui.hours'))} <span class="muted">${esc(t('profile.sci.hours'))}</span></dd></div>
        <div><dt>${esc(t('profile.sci.shadow'))}</dt><dd class="mono">${fmtNum((geom.sun.az + 180) % 360, 0)}°</dd></div>
      </dl>
      <p class="panel-note">${esc(t('metric.sun.help'))}</p>`;
  }
  const failures = list.filter((v) => !v.ok).length;
  return `<header class="panel-head">
      <h2>${esc(t('profile.eng.title'))}</h2>
    </header>
    <dl class="kv">
      <div><dt>${esc(t('profile.eng.power'))}</dt><dd class="mono">${fmtPct(metrics.sunPct, 0)}</dd></div>
      <div><dt>${esc(t('profile.eng.night'))}</dt><dd class="mono">${fmtDuration(metrics.maxNightHours)}</dd></div>
      <div><dt>${esc(t('profile.eng.telecom'))}</dt><dd class="mono">${metrics.earthWindows.length} <span class="muted">${esc(t('metric.windows'))} · ${fmtPct(metrics.earthPct, 0)}</span></dd></div>
    </dl>
    <p class="panel-note" data-state="${failures ? 'ko' : 'ok'}">${esc(failures ? t('thr.someKo', { n: failures }) : t('thr.allOk'))}</p>`;
}

function assumptionsBox(config, site, series) {
  return `<aside class="assumptions" aria-labelledby="assume-title">
    <h2 id="assume-title">${esc(t('assume.title'))}</h2>
    <dl class="kv kv-inline">
      <div><dt>${esc(t('assume.data'))}</dt><dd class="mono">${esc(config.meta.version)}</dd></div>
      <div><dt>${esc(t('assume.computed'))}</dt><dd class="mono">${esc(config.meta.computed || config.meta.version)}</dd></div>
      <div><dt>${esc(t('assume.frame'))}</dt><dd class="mono">${esc(config.meta.frame)}</dd></div>
      <div><dt>${esc(t('assume.step'))}</dt><dd class="mono">1 ${esc(t('ui.hours'))}</dd></div>
      <div><dt>${esc(t('assume.terrain'))}</dt><dd>${esc(t('assume.terrainValue'))}</dd></div>
      <div><dt>${esc(t('assume.ephem'))}</dt><dd>${esc(series && series.ephemeris === 'spice' ? t('assume.ephemSpice') : t('assume.ephemValue'))}</dd></div>
    </dl>
    <p class="panel-note">${esc(t('assume.model'))}${site.type === 'reference' ? '' : ''}</p>
  </aside>`;
}

/* ----------------------------------------------------------------- dates */

export function renderDates(root, ctx) {
  const { config, state, actions } = ctx;
  const sites = config.sites;
  const site = pickDatesSite(config, state);
  const yearStart = yearStartOf(state.dateMs);
  const year = new Date(yearStart).getUTCFullYear();
  const data = bestDates(site, state.stayDays, state.weights, yearStart);

  root.innerHTML = `
    <section class="container page-head">
      <p class="kicker">${esc(t('brand.tag'))}</p>
      <h1>${esc(t('dates.title'))}</h1>
      <p class="page-lede">${esc(t('dates.lede'))}</p>
      <div class="controls">
        <label class="field">
          <span>${esc(t('compare.site'))}</span>
          <select id="dates-site">
            ${sites.map((s) => `<option value="${esc(s.id)}"${s.id === site.id ? ' selected' : ''}>${esc(siteName(s))} — ${esc(s.mission)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>${esc(t('site.stay'))}</span>
          <select id="dates-stay">
            ${[[7, '7'], [14, '14'], [LUNAR_DAY_DAYS, '29'], [60, '60']]
              .map(([v, key]) => `<option value="${v}"${Math.abs(state.stayDays - v) < 0.01 ? ' selected' : ''}>${esc(t(`site.stay.${key}`))}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field field-range">
          <span>${esc(t('dates.weights'))} · ${esc(t('dates.energy'))} ${state.weights.energy} / ${state.weights.comm}</span>
          <input type="range" id="dates-weight" min="0" max="100" step="5" value="${state.weights.energy}" aria-label="${esc(t('dates.weights'))}">
        </label>
      </div>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('dates.heatmap'))} — ${year}</h2>
        <p>${esc(t('metric.score.help'))}</p>
      </header>
      <div class="chart-host chart-host-heatmap" id="heatmap-host">${heatmapSvg({ results: data.results, year })}</div>
      <p class="legend-text">
        <span class="swatch swatch-scalelow"></span>${esc(t('dates.legend'))}
        <span class="swatch swatch-scalehigh"></span>${esc(t('dates.legendHigh'))}
        <span class="swatch swatch-ring"></span>${esc(t('dates.best'))} 5
      </p>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('dates.top'))}</h2>
      </header>
      <div class="table-scroll">
        <table class="data-table">
          <caption>${esc(t('dates.top'))} — ${esc(siteName(site))}</caption>
          <thead><tr>
            <th scope="col">${esc(t('dates.rank'))}</th>
            <th scope="col">${esc(t('dates.start'))}</th>
            <th scope="col">${esc(t('dates.score'))}</th>
            <th scope="col">${esc(t('metric.sun'))}</th>
            <th scope="col">${esc(t('metric.night'))}</th>
            <th scope="col"><span class="sr-only">${esc(t('dates.use'))}</span></th>
          </tr></thead>
          <tbody>
            ${data.top.map((row, i) => `<tr>
              <td class="mono">${i + 1}</td>
              <td class="mono">${esc(fmtDate(row.startMs))}</td>
              <td class="mono">${fmtNum(row.score, 0)}</td>
              <td class="mono">${fmtNum(row.sunPct, 0)} %</td>
              <td class="mono">${fmtDuration(row.maxNightHours)}</td>
              <td><button type="button" class="btn tiny" data-use="${row.startMs}">${esc(t('dates.use'))}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('metric.sun'))} — ${year}</h2>
      </header>
      <div class="chart-host">${monthlyBarsSvg({ series: data.series, year })}</div>
    </section>`;

  root.querySelector('#dates-site').addEventListener('change', (event) => actions.selectSite(event.target.value));
  root.querySelector('#dates-stay').addEventListener('change', (event) => actions.setStay(Number(event.target.value)));
  root.querySelector('#dates-weight').addEventListener('change', (event) => actions.setWeights(Number(event.target.value)));

  root.querySelectorAll('[data-use]').forEach((button) => {
    button.addEventListener('click', () => actions.openSite(site.id, Number(button.dataset.use)));
  });
  root.querySelectorAll('.cell-group').forEach((cell) => {
    const open = () => actions.openSite(site.id, Number(cell.dataset.ms));
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  return null;
}

/* --------------------------------------------------------------- compare */

export function renderCompare(root, ctx) {
  const { config, state, actions } = ctx;
  const sites = config.sites;
  const candidates = sites.filter((s) => s.type !== 'reference');
  const selected = pickCompareIds(config, state);
  const referenceId = config.byId.has(state.referenceId) ? state.referenceId : selected[0];

  const plans = selected.map((id) => {
    const site = config.byId.get(id);
    const series = seriesFor(site, state.dateMs, state.stayDays);
    const metrics = aggregate(series, 0, series.count);
    return { site, metrics, score: score(metrics, state.weights) };
  });
  const reference = plans.find((p) => p.site.id === referenceId) || plans[0];
  const seuils = state.seuils || config.seuils;

  const delta = (value, base, digits = 0, unit = '') => {
    const diff = value - base;
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    return `${sign}${fmtNum(Math.abs(diff), digits)}${unit}`;
  };

  const ranking = rankSites(candidates, state.dateMs, state.stayDays, state.weights, (s, ms, days) =>
    seriesFor(s, ms, days));

  root.innerHTML = `
    <section class="container page-head">
      <p class="kicker">${esc(t('brand.tag'))}</p>
      <h1>${esc(t('compare.title'))}</h1>
      <p class="page-lede">${esc(t('compare.lede'))}</p>
      <div class="controls">
        <label class="field">
          <span>${esc(t('site.dateLabel'))}</span>
          <input type="datetime-local" id="cmp-date" value="${toUtcInput(state.dateMs)}">
        </label>
        <label class="field">
          <span>${esc(t('site.stay'))}</span>
          <select id="cmp-stay">
            ${[[7, '7'], [14, '14'], [LUNAR_DAY_DAYS, '29'], [60, '60']]
              .map(([v, key]) => `<option value="${v}"${Math.abs(state.stayDays - v) < 0.01 ? ' selected' : ''}>${esc(t(`site.stay.${key}`))}</option>`)
              .join('')}
          </select>
        </label>
        <div class="control-group">
          <span class="control-label">${esc(t('compare.reference'))}</span>
          <div class="segmented" role="radiogroup" aria-label="${esc(t('compare.reference'))}">
            ${plans.map((p) => `<button type="button" role="radio" class="seg" data-ref="${esc(p.site.id)}" aria-checked="${p.site.id === reference.site.id}">${esc(siteName(p.site))}</button>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('compare.pick'))}</h2>
        <p>${esc(t('compare.max'))}</p>
      </header>
      <fieldset class="checkbox-grid">
        <legend class="sr-only">${esc(t('compare.pick'))}</legend>
        ${candidates.map((s) => `<label class="check">
          <input type="checkbox" value="${esc(s.id)}"${selected.includes(s.id) ? ' checked' : ''}>
          <span>${esc(siteName(s))}<small>${esc(s.mission)}</small></span>
        </label>`).join('')}
      </fieldset>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('compare.table'))}</h2>
        <p>${esc(t('site.dateLabel'))} : <span class="mono">${esc(fmtDateTime(state.dateMs))}</span> · ${esc(t('site.stay'))} ${fmtNum(state.stayDays, 1)} ${esc(t('ui.days'))}</p>
      </header>
      <div class="table-scroll">
        <table class="data-table compare-table">
          <caption>${esc(t('compare.table'))}</caption>
          <thead><tr>
            <th scope="col">${esc(t('thr.criterion'))}</th>
            ${plans.map((p) => `<th scope="col">${esc(siteName(p.site))}
              <span class="th-sub">${esc(p.site.mission)}${p.site.id === reference.site.id ? ` · ${esc(t('compare.reference'))}` : ''}</span></th>`).join('')}
          </tr></thead>
          <tbody>
            <tr>
              <th scope="row">${esc(t('compare.row.sun'))}</th>
              ${plans.map((p) => `<td class="mono">${fmtPct(p.metrics.sunPct, 0)}
                <span class="delta">${esc(delta(p.metrics.sunPct, reference.metrics.sunPct, 0, ' %'))}</span></td>`).join('')}
            </tr>
            <tr>
              <th scope="row">${esc(t('compare.row.night'))}</th>
              ${plans.map((p) => `<td class="mono">${fmtDuration(p.metrics.maxNightHours)}
                <span class="delta">${esc(delta(p.metrics.maxNightHours, reference.metrics.maxNightHours, 0, ' ' + t('ui.hours')))}</span></td>`).join('')}
            </tr>
            <tr>
              <th scope="row">${esc(t('compare.row.nightStart'))}</th>
              ${plans.map((p) => `<td class="mono">${p.metrics.maxNightHours > 0 ? esc(fmtDateTime(p.metrics.nightStartMs)) : esc(t('ui.none'))}</td>`).join('')}
            </tr>
            <tr>
              <th scope="row">${esc(t('compare.row.windows'))}</th>
              ${plans.map((p) => `<td class="mono">${p.metrics.earthWindows.length} · ${fmtPct(p.metrics.earthPct, 0)}
                <span class="delta">${esc(delta(p.metrics.earthWindows.length, reference.metrics.earthWindows.length))}</span></td>`).join('')}
            </tr>
            <tr>
              <th scope="row">${esc(t('compare.row.score'))}</th>
              ${plans.map((p) => `<td class="mono strong">${fmtNum(p.score, 0)}
                <span class="delta">${esc(delta(p.score, reference.score))}</span></td>`).join('')}
            </tr>
            <tr>
              <th scope="row">${esc(t('compare.row.verdict'))}</th>
              ${plans.map((p) => {
                const failures = verdicts(p.metrics, seuils).filter((v) => !v.ok).length;
                return `<td>${verdictBadge(failures === 0)}</td>`;
              }).join('')}
            </tr>
          </tbody>
        </table>
      </div>
      <div class="panel-actions">
        <button type="button" class="btn quiet" id="export-csv">${esc(t('compare.export'))}</button>
      </div>
      <p class="hint" id="compare-status" aria-live="polite"></p>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('compare.ranking'))}</h2>
        <p>${esc(fmtDate(state.dateMs))}</p>
      </header>
      <div class="table-scroll">
        <table class="data-table">
          <caption>${esc(t('compare.ranking'))}</caption>
          <thead><tr>
            <th scope="col">${esc(t('compare.rank'))}</th>
            <th scope="col">${esc(t('compare.site'))}</th>
            <th scope="col">${esc(t('compare.mission'))}</th>
            <th scope="col">${esc(t('metric.sun'))}</th>
            <th scope="col">${esc(t('metric.night'))}</th>
            <th scope="col">${esc(t('metric.earth'))}</th>
            <th scope="col">${esc(t('metric.score'))}</th>
            <th scope="col"><span class="sr-only">${esc(t('site.open'))}</span></th>
          </tr></thead>
          <tbody>
            ${ranking.map((row, i) => `<tr>
              <td class="mono">${i + 1}</td>
              <th scope="row">${esc(siteName(row.site))}</th>
              <td>${esc(row.site.mission)}</td>
              <td class="mono">${fmtPct(row.metrics.sunPct, 0)}</td>
              <td class="mono">${fmtDuration(row.metrics.maxNightHours)}</td>
              <td class="mono">${fmtPct(row.metrics.earthPct, 0)}</td>
              <td class="mono strong">${fmtNum(row.score, 0)}</td>
              <td><button type="button" class="btn tiny" data-open="${esc(row.site.id)}">${esc(t('site.open'))}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  const inputs = root.querySelectorAll('.checkbox-grid input');
  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      const checked = [...inputs].filter((i) => i.checked).map((i) => i.value);
      if (checked.length > 3) {
        input.checked = false;
        root.querySelector('#compare-status').textContent = t('compare.max');
        return;
      }
      actions.setCompare(checked);
    });
  });

  root.querySelectorAll('[data-ref]').forEach((button) => {
    button.addEventListener('click', () => actions.setReference(button.dataset.ref));
  });
  root.querySelector('#cmp-date').addEventListener('change', (event) => {
    const ms = fromUtcInput(event.target.value);
    if (ms) actions.setDate(ms);
  });
  root.querySelector('#cmp-stay').addEventListener('change', (event) => actions.setStay(Number(event.target.value)));
  root.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => actions.openSite(button.dataset.open, state.dateMs));
  });

  root.querySelector('#export-csv').addEventListener('click', () => {
    const header = ['site', 'mission', 'sun_pct', 'night_hours', 'earth_pct', 'score'];
    const lines = plans.map((p) => [
      siteName(p.site), p.site.mission, p.metrics.sunPct.toFixed(1),
      p.metrics.maxNightHours.toFixed(0), p.metrics.earthPct.toFixed(1), p.score.toFixed(1),
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clps-comparison-${new Date(state.dateMs).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    root.querySelector('#compare-status').textContent = t('compare.export');
  });

  return null;
}

/* -------------------------------------------------------------- discover */

export function renderDiscover(root, ctx) {
  const { config, state, actions } = ctx;
  const pole = config.byId.get('ref_pole');
  const equator = config.byId.get('ref_equator');
  const yearStart = yearStartOf(state.dateMs);
  const year = new Date(yearStart).getUTCFullYear();
  const dayOffset = Math.round((state.dateMs - yearStart) / DAY_MS);
  const dayMs = 365 * DAY_MS;

  root.innerHTML = `
    <section class="container page-head">
      <p class="kicker">${esc(t('brand.tag'))}</p>
      <h1>${esc(t('discover.title'))}</h1>
      <p class="page-lede">${esc(t('discover.lede'))}</p>
    </section>

    <section class="container panel panel-scrub">
      <header class="panel-head">
        <h2>${esc(t('discover.compare'))}</h2>
        <p>${esc(t('discover.scrub'))}</p>
      </header>
      <label class="field field-range">
        <span>${esc(t('discover.date'))} : <span class="mono" id="scrub-date">${esc(fmtDate(state.dateMs))}</span></span>
        <input type="range" id="scrub" min="0" max="${365}" step="1" value="${dayOffset}" aria-label="${esc(t('discover.date'))}">
      </label>
      <div class="compare-cards" id="scrub-cards"></div>
    </section>

    ${config.scenarios.scenarios.map((scenario) => `<section class="container reading">
      <h2>${esc(t(scenario.titleKey))}</h2>
      ${scenario.paragraphs[getLang()].map((p) => `<p>${esc(p)}</p>`).join('')}
      <h3>${esc(t('discover.q'))}</h3>
      ${scenario.questions.map((q) => `<details class="qa">
        <summary>${esc(q.q[getLang()])}</summary>
        <p>${esc(q.a[getLang()])}</p>
      </details>`).join('')}
    </section>`).join('')}

    <section class="container panel" id="glossary">
      <header class="panel-head">
        <h2>${esc(t('discover.glossary'))}</h2>
        <p>${esc(t('discover.glossaryLede'))}</p>
      </header>
      <dl class="glossary">
        ${config.glossaire.terms.map((term) => `<div>
          <dt>${esc(term.term[getLang()])}</dt>
          <dd>${esc(term.def[getLang()])}</dd>
        </div>`).join('')}
      </dl>
    </section>`;

  const cards = root.querySelector('#scrub-cards');
  const scrub = root.querySelector('#scrub');
  const dateLabel = root.querySelector('#scrub-date');

  const draw = (ms) => {
    const g1 = siteGeometry(pole, ms);
    const g2 = siteGeometry(equator, ms);
    const row = (label, geom, cls) => `<article class="compare-card ${cls}">
      <h3>${esc(label)}</h3>
      <p class="big mono">${fmtNum(geom.sun.alt, 1)}°</p>
      <p class="muted">${esc(t('discover.sunNow'))}</p>
      <div class="meter" role="img" aria-label="${esc(`${label}: ${fmtNum(geom.sun.alt, 1)}°`)}">
        <span style="width:${Math.max(2, Math.min(100, ((geom.sun.alt + 90) / 180) * 100)).toFixed(1)}%"></span>
      </div>
      <p class="mono small">${esc(t('horizon.sun'))} ${fmtNum(geom.sun.alt, 1)}° / ${fmtNum(geom.sun.az, 0)}° · ${esc(t('horizon.earth'))} ${fmtNum(geom.earth.alt, 1)}°</p>
    </article>`;
    cards.innerHTML = row(t('discover.pole'), g1, 'card-pole') + row(t('discover.equator'), g2, 'card-equator');
  };
  draw(state.dateMs);

  scrub.addEventListener('input', () => {
    const ms = yearStart + Number(scrub.value) * DAY_MS;
    dateLabel.textContent = fmtDate(ms);
    draw(ms);
  });
  scrub.addEventListener('change', () => {
    actions.setDate(yearStart + Number(scrub.value) * DAY_MS, { silent: true });
  });

  return null;
}

/* --------------------------------------------------------------- preload */

/* Optional precomputed SPICE series: fetched before drawing, no-op when the
   pipeline has not been run (the analytical model then takes over). */

renderSite.prepare = async ({ config, state }) => {
  const site = config.byId.get(state.siteId);
  if (site) await ensurePrecomputed(site.id);
};

renderDates.prepare = async ({ config, state }) => {
  await ensurePrecomputed(pickDatesSite(config, state).id);
};

renderCompare.prepare = async ({ config, state }) => {
  await Promise.all(pickCompareIds(config, state).map((id) => ensurePrecomputed(id)));
};

/* ------------------------------------------------------------------ help */

export function renderHelp(root, ctx) {
  const { config } = ctx;
  const sources = config.sources;

  root.innerHTML = `
    <section class="container page-head">
      <p class="kicker">${esc(t('brand.tag'))}</p>
      <h1>${esc(t('help.title'))}</h1>
    </section>

    <section class="container reading">
      <h2>${esc(t('help.method'))}</h2>
      <ul class="plain-list">
        <li>${esc(t('help.m1'))}</li>
        <li>${esc(t('help.m2'))}</li>
        <li>${esc(t('help.m3'))}</li>
        <li>${esc(t('help.m4'))}</li>
      </ul>
      <h2>${esc(t('help.limits'))}</h2>
      <ul class="plain-list">
        <li>${esc(t('help.l1'))}</li>
        <li>${esc(t('help.l2'))}</li>
        <li>${esc(t('help.l3'))}</li>
        <li>${esc(t('help.l4'))}</li>
      </ul>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('help.sources'))}</h2>
        <p>${esc(t('assume.data'))} : <span class="mono">${esc(config.meta.version)}</span></p>
      </header>
      <div class="table-scroll">
        <table class="data-table">
          <caption>${esc(t('help.sources'))}</caption>
          <thead><tr>
            <th scope="col">${esc(t('help.resource'))}</th>
            <th scope="col">${esc(t('help.version'))}</th>
            <th scope="col">${esc(t('help.license'))}</th>
            <th scope="col">${esc(t('help.consulted'))}</th>
          </tr></thead>
          <tbody>
            ${sources.map((source) => `<tr>
              <th scope="row"><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(getLang() === 'fr' ? source.titleFr || source.title : source.title)}</a></th>
              <td class="mono">${esc(source.version)}</td>
              <td>${esc(source.license)}</td>
              <td class="mono">${esc(source.consulted)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="container panel">
      <header class="panel-head">
        <h2>${esc(t('discover.glossary'))}</h2>
        <p>${esc(t('discover.glossaryLede'))}</p>
      </header>
      <dl class="glossary">
        ${config.glossaire.terms.map((term) => `<div>
          <dt>${esc(term.term[getLang()])}</dt>
          <dd>${esc(term.def[getLang()])}</dd>
        </div>`).join('')}
      </dl>
    </section>`;

  return null;
}
