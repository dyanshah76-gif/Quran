// Quran reader: plain JavaScript, no build step, works on GitHub Pages.
//
// All Quran text, translations and tafsir are fetched at runtime, unchanged,
// from the pinned sources in sources.js. This file only places them on the page;
// it never writes, edits or translates any of that text.

import { QURAN_JSON, ARABIC_TEXT, TRANSLATIONS, TAFSIR, QURAN_FONT } from './sources.js';
import { STRINGS } from './i18n.js';

const SURAH_COUNT = 114;
const SETTINGS_KEY = 'quran.settings.v1';
const LAST_READ_KEY = 'quran.lastRead.v1';
const FETCH_TIMEOUT_MS = 15000;
const GROUP_SCAN_LIMIT = 20;
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function svgIcon(markup) {
  const wrap = document.createElement('span');
  wrap.innerHTML = markup; // static markup written in this file, never data
  return wrap.firstElementChild;
}

const ICONS = {
  brand:
    '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8.5" y="8.5" width="15" height="15" rx="1"/><rect x="8.5" y="8.5" width="15" height="15" rx="1" transform="rotate(45 16 16)"/></g><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></g></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></g></svg>',
};

const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clampNumber = (value, min, max, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage disabled: settings simply won't persist */
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const DEFAULTS = {
  ui: (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en',
  showFr: true,
  showEn: false,
  tafsir: 'en',
  arSize: 30,
  trSize: 17,
  theme: 'auto',
};

function loadSettings() {
  const saved = readStore(SETTINGS_KEY) || {};
  return {
    ui: saved.ui === 'fr' || saved.ui === 'en' ? saved.ui : DEFAULTS.ui,
    showFr: typeof saved.showFr === 'boolean' ? saved.showFr : DEFAULTS.showFr,
    showEn: typeof saved.showEn === 'boolean' ? saved.showEn : DEFAULTS.showEn,
    tafsir: saved.tafsir === 'ar' || saved.tafsir === 'en' ? saved.tafsir : DEFAULTS.tafsir,
    arSize: clampNumber(saved.arSize, 22, 46, DEFAULTS.arSize),
    trSize: clampNumber(saved.trSize, 14, 26, DEFAULTS.trSize),
    theme: ['auto', 'light', 'dark'].includes(saved.theme) ? saved.theme : DEFAULTS.theme,
  };
}

const state = {
  settings: loadSettings(),
  current: null, // what is on screen: {view:'home'} or {view:'surah', s, meta, verses, ...}
  routeToken: 0,
  scrollMemory: new Map(),
};

function saveSettings() {
  writeStore(SETTINGS_KEY, state.settings);
}

function applySettings() {
  const root = document.documentElement;
  const s = state.settings;
  root.lang = s.ui;
  root.style.setProperty('--ar-size', `${s.arSize}px`);
  root.style.setProperty('--tr-size', `${s.trSize}px`);
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && paper) meta.setAttribute('content', paper);
}

/* ------------------------------------------------------------------ */
/* Interface text                                                      */
/* ------------------------------------------------------------------ */

function raw(key) {
  const dict = STRINGS[state.settings.ui] || STRINGS.fr;
  return key in dict ? dict[key] : STRINGS.fr[key];
}

function t(key, vars = {}) {
  const value = raw(key);
  if (typeof value === 'function') return value(vars);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : ''));
}

// Builds a paragraph from a template whose {placeholders} become nodes (links).
function richText(tag, key, parts, attrs = {}) {
  const template = raw(key);
  const node = el(tag, attrs);
  template.split(/(\{\w+\})/).forEach((piece) => {
    const match = piece.match(/^\{(\w+)\}$/);
    if (match && match[1] in parts) {
      const part = parts[match[1]];
      node.append(part instanceof Node ? part : document.createTextNode(String(part)));
    } else if (piece) {
      node.append(document.createTextNode(piece));
    }
  });
  return node;
}

const extLink = (label, href) => el('a', { href, target: '_blank', rel: 'noopener' }, label);

/* ------------------------------------------------------------------ */
/* Data loading: pinned sources, fallbacks, validation                 */
/* ------------------------------------------------------------------ */

class SourceError extends Error {
  constructor(kind, attempts) {
    super(kind);
    this.kind = kind; // 'unreachable' | 'notfound' | 'invalid'
    this.attempts = attempts;
  }
}

const preferredBase = new Map();

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timer);
  }
}

// Tries each base URL in turn. Only data that passes `validate` is accepted.
async function fetchVerified(bases, path, validate) {
  const first = preferredBase.get(bases) || 0;
  const order = [first, ...bases.map((_, i) => i).filter((i) => i !== first)];
  const attempts = [];
  let notFound = 0;
  let invalid = 0;
  for (const i of order) {
    const url = bases[i] + path;
    try {
      const response = await fetchWithTimeout(url);
      if (response.status === 404) {
        notFound += 1;
        attempts.push({ url, status: '404' });
        continue;
      }
      if (!response.ok) {
        attempts.push({ url, status: String(response.status) });
        continue;
      }
      const data = await response.json();
      if (!validate(data)) {
        invalid += 1;
        attempts.push({ url, status: 'invalid' });
        continue;
      }
      preferredBase.set(bases, i);
      return { data, url };
    } catch (error) {
      attempts.push({ url, status: error && error.name === 'AbortError' ? 'timeout' : 'network' });
    }
  }
  let kind = 'unreachable';
  if (notFound === order.length) kind = 'notfound';
  else if (invalid > 0) kind = 'invalid';
  throw new SourceError(kind, attempts);
}

const memo = new Map();
function once(key, load) {
  if (!memo.has(key)) {
    memo.set(
      key,
      load().catch((error) => {
        memo.delete(key);
        throw error;
      }),
    );
  }
  return memo.get(key);
}

const isText = (value) => typeof value === 'string';

function validIndex(data) {
  return (
    Array.isArray(data) &&
    data.length === SURAH_COUNT &&
    data.every(
      (c, i) =>
        c &&
        c.id === i + 1 &&
        isText(c.name) &&
        isText(c.transliteration) &&
        isText(c.translation) &&
        Number.isInteger(c.total_verses) &&
        (c.type === 'meccan' || c.type === 'medinan'),
    )
  );
}

const validChapter = (n) => (data) =>
  data &&
  data.id === n &&
  Number.isInteger(data.total_verses) &&
  Array.isArray(data.verses) &&
  data.verses.length === data.total_verses &&
  data.verses.every((v, i) => v && v.id === i + 1 && isText(v.text) && v.text.length > 0 && isText(v.translation));

const validTafsir = (surah, ayah) => (data) =>
  data && data.surah === surah && data.ayah === ayah && isText(data.text);

const getIndex = (lang) =>
  once(`index:${lang}`, () => fetchVerified(QURAN_JSON.bases, QURAN_JSON.indexPath(lang), validIndex));

const getChapter = (lang, n) =>
  once(`chapter:${lang}:${n}`, () => fetchVerified(QURAN_JSON.bases, QURAN_JSON.chapterPath(lang, n), validChapter(n)));

const getTafsir = (edition, surah, ayah) =>
  once(`tafsir:${edition}:${surah}:${ayah}`, () =>
    fetchVerified(TAFSIR.bases, TAFSIR.ayahPath(TAFSIR.editions[edition].slug, surah, ayah), validTafsir(surah, ayah)),
  );

async function quranFontReady(timeoutMs) {
  if (!document.fonts || !document.fonts.load) return true;
  const spec = `32px ${QURAN_FONT.family}`;
  try {
    await Promise.race([document.fonts.load(spec, 'بسم'), wait(timeoutMs)]);
  } catch {
    /* handled by the check below */
  }
  try {
    return document.fonts.check(spec, 'بسم');
  } catch {
    return true;
  }
}

let arabicProseFontRequested = false;
function ensureArabicProseFont() {
  // Amiri is only downloaded when the Arabic tafsir is opened.
  if (arabicProseFontRequested) return;
  arabicProseFontRequested = true;
  document.head.append(
    el('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true }),
    el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap' }),
  );
}

/* ------------------------------------------------------------------ */
/* Messages: loading, errors, toast                                    */
/* ------------------------------------------------------------------ */

function loadingView(message) {
  return el('div', { class: 'loading', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), message);
}

function errorMessage(error) {
  if (error && error.kind === 'notfound') return t('errNotFound');
  if (error && error.kind === 'invalid') return t('errInvalid');
  return t('errUnreachable');
}

function errorView(error, onRetry, message) {
  const box = el('div', { class: 'notice warn', role: 'alert' });
  box.append(el('p', {}, message || errorMessage(error)));
  if (onRetry) {
    box.append(el('p', {}, el('button', { class: 'btn', type: 'button', onclick: onRetry }, t('retry'))));
  }
  if (error && Array.isArray(error.attempts) && error.attempts.length) {
    const list = el('ul');
    error.attempts.forEach((attempt) => list.append(el('li', {}, `${attempt.url} (${attempt.status})`)));
    box.append(el('details', {}, el('summary', {}, t('errTried')), list));
  } else if (error && !(error instanceof SourceError)) {
    console.error(error);
  }
  return box;
}

let toastTimer = 0;
function toast(message, ms = 3200) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), ms);
}

/* ------------------------------------------------------------------ */
/* Page chrome: top bar, footer                                        */
/* ------------------------------------------------------------------ */

const dom = {};

function renderTopbar() {
  const bar = document.getElementById('topbar');
  dom.topTitle = el('p', { class: 'topbar-title', id: 'topbar-title' });
  const brand = el('a', { class: 'brand', href: '#', 'aria-label': t('brandLabel') }, svgIcon(ICONS.brand), el('span', {}, t('appName')));
  const settingsButton = el(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': t('settings'), title: t('settings'), onclick: openSettings },
    svgIcon(ICONS.settings),
  );
  bar.replaceChildren(el('div', { class: 'topbar-inner wrap' }, brand, dom.topTitle, settingsButton));
  const skip = document.getElementById('skip-link');
  skip.textContent = t('skip');
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  const { en, ar } = TAFSIR.editions;
  footer.replaceChildren(
    el(
      'div',
      { class: 'wrap' },
      el('h2', {}, t('footerTitle')),
      richText('p', 'footArabic', { quranenc: extLink(ARABIC_TEXT.name, ARABIC_TEXT.url) }),
      richText('p', 'footTr', { tanzil: extLink('Tanzil.net', 'https://tanzil.net/') }),
      richText('p', 'footFiles', {
        qj: extLink(`quran-json ${QURAN_JSON.version}`, QURAN_JSON.url),
        author: extLink(QURAN_JSON.author.name, QURAN_JSON.author.url),
        license: extLink(QURAN_JSON.license.name, QURAN_JSON.license.url),
      }),
      richText('p', 'footTafsir', {
        en: extLink(`QUL ${en.id}`, en.qul),
        ar: extLink(`QUL ${ar.id}`, ar.qul),
        repo: extLink(TAFSIR.name, TAFSIR.url),
        mit: extLink(TAFSIR.license.name, TAFSIR.license.url),
      }),
      richText('p', 'footFont', {
        font: extLink(QURAN_FONT.name, QURAN_FONT.makerUrl),
        maker: QURAN_FONT.maker,
        copy: extLink(t('footFontCopy'), QURAN_FONT.copyUrl),
      }),
      el('p', {}, t('footNote')),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Router: #  ·  #2  ·  #2:255                                          */
/* ------------------------------------------------------------------ */

function parseHash(hash) {
  let value = hash || '';
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  value = value.replace(/^#\/?/, '').trim();
  if (!value) return { view: 'home' };
  const match = value.match(/^(\d{1,3})(?:[:.](\d{1,3}))?$/);
  if (!match) return { view: 'notfound' };
  const s = Number(match[1]);
  if (s < 1 || s > SURAH_COUNT) return { view: 'notfound' };
  return { view: 'surah', s, a: match[2] ? Number(match[2]) : null };
}

const main = () => document.getElementById('main');

async function route() {
  const target = parseHash(location.hash);
  if (panel.open) hidePanel({ restoreFocus: false });
  if (target.view === 'surah' && state.current && state.current.view === 'surah' && state.current.s === target.s && state.current.ready) {
    focusAyah(target.a, { fromLink: true });
    return;
  }
  const token = ++state.routeToken;
  if (target.view === 'home') return renderHome(token);
  if (target.view === 'surah') return renderSurah(target.s, target.a, token);
  return renderNotFound();
}

function restoreScroll(key) {
  const y = state.scrollMemory.get(key);
  window.scrollTo(0, typeof y === 'number' ? y : 0);
}

/* ------------------------------------------------------------------ */
/* Home: the 114 surahs with search                                    */
/* ------------------------------------------------------------------ */

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/['’‘`ʿʾ\-\s.,]/g, '');
}

async function renderHome(token) {
  state.current = { view: 'home' };
  document.title = t('docTitleHome');
  dom.topTitle.textContent = '';
  stopReadingObserver();

  const head = el(
    'section',
    { class: 'home-head', 'aria-labelledby': 'home-title' },
    el('p', { class: 'home-title-ar', lang: 'ar', dir: 'rtl', 'aria-hidden': 'true' }, t('homeTitleAr')),
    el('h1', { class: 'home-title', id: 'home-title', tabindex: '-1' }, t('homeTitle')),
    el('p', { class: 'home-lead' }, t('homeLead')),
  );
  const input = el('input', {
    type: 'search',
    id: 'surah-search',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
    placeholder: t('searchPlaceholder'),
  });
  const search = el(
    'div',
    { class: 'search', role: 'search' },
    el('label', { class: 'visually-hidden', for: 'surah-search' }, t('searchLabel')),
    svgIcon(ICONS.search),
    input,
  );
  const quick = el('div', { class: 'quick-links' });
  const list = el('ol', { class: 'surah-list', 'aria-label': t('surahListLabel') });
  const empty = el('p', { class: 'search-empty', hidden: true });
  const body = el('div', {}, loadingView(t('loadingList')));
  main().replaceChildren(head, search, quick, body);

  let index;
  try {
    ({ data: index } = await getIndex(state.settings.ui));
  } catch (error) {
    if (token !== state.routeToken) return;
    body.replaceChildren(errorView(error, () => route()));
    return;
  }
  if (token !== state.routeToken) return;

  const rows = index.map((surah) => {
    const verses = t('verses', surah.total_verses);
    const type = t(surah.type);
    const link = el(
      'a',
      { class: 'surah-link', href: `#${surah.id}` },
      el('span', { class: 'medal', 'aria-hidden': 'true' }, el('span', {}, surah.id)),
      el(
        'span',
        { class: 'surah-text' },
        el('span', { class: 'surah-tr' }, el('span', { class: 'visually-hidden' }, `${surah.id}. `), surah.transliteration),
        el('span', { class: 'surah-meaning' }, surah.translation),
        el('span', { class: 'surah-meta' }, `${verses}, ${type}`),
      ),
      el('span', { class: 'surah-ar', lang: 'ar', dir: 'rtl' }, surah.name),
    );
    const item = el('li', {}, link);
    return {
      surah,
      item,
      haystack: [normalize(surah.transliteration), normalize(surah.translation), normalize(surah.name)].join('|'),
    };
  });
  list.append(...rows.map((row) => row.item));
  body.replaceChildren(list, empty);

  const lastRead = readStore(LAST_READ_KEY);
  const resumeLink = () => {
    if (!lastRead || !Number.isInteger(lastRead.s) || !Number.isInteger(lastRead.a)) return null;
    const surah = index[lastRead.s - 1];
    if (!surah || lastRead.a < 1 || lastRead.a > surah.total_verses) return null;
    return el('a', { class: 'btn', href: `#${lastRead.s}:${lastRead.a}` }, t('resume', { name: surah.transliteration, a: lastRead.a }));
  };

  let firstMatch = null;
  let ayahTarget = null;
  const applyFilter = () => {
    const query = input.value.trim();
    quick.replaceChildren();
    ayahTarget = null;
    firstMatch = null;
    if (!query) {
      rows.forEach((row) => (row.item.hidden = false));
      empty.hidden = true;
      const resume = resumeLink();
      if (resume) quick.append(resume);
      return;
    }
    const keyMatch = query.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (keyMatch) {
      const s = Number(keyMatch[1]);
      const a = Number(keyMatch[2]);
      const surah = index[s - 1];
      if (surah && a >= 1 && a <= surah.total_verses) {
        ayahTarget = `#${s}:${a}`;
        quick.append(el('a', { class: 'btn primary', href: ayahTarget }, t('openAyah', { key: `${s}:${a}` })));
      }
    }
    const numberOnly = /^\d{1,3}$/.test(query) ? Number(query) : null;
    const needle = normalize(query);
    let shown = 0;
    rows.forEach((row) => {
      let visible;
      if (keyMatch) visible = row.surah.id === Number(keyMatch[1]);
      else if (numberOnly !== null) visible = row.surah.id === numberOnly;
      else visible = needle.length > 0 && row.haystack.includes(needle);
      row.item.hidden = !visible;
      if (visible) {
        shown += 1;
        if (!firstMatch) firstMatch = row.surah.id;
      }
    });
    empty.hidden = shown > 0;
    empty.textContent = shown > 0 ? '' : t('searchEmpty', { q: query });
  };

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (ayahTarget) location.hash = ayahTarget;
    else if (firstMatch) location.hash = `#${firstMatch}`;
  });
  applyFilter();
  restoreScroll(location.hash || '#');
}

/* ------------------------------------------------------------------ */
/* Surah page                                                          */
/* ------------------------------------------------------------------ */

function shownTranslations() {
  const langs = [];
  if (state.settings.showFr) langs.push('fr');
  if (state.settings.showEn) langs.push('en');
  return langs;
}

async function renderSurah(s, a, token) {
  state.current = { view: 'surah', s, ready: false };
  stopReadingObserver();
  dom.topTitle.textContent = '';
  main().replaceChildren(loadingView(t('loadingSurah')));
  window.scrollTo(0, 0);

  const langs = shownTranslations();
  const files = langs.length ? langs : [state.settings.ui];
  let index;
  let chapters;
  let basmala = null;
  let fontOk = true;
  try {
    const results = await Promise.all([getIndex(state.settings.ui), ...files.map((lang) => getChapter(lang, s))]);
    index = results[0].data;
    chapters = results.slice(1).map((result) => result.data);
    if (s !== 1 && s !== 9) {
      // The basmala shown above a surah is loaded from the source too:
      // it is the text of 1:1 in the same dataset.
      const first = await getChapter(files[0], 1);
      basmala = first.data.verses[0].text;
    }
    fontOk = await quranFontReady(4000);
  } catch (error) {
    if (token !== state.routeToken) return;
    main().replaceChildren(errorView(error, () => route()));
    return;
  }
  if (token !== state.routeToken) return;

  const meta = chapters[0];
  const total = meta.total_verses;
  const byLang = {};
  files.forEach((lang, i) => (byLang[lang] = chapters[i]));
  const meaning = (byLang[state.settings.ui] || index[s - 1]).translation;

  state.current = { view: 'surah', s, meta, total, verses: meta.verses, ready: false };
  document.title = t('docTitleSurah', { name: meta.transliteration, n: s });
  dom.topTitle.textContent = `${s}. ${meta.transliteration}`;

  // Header
  const sourceParts = [richText('span', 'sourceLine', { arabic: extLink(ARABIC_TEXT.name, ARABIC_TEXT.url) })];
  langs.forEach((lang) => {
    const tr = TRANSLATIONS[lang];
    sourceParts.push(' ', richText('span', 'sourceLineTr', { translator: extLink(tr.translator, tr.url), via: tr.via }));
  });
  const jumpInput = el('input', {
    type: 'number',
    id: 'jump-input',
    inputmode: 'numeric',
    min: '1',
    max: String(total),
    placeholder: `1–${total}`,
    required: true,
  });
  const jump = el(
    'form',
    {
      class: 'jump',
      onsubmit: (event) => {
        event.preventDefault();
        const n = Number(jumpInput.value);
        if (Number.isInteger(n) && n >= 1 && n <= total) location.hash = `#${s}:${n}`;
        else jumpInput.reportValidity();
      },
    },
    el('label', { for: 'jump-input' }, t('jumpLabel')),
    jumpInput,
    el('button', { class: 'btn', type: 'submit' }, t('jumpButton')),
  );

  const head = el(
    'header',
    { class: 'surah-head' },
    el(
      'div',
      { class: 'cartouche' },
      el('span', { class: 'orn start', 'aria-hidden': 'true' }),
      el('p', { class: 'surah-name-ar', lang: 'ar', dir: 'rtl' }, meta.name),
      el('span', { class: 'orn end', 'aria-hidden': 'true' }),
    ),
    el('h1', { id: 'surah-title', tabindex: '-1' }, meta.transliteration),
    el('p', { class: 'meaning' }, meaning),
    el('p', { class: 'meta' }, t('surahMeta', { n: s, verses: t('verses', total), type: t(meta.type) })),
    jump,
    el('p', { class: 'source-line' }, ...sourceParts),
    el('p', { class: 'tap-hint' }, t('tapHint')),
  );

  const parts = [head];
  if (!fontOk) parts.push(el('p', { class: 'notice warn', role: 'alert' }, t('fontWarn')));
  if (a !== null && (a < 1 || a > total)) {
    parts.push(el('p', { class: 'notice', role: 'alert' }, t('ayahMissing', { name: meta.transliteration, verses: t('verses', total), a })));
  }
  if (basmala) parts.push(el('p', { class: 'basmala', lang: 'ar', dir: 'rtl' }, basmala));
  else if (s === 9) parts.push(el('p', { class: 'no-basmala' }, t('noBasmala')));

  // Ayahs
  const list = el('ol', { class: 'ayahs', 'aria-labelledby': 'surah-title' });
  const fragment = document.createDocumentFragment();
  meta.verses.forEach((verse, i) => {
    const n = verse.id;
    const key = `${s}:${n}`;
    const item = el(
      'li',
      { class: 'ayah', id: `a-${n}`, dataset: { ayah: String(n) } },
      el('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, verse.text, ' ', el('span', { class: 'ayah-num', 'aria-hidden': 'true' }, toArabicDigits(n))),
    );
    langs.forEach((lang) => {
      item.append(el('p', { class: `tr tr-${lang}`, lang }, byLang[lang].verses[i].translation));
    });
    item.append(
      el(
        'div',
        { class: 'ayah-bar' },
        el('a', { class: 'ayah-key', href: `#${key}`, 'aria-label': t('keyAria', { key }) }, key),
        el('button', { class: 'btn', type: 'button', dataset: { action: 'tafsir' } }, t('tafsirButton')),
        el('button', { class: 'btn', type: 'button', dataset: { action: 'share' }, 'aria-label': t('shareAria', { key }) }, t('share')),
      ),
    );
    fragment.append(item);
  });
  list.append(fragment);
  list.addEventListener('click', (event) => onAyahClick(event, s));
  parts.push(list);

  // Previous / next surah
  const nav = el('nav', { class: 'surah-nav', 'aria-label': `${t('prevSurah')} / ${t('nextSurah')}` });
  if (s > 1) {
    const prev = index[s - 2];
    nav.append(el('a', { class: 'prev', href: `#${s - 1}`, rel: 'prev' }, el('small', {}, t('prevSurah')), el('strong', {}, `${prev.id}. ${prev.transliteration}`)));
  }
  if (s < SURAH_COUNT) {
    const next = index[s];
    nav.append(el('a', { class: 'next', href: `#${s + 1}`, rel: 'next' }, el('small', {}, t('nextSurah')), el('strong', {}, `${next.id}. ${next.transliteration}`)));
  }
  parts.push(nav);

  main().replaceChildren(...parts);
  state.current.ready = true;

  if (a !== null && a >= 1 && a <= total) focusAyah(a, { fromLink: false });
  else restoreScroll(location.hash);
  startReadingObserver(s);
}

function focusAyah(a, { fromLink }) {
  document.querySelectorAll('.ayah.is-target').forEach((node) => node.classList.remove('is-target'));
  if (a === null || a === undefined) {
    if (fromLink) window.scrollTo(0, 0);
    return;
  }
  const node = document.getElementById(`a-${a}`);
  if (!node) return;
  node.classList.add('is-target');
  node.scrollIntoView({ block: 'start' });
}

function onAyahClick(event, s) {
  const item = event.target.closest('.ayah');
  if (!item) return;
  const a = Number(item.dataset.ayah);
  const action = event.target.closest('[data-action]');
  if (action) {
    event.preventDefault();
    if (action.dataset.action === 'tafsir') openTafsir(s, a);
    else if (action.dataset.action === 'share') shareAyah(s, a);
    return;
  }
  if (event.target.closest('a, button, input, label')) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && item.contains(selection.anchorNode)) return; // user is selecting text
  openTafsir(s, a);
}

async function shareAyah(s, a) {
  const url = `${location.origin}${location.pathname}#${s}:${a}`;
  const name = state.current && state.current.meta ? state.current.meta.transliteration : '';
  const title = t('shareTitle', { name, key: `${s}:${a}` });
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('linkCopied', { url }));
  } catch {
    toast(t('copyFailed', { url }), 9000);
  }
}

function renderNotFound() {
  state.current = { view: 'notfound' };
  stopReadingObserver();
  dom.topTitle.textContent = '';
  document.title = t('docTitleHome');
  main().replaceChildren(
    el('section', { class: 'not-found' }, el('p', { class: 'notice', role: 'alert' }, t('notFound')), el('a', { class: 'btn primary', href: '#' }, t('backHome'))),
  );
  window.scrollTo(0, 0);
}

/* Remember the last ayah read (shown as "Continue" on the home page). */
let readObserver = null;
let readTimer = 0;
function startReadingObserver(s) {
  stopReadingObserver();
  if (!('IntersectionObserver' in window)) return;
  let latest = null;
  readObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) latest = Number(entry.target.dataset.ayah);
      });
      clearTimeout(readTimer);
      readTimer = setTimeout(() => {
        if (latest) writeStore(LAST_READ_KEY, { s, a: latest });
      }, 900);
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  document.querySelectorAll('.ayah').forEach((node) => readObserver.observe(node));
}

function stopReadingObserver() {
  if (readObserver) readObserver.disconnect();
  readObserver = null;
}

/* ------------------------------------------------------------------ */
/* Tafsir panel                                                        */
/* ------------------------------------------------------------------ */

const panel = {
  open: false,
  s: 0,
  a: 0,
  edition: 'en',
  token: 0,
  range: { from: 0, to: 0 },
  returnFocus: null,
};

function buildPanel() {
  const root = document.getElementById('tafsir');
  panel.root = root;
  panel.backdrop = document.getElementById('backdrop');
  panel.title = el('span', {});
  panel.sub = el('small', {});
  panel.closeButton = el('button', { class: 'icon-btn', type: 'button', onclick: () => closeTafsir() }, svgIcon(ICONS.close));
  panel.tabs = ['en', 'ar'].map((edition) =>
    el('button', { type: 'button', 'aria-pressed': 'false', dataset: { edition }, onclick: () => switchEdition(edition) }),
  );
  panel.tabGroup = el('div', { class: 'seg', role: 'group' }, ...panel.tabs);
  panel.ayah = el('p', { class: 'sheet-ayah', lang: 'ar', dir: 'rtl' });
  panel.notice = el('div', { class: 'sheet-notice' });
  panel.text = el('div', { class: 'tafsir-text' });
  panel.body = el('div', { class: 'sheet-body', tabindex: '-1' }, panel.ayah, panel.notice, panel.text);
  panel.source = el('p', { class: 'sheet-source' });
  panel.prevButton = el('button', { class: 'btn', type: 'button', onclick: () => goToPassage(panel.range.from - 1) });
  panel.nextButton = el('button', { class: 'btn', type: 'button', onclick: () => goToPassage(panel.range.to + 1) });

  root.replaceChildren(
    el(
      'div',
      { class: 'sheet-head' },
      el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
      el('div', { class: 'sheet-title-row' }, el('h2', { id: 'tafsir-title' }, panel.title, panel.sub), panel.closeButton),
      panel.tabGroup,
    ),
    panel.body,
    el('div', { class: 'sheet-foot' }, panel.source, el('div', { class: 'sheet-nav' }, panel.prevButton, panel.nextButton)),
  );
  panel.backdrop.addEventListener('click', () => closeTafsir());
  labelPanel();
}

function labelPanel() {
  panel.title.textContent = t('tafsirTitle');
  panel.closeButton.setAttribute('aria-label', t('close'));
  panel.closeButton.title = t('close');
  panel.tabGroup.setAttribute('aria-label', t('tafsirLang'));
  panel.tabs[0].textContent = t('tafsirEn');
  panel.tabs[1].textContent = t('tafsirAr');
  panel.prevButton.textContent = t('prevPassage');
  panel.nextButton.textContent = t('nextPassage');
}

function setPageInert(inert) {
  ['topbar', 'main', 'site-footer'].forEach((id) => {
    const node = document.getElementById(id);
    if (inert) node.setAttribute('inert', '');
    else node.removeAttribute('inert');
  });
}

function openTafsir(s, a, { push = true } = {}) {
  const current = state.current;
  if (!current || current.view !== 'surah' || current.s !== s || !current.ready) return;
  if (a < 1 || a > current.total) return;
  const wasOpen = panel.open;
  panel.s = s;
  panel.a = a;
  panel.edition = state.settings.tafsir;
  if (!wasOpen) {
    panel.returnFocus = document.activeElement;
    panel.root.hidden = false; // shown at once: Quran text is never animated
    panel.backdrop.hidden = false;
    panel.open = true;
    setPageInert(true);
    document.body.style.overflow = 'hidden';
    panel.closeButton.focus({ preventScroll: true });
    if (push) history.pushState({ tafsir: { s, a } }, '', location.href);
  } else {
    history.replaceState({ tafsir: { s, a } }, '', location.href);
  }
  writeStore(LAST_READ_KEY, { s, a });
  loadPanel();
}

function closeTafsir() {
  if (!panel.open) return;
  if (history.state && history.state.tafsir) history.back(); // popstate hides the panel
  else hidePanel();
}

function hidePanel({ restoreFocus = true } = {}) {
  if (!panel.open) return;
  panel.open = false;
  panel.token += 1;
  panel.root.hidden = true;
  panel.backdrop.hidden = true;
  setPageInert(false);
  document.body.style.overflow = '';
  markReading(0, -1);
  if (restoreFocus && panel.returnFocus && document.contains(panel.returnFocus)) {
    panel.returnFocus.focus({ preventScroll: true });
  }
}

function switchEdition(edition) {
  if (!TAFSIR.editions[edition] || edition === panel.edition) return;
  panel.edition = edition;
  state.settings.tafsir = edition; // remember the last choice
  saveSettings();
  loadPanel();
}

function goToPassage(a) {
  if (!state.current || a < 1 || a > state.current.total) return;
  panel.a = a;
  history.replaceState({ tafsir: { s: panel.s, a } }, '', location.href);
  const node = document.getElementById(`a-${a}`);
  if (node) node.scrollIntoView({ block: 'start' });
  writeStore(LAST_READ_KEY, { s: panel.s, a });
  loadPanel();
}

function markReading(from, to) {
  document.querySelectorAll('.ayah.is-reading').forEach((node) => node.classList.remove('is-reading'));
  for (let n = from; n <= to; n += 1) {
    const node = document.getElementById(`a-${n}`);
    if (node) node.classList.add('is-reading');
  }
}

function updatePanelNav() {
  const total = state.current ? state.current.total : 0;
  panel.prevButton.disabled = panel.range.from <= 1;
  panel.nextButton.disabled = panel.range.to >= total;
}

const isMostlyArabic = (text) => {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic > latin;
};

// A short line in Title Case with no final punctuation is shown in bold, as the
// section titles of the English edition are. The words are not changed.
const looksLikeHeading = (text) => {
  if (text.length > 72 || !/^[A-Z]/.test(text) || /[.,;:!?…"'”’)\]]$/.test(text) || /[؀-ۿ]/.test(text)) return false;
  const words = text.split(/\s+/).filter((word) => word.replace(/[^A-Za-z]/g, '').length > 3);
  if (!words.length) return false;
  const capitalised = words.filter((word) => /^[^A-Za-z]*[A-Z]/.test(word)).length;
  return capitalised / words.length >= 0.75;
};

// Shows the tafsir text exactly as received. Only the layout is decided here:
// paragraphs, direction of Arabic quotations, and a lighter tone for the
// editor's [[...]] notes in the Arabic edition.
function renderTafsirText(container, text, edition) {
  const isArabic = edition === 'ar';
  container.setAttribute('lang', isArabic ? 'ar' : 'en');
  container.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
  const fragment = document.createDocumentFragment();
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const p = document.createElement('p');
      if (isArabic) {
        line.split(/(\[\[[\s\S]*?\]\])/).forEach((piece) => {
          if (!piece) return;
          if (piece.startsWith('[[') && piece.endsWith(']]')) p.append(el('span', { class: 'tf-note' }, piece));
          else p.append(document.createTextNode(piece));
        });
      } else {
        p.textContent = line;
        if (isMostlyArabic(line)) {
          p.className = 'tf-ar';
          p.lang = 'ar';
          p.dir = 'rtl';
        } else {
          p.dir = 'auto';
          if (looksLikeHeading(line)) p.className = 'tf-head';
        }
      }
      fragment.append(p);
    });
  container.replaceChildren(fragment);
}

async function findPassageBefore(edition, s, a, token) {
  for (let n = a - 1; n >= 1 && a - n <= GROUP_SCAN_LIMIT; n -= 1) {
    if (token !== panel.token) return null;
    try {
      const { data, url } = await getTafsir(edition, s, n);
      if (data.text.trim()) return { text: data.text, url, start: n };
    } catch {
      return null;
    }
  }
  return null;
}

// The dataset repeats a passage on every ayah it covers. Neighbouring ayahs with
// the very same text (or an empty text after it) belong to the same passage.
async function detectRange(edition, s, start, text, token) {
  const total = state.current.total;
  let from = start;
  let to = start;
  const backward = (async () => {
    for (let n = start - 1; n >= 1 && start - n <= GROUP_SCAN_LIMIT; n -= 1) {
      if (token !== panel.token) return;
      try {
        const { data } = await getTafsir(edition, s, n);
        if (data.text !== text) return;
        from = n;
      } catch {
        return;
      }
    }
  })();
  const forward = (async () => {
    for (let n = start + 1; n <= total && n - start <= GROUP_SCAN_LIMIT; n += 1) {
      if (token !== panel.token) return;
      try {
        const { data } = await getTafsir(edition, s, n);
        if (data.text !== text && data.text.trim()) return;
        to = n;
      } catch {
        return;
      }
    }
  })();
  await Promise.all([backward, forward]);
  return { from, to };
}

function showPanelSource(url, edition) {
  const label = edition === 'ar' ? t('tafsirEditionAr') : t('tafsirEditionEn');
  const path = url.split('/tafsir/').pop();
  panel.source.replaceChildren(document.createTextNode(`${t('tafsirSource', { edition: label })} `), extLink(path, url));
}

async function loadPanel() {
  const { s, a, edition } = panel;
  const token = ++panel.token;
  const current = state.current;
  const key = `${s}:${a}`;

  panel.sub.textContent = `${current.meta.transliteration} ${key}`;
  panel.tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.edition === edition)));
  panel.ayah.textContent = current.verses[a - 1].text;
  panel.notice.replaceChildren();
  panel.text.replaceChildren(loadingView(t('loadingTafsir')));
  panel.source.replaceChildren();
  panel.range = { from: a, to: a };
  panel.body.scrollTop = 0;
  updatePanelNav();
  markReading(a, a);
  if (edition === 'ar') ensureArabicProseFont();

  try {
    const result = await getTafsir(edition, s, a);
    if (token !== panel.token) return;
    let { text } = result.data;
    let { url } = result;
    let start = a;
    let emptyHere = false;

    if (!text.trim()) {
      emptyHere = true;
      const found = await findPassageBefore(edition, s, a, token);
      if (token !== panel.token) return;
      if (!found) {
        panel.text.replaceChildren();
        panel.notice.replaceChildren(el('p', { class: 'notice' }, t('tafsirNone', { key })));
        showPanelSource(url, edition);
        return;
      }
      ({ text, url, start } = found);
    }

    renderTafsirText(panel.text, text, edition);
    showPanelSource(url, edition);

    const range = await detectRange(edition, s, start, text, token);
    if (token !== panel.token) return;
    panel.range = { from: Math.min(range.from, a), to: Math.max(range.to, a) };
    if (panel.range.from !== panel.range.to || emptyHere) {
      const vars = { from: `${s}:${panel.range.from}`, to: `${s}:${panel.range.to}` };
      panel.notice.replaceChildren(el('p', { class: 'notice' }, t(emptyHere ? 'tafsirGroupEmpty' : 'tafsirGroup', vars)));
    }
    markReading(panel.range.from, panel.range.to);
    updatePanelNav();
  } catch (error) {
    if (token !== panel.token) return;
    let message = t('tafsirUnreachable');
    if (error && error.kind === 'notfound') message = t('tafsirNone', { key });
    else if (error && error.kind === 'invalid') message = t('errInvalid');
    panel.text.replaceChildren();
    panel.notice.replaceChildren(errorView(error, error && error.kind === 'notfound' ? null : () => loadPanel(), message));
  }
}

/* ------------------------------------------------------------------ */
/* Settings dialog                                                     */
/* ------------------------------------------------------------------ */

let needsRerender = false;

function openSettings() {
  const dialog = document.getElementById('settings');
  dialog.replaceChildren(buildSettingsForm());
  needsRerender = false;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function radioGroup(name, legend, options, value, onChange) {
  return el(
    'fieldset',
    {},
    el('legend', {}, legend),
    el(
      'div',
      { class: 'choice-row' },
      ...options.map(([optionValue, label]) =>
        el(
          'label',
          { class: 'choice' },
          el('input', { type: 'radio', name, value: optionValue, checked: optionValue === value, onchange: () => onChange(optionValue) }),
          label,
        ),
      ),
    ),
  );
}

function rangeField(id, legend, min, max, value, onInput) {
  const output = el('output', { for: id }, `${value} px`);
  const input = el('input', {
    type: 'range',
    id,
    min: String(min),
    max: String(max),
    step: '1',
    value: String(value),
    oninput: (event) => {
      const n = Number(event.target.value);
      output.textContent = `${n} px`;
      onInput(n);
    },
  });
  return el('fieldset', {}, el('legend', {}, el('label', { for: id }, legend)), el('div', { class: 'range-row' }, input, output));
}

function buildSettingsForm() {
  const s = state.settings;
  const close = () => document.getElementById('settings').close();
  const update = (changes, { rerender = false } = {}) => {
    Object.assign(state.settings, changes);
    saveSettings();
    applySettings();
    if (rerender) needsRerender = true;
  };

  const checkbox = (key, label) =>
    el(
      'label',
      { class: 'choice' },
      el('input', { type: 'checkbox', checked: s[key], onchange: (event) => update({ [key]: event.target.checked }, { rerender: true }) }),
      label,
    );

  return el(
    'form',
    { method: 'dialog', class: 'settings-inner' },
    el(
      'div',
      { class: 'settings-head' },
      el('h2', { id: 'settings-title' }, t('settingsTitle')),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('close'), title: t('close'), onclick: close }, svgIcon(ICONS.close)),
    ),
    rangeField('ar-size', t('arSize'), 22, 46, s.arSize, (n) => update({ arSize: n })),
    rangeField('tr-size', t('trSize'), 14, 26, s.trSize, (n) => update({ trSize: n })),
    el('fieldset', {}, el('legend', {}, t('translations')), checkbox('showFr', t('trFr')), checkbox('showEn', t('trEn'))),
    radioGroup('tafsir', t('tafsirDefault'), [['en', t('tafsirEn')], ['ar', t('tafsirAr')]], s.tafsir, (v) => update({ tafsir: v })),
    radioGroup(
      'theme',
      t('theme'),
      [
        ['auto', t('themeAuto')],
        ['light', t('themeLight')],
        ['dark', t('themeDark')],
      ],
      s.theme,
      (v) => update({ theme: v }),
    ),
    radioGroup(
      'ui',
      t('uiLang'),
      [
        ['fr', 'Français'],
        ['en', 'English'],
      ],
      s.ui,
      (v) => update({ ui: v }, { rerender: true }),
    ),
    el('p', { class: 'settings-note' }, t('savedNote')),
  );
}

function onSettingsClosed() {
  if (!needsRerender) return;
  needsRerender = false;
  renderTopbar();
  renderFooter();
  labelPanel();
  rerenderKeepingPlace();
}

// Re-renders the current view and keeps the ayah that was at the top in place.
function rerenderKeepingPlace() {
  let anchor = null;
  let offset = 0;
  const barHeight = document.getElementById('topbar').getBoundingClientRect().height;
  for (const node of document.querySelectorAll('.ayah')) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom > barHeight + 4) {
      anchor = node.id;
      offset = rect.top;
      break;
    }
  }
  state.current = null;
  const token = ++state.routeToken;
  const target = parseHash(location.hash);
  const done = target.view === 'home' ? renderHome(token) : target.view === 'surah' ? renderSurah(target.s, target.a, token) : renderNotFound();
  Promise.resolve(done).then(() => {
    if (!anchor) return;
    const node = document.getElementById(anchor);
    if (node) window.scrollBy(0, node.getBoundingClientRect().top - offset);
  });
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  applySettings();
  renderTopbar();
  renderFooter();
  buildPanel();

  document.getElementById('skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    main().focus();
  });

  const dialog = document.getElementById('settings');
  dialog.addEventListener('close', onSettingsClosed);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // tap outside the sheet
  });

  window.addEventListener('hashchange', (event) => {
    try {
      const oldHash = new URL(event.oldURL).hash || '#';
      state.scrollMemory.set(oldHash, window.scrollY);
    } catch {
      /* ignore */
    }
    route();
  });

  window.addEventListener('popstate', (event) => {
    const saved = event.state && event.state.tafsir;
    if (saved && state.current && state.current.view === 'surah' && state.current.s === saved.s) {
      openTafsir(saved.s, saved.a, { push: false });
    } else if (panel.open) {
      hidePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.open) closeTafsir();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);

  route();
}

init();
