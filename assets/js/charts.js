/**
 * Hand-rolled SVG charts: polar sky, visibility timeline, score heat map.
 * Everything is inline SVG with <title>/<desc> and text redundancy, so no
 * information is carried by colour alone.
 */

import { t, fmtNum, fmtTime, fmtDate, fmtDateTime, getLang } from './i18n.js';
import { horizonAt } from './horizon.js';

const NS = 'http://www.w3.org/2000/svg';

export function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const MAX_ELEV = 10;

function radiusFor(alt, R) {
  const clamped = Math.max(0, Math.min(MAX_ELEV, alt));
  return R * (1 - clamped / MAX_ELEV);
}

function polarXY(az, alt, cx, cy, R) {
  const a = ((az - 90) * Math.PI) / 180;
  const r = radiusFor(alt, R);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/**
 * Polar horizon: azimuth around the rim, 0-10 deg elevation from rim to centre,
 * with the terrain silhouette and the 24 h tracks of Sun and Earth.
 */
export function horizonSvg({ series, index, profile }) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const R = 176;
  const geom = {
    sun: { alt: series.sunAlt[index], az: series.sunAz[index] },
    earth: { alt: series.earthAlt[index], az: series.earthAz[index] },
  };

  const rings = [5, 10]
    .map((deg) => `<circle cx="${cx}" cy="${cy}" r="${radiusFor(deg, R).toFixed(1)}" class="ring"/>`)
    .join('');

  const spokes = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((az) => {
      const a = ((az - 90) * Math.PI) / 180;
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="${az % 90 === 0 ? 'spoke' : 'spoke minor'}"/>`;
    })
    .join('');

  const labels = [
    ['N', 0], ['E', 90], ['S', 180], ['O', 270],
  ]
    .map(([label, az]) => {
      const a = ((az - 90) * Math.PI) / 180;
      const x = cx + (R + 22) * Math.cos(a);
      const y = cy + (R + 22) * Math.sin(a) + 5;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="compass" text-anchor="middle">${label}</text>`;
    })
    .join('');

  // Terrain silhouette: mask elevation per azimuth, clamped to the chart range.
  let maskPath = '';
  for (let az = 0; az <= 360; az += 2) {
    const h = Math.max(0, horizonAt(profile, az));
    const [x, y] = polarXY(az, Math.min(h, MAX_ELEV), cx, cy, R);
    maskPath += `${az === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  maskPath += 'Z';

  const track = (altArr, azArr, cls) => {
    const points = [];
    for (let k = -12; k <= 12; k += 1) {
      const i = Math.min(series.count - 1, Math.max(0, index + k));
      const alt = altArr[i];
      if (alt < -2) {
        points.push(null);
        continue;
      }
      points.push(polarXY(azArr[i], Math.max(0, alt), cx, cy, R));
    }
    const segments = [];
    let current = '';
    for (const p of points) {
      if (!p) {
        if (current) segments.push(current);
        current = '';
      } else {
        current += `${current ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
      }
    }
    if (current) segments.push(current);
    return segments.map((d) => `<path d="${d}" class="track ${cls}"/>`).join('');
  };

  const marker = (body, cls, label) => {
    const hidden = body.alt < 0;
    const alt = Math.max(0, Math.min(MAX_ELEV, body.alt));
    const [x, y] = polarXY(body.az, alt, cx, cy, R);
    const ring = hidden ? ' marker-hidden' : '';
    return `<g class="marker ${cls}${ring}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hidden ? 5 : 7}"/>
      <text x="${x.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="middle" class="marker-label">${label}</text>
      <title>${escapeXml(`${label}: ${t('horizon.summary', {
        az: fmtNum(body.az, 0),
        el: fmtNum(body.alt, 1),
        state: hidden ? t('horizon.hidden') : t('horizon.visible'),
      })}`)}</title>
    </g>`;
  };

  // A summit looks down on its surroundings: show those azimuths just outside
  // the rim, where "below the horizontal" lives.
  let belowPath = '';
  let pen = false;
  if (profile.min < 0) {
    for (let az = 0; az <= 362; az += 2) {
      const neg = az < 360 && horizonAt(profile, az) < 0;
      const a = ((az - 90) * Math.PI) / 180;
      const x = cx + (R + 7) * Math.cos(a);
      const y = cy + (R + 7) * Math.sin(a);
      if (neg) {
        belowPath += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
        pen = true;
      } else {
        pen = false;
      }
    }
  }

  const summary = [
    `${t('horizon.sun')} ${fmtNum(geom.sun.alt, 1)}°, ${t('horizon.earth')} ${fmtNum(geom.earth.alt, 1)}°`,
    `${t('horizon.mask')} ${fmtNum(profile.min, 1)}° … ${fmtNum(profile.max, 1)}°`,
  ].join(' · ');

  return `<svg viewBox="0 0 ${size} ${size}" class="chart chart-horizon" role="img" aria-labelledby="hz-t hz-d">
    <title id="hz-t">${escapeXml(t('horizon.title'))}</title>
    <desc id="hz-d">${escapeXml(`${t('horizon.desc')} ${summary}`)}</desc>
    <defs>
      <clipPath id="horizon-clip"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="horizon-rim"/>
    ${rings}${spokes}${labels}
    <g clip-path="url(#horizon-clip)">
      <path d="${maskPath}" class="terrain"/>
      ${track(series.sunAlt, series.sunAz, 'track-sun')}
      ${track(series.earthAlt, series.earthAz, 'track-earth')}
    </g>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="horizon-rim strong"/>
    ${belowPath ? `<path d="${belowPath}" class="below-horizon"/>` : ''}
    ${marker(geom.sun, 'marker-sun', 'S')}
    ${marker(geom.earth, 'marker-earth', 'T')}
  </svg>`;
}

function niceTicks(i0, i1, stepMs, startMs) {
  const spanDays = ((i1 - i0) * stepMs) / 86400000;
  const ticks = [];
  if (spanDays <= 2.5) {
    const step = 6;
    for (let i = i0; i <= i1; i += step) {
      ticks.push({ i, label: fmtTime(startMs + i * stepMs) });
    }
  } else if (spanDays <= 70) {
    const step = Math.max(1, Math.round(spanDays / 8)) * 24;
    for (let i = i0; i <= i1; i += step) {
      ticks.push({ i, label: fmtDate(startMs + i * stepMs, { day: '2-digit', month: 'short' }) });
    }
  } else {
    const labelOf = (ms) => fmtDate(ms, { month: 'short' });
    let last = '';
    for (let i = i0; i <= i1; i += 24) {
      const label = labelOf(startMs + i * stepMs);
      if (label !== last) {
        ticks.push({ i, label });
        last = label;
      }
    }
  }
  return ticks;
}

/**
 * Dual-track visibility timeline. Sun on the upper track, Earth below, hatched
 * bands for shadow, stay window outlined, selected hour marked.
 */
export function timelineSvg({ series, i0, i1, stayI0, stayI1, index }) {
  const width = 960;
  const height = 230;
  const padL = 92;
  const padR = 18;
  const plotW = width - padL - padR;
  const tracks = [
    { key: 'sun', y: 34, h: 46, flag: series.sunVis, cls: 'band-sun' },
    { key: 'earth', y: 104, h: 46, flag: series.earthVis, cls: 'band-earth' },
  ];

  const xFor = (i) => padL + ((i - i0) / Math.max(1, i1 - i0)) * plotW;

  const runs = (flag, y, h, cls) => {
    let out = '';
    let i = Math.max(0, i0);
    const end = Math.min(series.count, i1);
    while (i < end) {
      const value = flag[i];
      let j = i + 1;
      while (j < end && flag[j] === value) j += 1;
      const x = xFor(i);
      const w = Math.max(1, xFor(j) - x);
      out += value
        ? `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" class="${cls}"/>`
        : `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" class="band-shadow"/>`;
      i = j;
    }
    return out;
  };

  const ticks = niceTicks(i0, i1, series.stepMs, series.startMs);
  const tickMarks = ticks
    .map((tick) => {
      const x = xFor(tick.i);
      return `<line x1="${x.toFixed(1)}" y1="24" x2="${x.toFixed(1)}" y2="182" class="tick"/>
        <text x="${x.toFixed(1)}" y="200" text-anchor="middle" class="axis">${escapeXml(tick.label)}</text>`;
    })
    .join('');

  const stayX = xFor(Math.max(i0, stayI0));
  const stayW = Math.max(1, xFor(Math.min(i1, stayI1)) - stayX);
  const cursorX = xFor(Math.min(i1, Math.max(i0, index)));

  const labels = tracks
    .map((tr) => `<text x="${padL - 12}" y="${tr.y + tr.h / 2 + 4}" text-anchor="end" class="track-label">${escapeXml(t(tr.key === 'sun' ? 'horizon.sun' : 'horizon.earth'))}</text>`)
    .join('');

  const focusX = cursorX.toFixed(1);
  const focusLabel = fmtDateTime(series.startMs + index * series.stepMs);

  return `<svg viewBox="0 0 ${width} ${height}" class="chart chart-timeline" role="img" aria-labelledby="tl-t tl-d" data-i0="${i0}" data-i1="${i1}" data-padl="${padL}" data-plotw="${plotW}">
    <title id="tl-t">${escapeXml(t('timeline.title'))}</title>
    <desc id="tl-d">${escapeXml(`${t('timeline.summary')} ${t('timeline.now')}: ${focusLabel}.`)}</desc>
    <defs>
      <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="7" class="hatch-line"/>
      </pattern>
    </defs>
    ${labels}
    ${tracks.map((tr) => `<rect x="${padL}" y="${tr.y}" width="${plotW}" height="${tr.h}" class="track-bg"/>`).join('')}
    ${tracks.map((tr) => runs(tr.flag, tr.y, tr.h, tr.cls)).join('')}
    <rect x="${stayX.toFixed(1)}" y="22" width="${stayW.toFixed(1)}" height="140" class="stay-window"/>
    ${tickMarks}
    <line x1="${focusX}" y1="20" x2="${focusX}" y2="182" class="cursor"/>
    <circle cx="${focusX}" cy="166" r="4" class="cursor-dot"/>
    <line x1="${padL}" y1="182" x2="${padL + plotW}" y2="182" class="axis-line"/>
  </svg>`;
}

/**
 * Monthly calendar heat map of landing-date scores.
 * Cells carry a <title>, the top five are ringed, and a hatched overlay marks
 * the weakest decile so the reading survives greyscale.
 */
export function heatmapSvg({ results, year }) {
  const cell = 22;
  const gap = 3;
  const labelW = 74;
  const top = 30;
  const width = labelW + 31 * (cell + gap) + 16;
  const height = top + 12 * (cell + gap) + 34;

  const byDate = new Map();
  for (const r of results) {
    const d = new Date(r.startMs);
    byDate.set(`${d.getUTCMonth() + 1}-${d.getUTCDate()}`, r);
  }

  const scores = results.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const ranked = [...results].sort((a, b) => b.score - a.score);
  const bestStarts = new Set(ranked.slice(0, 5).map((r) => r.startMs));

  const monthFmt = new Intl.DateTimeFormat(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', timeZone: 'UTC' });

  let cells = '';
  let monthLabels = '';
  for (let m = 0; m < 12; m += 1) {
    const y = top + m * (cell + gap);
    monthLabels += `<text x="${labelW - 10}" y="${y + cell - 6}" text-anchor="end" class="axis">${escapeXml(monthFmt.format(Date.UTC(year, m, 15)))}</text>`;
    for (let day = 1; day <= 31; day += 1) {
      const r = byDate.get(`${m + 1}-${day}`);
      const x = labelW + (day - 1) * (cell + gap);
      if (!r) {
        cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="cell empty"/>`;
        continue;
      }
      const ratio = (r.score - min) / span;
      const fill = `color-mix(in oklab, var(--surface-2) ${Math.round((1 - ratio) * 100)}%, var(--sun) ${Math.round(ratio * 100)}%)`;
      const isTop = bestStarts.has(r.startMs);
      const weak = ratio < 0.12 ? '<rect class="cell-hatch" width="' + cell + '" height="' + cell + '" fill="url(#hatch-weak)"/>' : '';
      cells += `<g class="cell-group" data-ms="${r.startMs}" tabindex="0" role="button" aria-label="${escapeXml(`${fmtDate(r.startMs)} — ${t('dates.score')} ${fmtNum(r.score, 0)}`)}">
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="cell${isTop ? ' cell-top' : ''}" style="fill:${fill}"/>
        ${weak}
        <title>${escapeXml(`${fmtDate(r.startMs)} · ${t('dates.score')} ${fmtNum(r.score, 0)} · ${t('metric.sun')} ${fmtNum(r.sunPct, 0)} %`)}</title>
      </g>`;
    }
  }

  const days = Array.from({ length: 31 }, (_, d) => d + 1)
    .filter((d) => d === 1 || d % 5 === 0)
    .map((d) => `<text x="${labelW + (d - 1) * (cell + gap) + cell / 2}" y="${top - 9}" text-anchor="middle" class="axis">${d}</text>`)
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart chart-heatmap" role="img" aria-labelledby="hm-t hm-d">
    <title id="hm-t">${escapeXml(t('dates.heatmap'))}</title>
    <desc id="hm-d">${escapeXml(`${t('dates.heatmap')} ${year}. ${t('dates.legend')} ${fmtNum(min, 0)}, ${t('dates.legendHigh')} ${fmtNum(max, 0)}.`)}</desc>
    <defs>
      <pattern id="hatch-weak" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/>
      </pattern>
    </defs>
    ${days}${monthLabels}${cells}
  </svg>`;
}

/** Bar chart of sunlit share per month for one site, as a compact SVG. */
export function monthlyBarsSvg({ series, year }) {
  const width = 720;
  const height = 180;
  const padL = 36;
  const padB = 28;
  const months = 12;
  const barW = (width - padL - 12) / months - 6;

  const buckets = Array.from({ length: months }, () => ({ lit: 0, total: 0 }));
  for (let i = 0; i < series.count; i += 1) {
    const d = new Date(series.startMs + i * series.stepMs);
    if (d.getUTCFullYear() !== year) continue;
    const b = buckets[d.getUTCMonth()];
    b.total += 1;
    b.lit += series.sunVis[i];
  }

  const monthFmt = new Intl.DateTimeFormat(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', timeZone: 'UTC' });
  let bars = '';
  buckets.forEach((b, m) => {
    const pct = b.total ? (b.lit / b.total) * 100 : 0;
    const h = ((height - padB - 18) * pct) / 100;
    const x = padL + m * (barW + 6);
    const y = height - padB - h;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" class="bar"/>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" class="axis small">${fmtNum(pct, 0)}</text>
      <text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="axis">${escapeXml(monthFmt.format(Date.UTC(year, m, 15)))}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" class="chart chart-bars" role="img" aria-labelledby="mb-t mb-d">
    <title id="mb-t">${escapeXml(`${t('metric.sun')} — ${year}`)}</title>
    <desc id="mb-d">${escapeXml(`${t('metric.sun')} ${t('dates.month')}: ${buckets.map((b, m) => `${monthFmt.format(Date.UTC(year, m, 15))} ${b.total ? fmtNum((b.lit / b.total) * 100, 0) : 0}%`).join(', ')}.`)}</desc>
    <line x1="${padL}" y1="${height - padB}" x2="${width - 12}" y2="${height - padB}" class="axis-line"/>
    ${bars}
  </svg>`;
}
