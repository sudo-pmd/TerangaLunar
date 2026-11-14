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
  renderHome, renderSite, renderDates, renderCompare, renderDiscover, renderHelp,
} from './views.js';
import { renderMap, renderLearn, renderSites, renderScience } from './pages.js';

const ROUTES = {
  home: renderHome,
  map: renderMap,
  learn: renderLearn,
  sites: renderSites,
  science: renderScience,
  site: renderSite,
  dates: renderDates,
  compare: renderCompare,
  discover: renderDiscover,
  help: renderHelp,
};

/** Which dock entry stays highlighted for a route. */
const NAV_PARENT = {
  site: 'sites',
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
  setProbe(probe, { silent = true } = {}) {
    app.state.probe = probe;
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
      ${NAV.map(([key, href]) => `<a class="dock-item" href="${href}" data-nav="${key}" aria-label="${t(`nav.${key}`)}">
        ${dockIcon(key)}
        <span class="dock-pop" aria-hidden="true"><strong>${t(`nav.${key}`)}</strong><em>${t(`tip.${key}`)}</em></span>
      </a>`).join('')}
      <span class="dock-sep" aria-hidden="true"></span>
      <button type="button" class="dock-item dock-lang" id="lang-toggle"
        aria-label="${t('lang.switch')} — ${other.toUpperCase()}"
        title="${t('lang.switch')}">
        <span aria-hidden="true">${other.toUpperCase()}</span>
      </button>
    </nav>
    <footer class="site-footer">
      <div class="container footer-inner">
        <p class="footer-brand">TerangaLunar <span class="muted">· ${t('brand.tagline')}</span></p>
        <p class="footer-meta mono">
          ${t('footer.data')} ${app.config.meta.version}
          · ${t('footer.computed')} ${fmtDate(Date.now())}
          · <a href="#/help">${t('footer.sources')}</a>
          · <a href="#/science">${t('nav.science')}</a>
        </p>
        <p class="muted small">${t('footer.note2')}</p>
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
