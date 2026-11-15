/**
 * Bootstrap, hash router and shared actions.
 *
 * The shell is deliberately thin: a sky, a dock on the right that holds the five
 * pages and the language switch, and the page itself. No header, so the Moon
 * gets the whole screen.
 */

import { loadConfig } from './data.js';
import { initLang, setLang, getLang, t, fmtDate, onLangChange } from './i18n.js';
import { readState, buildHash } from './state.js';
import { mountStarfield } from './starfield.js';
import { installTerrain } from './horizon.js';
import {
  renderHome, renderSite, renderStudy, renderDates, renderCompare, renderDiscover, renderHelp,
  requestPrint,
} from './views.js';
import { renderMap, renderLearn, renderSites, renderScience } from './pages.js';

const ROUTES = {
  home: renderHome,
  map: renderMap,
  learn: renderLearn,
  sites: renderSites,
  science: renderScience,
  site: renderSite,
  study: renderStudy,
  dates: renderDates,
  compare: renderCompare,
  discover: renderDiscover,
  help: renderHelp,
};

/** Which dock entry stays highlighted for a route. */
const NAV_PARENT = {
  site: 'sites',
  study: 'map',
  dates: 'science',
  compare: 'science',
  discover: 'learn',
  help: 'science',
};

const app = {
  config: null,
  state: null,
  cleanup: null,
  root: null,
};

function navigate({ replace = false } = {}) {
  const hash = buildHash(app.state);
  if (window.location.hash === hash) {
    render();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', hash);
    render();
  } else {
    window.location.hash = hash;
  }
}

const actions = {
  openSite(id, dateMs) {
    app.state.route = 'site';
    app.state.siteId = id;
    if (dateMs) app.state.dateMs = dateMs;
    navigate();
  },
  setDate(ms, { silent = false } = {}) {
    app.state.dateMs = ms;
    if (silent) {
      window.history.replaceState(null, '', buildHash(app.state));
      return;
    }
    navigate();
  },
  setStay(days) {
    app.state.stayDays = days;
    navigate();
  },
  setProfile(profile) {
    app.state.profile = profile;
    navigate();
  },
  setWeights(energy) {
    app.state.weights = { energy, comm: 100 - energy };
    navigate();
  },
  setCompare(ids) {
    app.state.compare = ids;
    if (!ids.includes(app.state.referenceId)) app.state.referenceId = ids[0] || null;
    navigate();
  },
  setReference(id) {
    app.state.referenceId = id;
    navigate();
  },
  setSeuils(seuils) {
    app.state.seuils = seuils;
    window.history.replaceState(null, '', buildHash(app.state));
  },
  selectSite(id) {
    app.state.siteId = id;
    navigate();
  },
  /** Free study point on the map; silent so a click does not reload the scene. */
  /** Study sheet for the free point: the printable document behind the map. */
  openStudy({ print = false } = {}) {
    requestPrint(print);
    app.state.route = 'study';
    navigate();
  },
  setProbeName(name) {
    app.state.probeName = String(name || '').slice(0, 60);
    const hash = buildHash(app.state);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  },
  setProbe(probe, { silent = true } = {}) {
    app.state.probe = probe;
    if (!probe) app.state.probeName = '';
    const hash = buildHash(app.state);
    if (window.location.hash === hash) return;
    if (silent) window.history.replaceState(null, '', hash);
    else window.location.hash = hash;
  },
};

const NAV = [
  ['home', '#/'],
  ['map', '#/map'],
  ['learn', '#/learn'],
  ['sites', '#/sites'],
  ['science', '#/science'],
];

const ICONS = {
  home: '<path d="M15.6 3.6a8.4 8.4 0 1 0 4.8 12.6 9.2 9.2 0 0 1-4.8-12.6Z"/>',
  map: '<circle cx="12" cy="12" r="8.2"/><ellipse cx="12" cy="12" rx="3.6" ry="8.2"/><path d="M3.8 12h16.4"/>',
  learn: '<circle cx="12" cy="12" r="8.2"/><path d="m14.9 9.1-2 5.8-5.8 2 2-5.8z"/>',
  sites: '<path d="M12 21c4-3.7 6-7 6-9.6A6 6 0 1 0 6 11.4C6 14 8 17.3 12 21Z"/><circle cx="12" cy="11.2" r="2.1"/>',
  science: '<path d="M9.4 3.2h5.2M10.6 3.2v5.4L6 17.6A2.6 2.6 0 0 0 8.3 21h7.4a2.6 2.6 0 0 0 2.3-3.4L13.4 16.6V3.2"/>',
};

/** The entry that sits at the foot of the dock, under the rule. */
const DOCK_TAIL = 'learn';

function dockLink([key, href]) {
  return `<a class="dock-item${key === DOCK_TAIL ? ' dock-item-tail' : ''}" href="${href}" data-nav="${key}" aria-label="${t(`nav.${key}`)}">
        ${dockIcon(key)}
        <span class="dock-pop" aria-hidden="true"><strong>${t(`nav.${key}`)}</strong></span>
      </a>`;
}

function dockIcon(key) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[key] || ''}</svg>`;
}

function shell() {
  const lang = getLang();
  const other = lang === 'fr' ? 'en' : 'fr';
  return `
    <a class="skip-link" href="#main">${t('nav.skip')}</a>
    <main id="main" tabindex="-1"></main>
    <nav class="dock" aria-label="${t('nav.menu')}">
      ${NAV.filter(([key]) => key !== DOCK_TAIL).map(dockLink).join('')}
      <span class="dock-sep" aria-hidden="true"></span>
      ${NAV.filter(([key]) => key === DOCK_TAIL).map(dockLink).join('')}
      <button type="button" class="dock-item dock-lang" id="lang-toggle"
        aria-label="${t('lang.switch')} — ${other.toUpperCase()}"
        title="${t('lang.switch')}">
        <span aria-hidden="true">${other.toUpperCase()}</span>
      </button>
    </nav>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-col footer-brand-col">
          <p class="footer-brand">TerangaLunar</p>
          <p class="footer-tagline">${t('brand.tagline')}</p>
          <nav class="footer-links" aria-label="${t('nav.menu')}">
            <a href="#/map">${t('nav.map')}</a>
            <a href="#/sites">${t('nav.sites')}</a>
            <a href="#/learn">${t('nav.learn')}</a>
            <a href="#/science">${t('nav.science')}</a>
            <a href="#/help">${t('nav.method')}</a>
          </nav>
        </div>
        <div class="footer-col">
          <p class="footer-kicker">${t('footer.dataTitle')}</p>
          <p class="footer-meta">${t('footer.data')} · v${app.config.meta.version}</p>
          <p class="footer-meta">${t('footer.computed')} ${fmtDate(Date.now())}</p>
          <p class="footer-meta"><a href="#/help">${t('footer.sources')}</a></p>
        </div>
        <div class="footer-col footer-legal">
          <p class="footer-kicker">${t('footer.legalTitle')}</p>
          <p class="footer-meta">© 2026 TerangaLunar. ${t('footer.rights')}</p>
          <p class="footer-meta muted">${t('footer.credit')}</p>
        </div>
      </div>
    </footer>`;
}

let renderToken = 0;

async function render() {
  if (app.cleanup) {
    app.cleanup();
    app.cleanup = null;
  }
  const main = app.root.querySelector('#main');
  if (!main) return;
  const fn = ROUTES[app.state.route] || ROUTES.home;
  const ctx = { config: app.config, state: app.state, actions };
  const token = ++renderToken;

  // Routes may fetch precomputed SPICE series first; they draw synchronously
  // from the cache afterwards.
  if (typeof fn.prepare === 'function') {
    try {
      await fn.prepare(ctx);
    } catch (error) {
      console.warn('[prepare]', error);
    }
  }
  if (token !== renderToken) return;

  app.cleanup = fn(main, ctx) || null;
  document.body.dataset.route = app.state.route;
  adaptLogos(main);

  const active = NAV_PARENT[app.state.route] || app.state.route;
  app.root.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Replay the entrance animation on each page change.
  main.classList.remove('page-in');
  void main.offsetWidth;
  main.classList.add('page-in');

  if (app.hasRendered) {
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  app.hasRendered = true;
}

function renderAll() {
  app.root.innerHTML = shell();
  app.root.querySelector('#lang-toggle').addEventListener('click', () => {
    setLang(getLang() === 'fr' ? 'en' : 'fr');
  });
  render();
}

/**
 * The brand lockups are plain PNGs. Two things have to be fixed before they can
 * sit on a dark page: the export carries a white background, and generous white
 * margins that push the artwork into the middle of a big empty rectangle. Both
 * are measured once, here, and the image is rebuilt: white knocked out, edges
 * trimmed. Nothing is guessed from the file name.
 */
function cleanLogo(img) {
  const finish = (canvas) => {
    img.src = canvas.toDataURL('image/png');
    img.classList.add('is-cleaned');
  };

  const run = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;

      // 1. White background to transparent. A soft band keeps the silver
      //    outlines and the antialiased edges of the artwork intact.
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          // Already-transparent pixels often keep a coloured RGB: alpha decides
          // what is ink, never the colour alone.
          if (px[i + 3] < 12) {
            px[i + 3] = 0;
            continue;
          }
          const lo = Math.min(px[i], px[i + 1], px[i + 2]);
          if (lo > 246) {
            px[i + 3] = 0;
            continue;
          }
          if (lo > 236) px[i + 3] = Math.round(255 * ((246 - lo) / 10));
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) return;
      ctx.putImageData(data, 0, 0);

      // 2. Trim the margins, with a hair of breathing space.
      const pad = Math.round(Math.max(w, h) * 0.008);
      const x0 = Math.max(0, minX - pad);
      const y0 = Math.max(0, minY - pad);
      const cw = Math.min(w - x0, maxX - minX + 1 + pad * 2);
      const ch = Math.min(h - y0, maxY - minY + 1 + pad * 2);
      const out = document.createElement('canvas');
      out.width = cw;
      out.height = ch;
      out.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
      finish(out);
    } catch {
      /* a canvas we cannot read leaves the image as it was exported */
    }
  };

  if (img.complete && img.naturalWidth) run();
  else img.addEventListener('load', run, { once: true });
}

function adaptLogos(scope = document) {
  for (const img of scope.querySelectorAll('img.logo-img:not([data-adapted])')) {
    img.dataset.adapted = '1';
    cleanLogo(img);
  }
}

function onHashChange() {
  const next = readState();
  next.language = next.language || getLang();
  app.state = next;
  if (next.language !== getLang()) {
    setLang(next.language);
    return;
  }
  render();
}

/* ------------------------------------------------------------- loading screen */

const loader = {
  el: null,
  start: 0,

  init() {
    this.el = document.getElementById('loader');
    this.start = performance.now();
    this.line = this.el?.querySelector('#loader-line');
    if (this.line) this.line.textContent = t('boot.loading');
  },

  /** One line, one fact: what is being loaded right now. */
  step(id) {
    if (this.line) this.line.textContent = `${t(`boot.${id}`)}…`;
  },

  async finish() {
    if (!this.el) return;
    // A visible flash of loader is worse than none: keep it up for a moment.
    const elapsed = performance.now() - this.start;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 520 - elapsed)));
    this.el.classList.add('is-done');
    document.body.classList.add('is-ready');
    const remove = () => this.el?.remove();
    this.el.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 1200);
  },
};

/** Decode an image without blocking; resolves either way. */
function preloadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function boot() {
  // Tells the inline watchdog in index.html that the modules did load.
  window.__bootReady = true;
  mountStarfield(document.body);
  app.root = document.getElementById('app');
  loader.init();
  adaptLogos(document);

  // The two heavy assets are warmed while the configuration is parsed.
  const sceneWarm = Promise.all([
    preloadImage('assets/img/moon.jpg'),
    preloadImage('assets/img/ldem_3_8bit.jpg'),
    import('three').catch(() => null),
  ]);

  try {
    app.config = await loadConfig();
  } catch (error) {
    app.root.innerHTML = `<section class="boot-error">
      <h1>${t('ui.error')}</h1>
      <p class="mono">${String(error.message || error)}</p>
      <p><a class="btn primary" href="">${t('ui.retry')}</a></p>
    </section>`;
    console.error(error);
    await loader.finish();
    return;
  }

  loader.step('config');

  // Real horizon masks: 720 azimuths per site, measured on LOLA LDEM 80S.
  // Without the file the sites keep their analytic envelope; either way the
  // boot continues, because the map is usable without measured terrain.
  if (app.config.terrain) installTerrain(app.config.terrain);
  loader.step('terrain');

  app.state = readState();
  initLang(app.state.language);
  app.state.language = getLang();

  renderAll();

  await sceneWarm;
  loader.step('scene');
  await loader.finish();

  window.addEventListener('hashchange', onHashChange);
  onLangChange(() => {
    app.state.language = getLang();
    window.history.replaceState(null, '', buildHash(app.state));
    renderAll();
  });
}

boot();
