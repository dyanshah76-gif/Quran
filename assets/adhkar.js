// Adhkar: waking up, morning, day, evening, night and after the prayer.
//
// The texts come from data/adhkar/adhkar.json, built by tools/adhkar/build.py
// from pinned sources and copied unchanged (see data/adhkar/README.md). The
// Quran passages are downloaded at runtime from the same pinned source as the
// Quran reader. Nothing on this page is written from memory: every text shows
// where it comes from, and translations written for this page are labelled.

import { QURAN_JSON, TRANSLATIONS } from './sources.js';
import { METHODS, PARIS, periodAt, skyColors } from './sky.js';

const DATA_URL = 'data/adhkar/adhkar.json';
const SETTINGS_KEY = 'adhkar.settings.v1';
const PROGRESS_KEY = 'adhkar.progress.v1';
const QURAN_SETTINGS_KEY = 'quran.settings.v1';
const FETCH_TIMEOUT_MS = 15000;
const TABS = ['wake', 'morning', 'day', 'evening', 'night', 'prayer'];
const GROUPS = { wake: ['wake', 'wake_night'], night: ['night', 'bed', 'turning'], prayer: ['each', 'maghrib', 'fajr'] };
const ACCEPTED = /^(sahih|hasan)/i;
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const TAB_FOR_SEGMENT = { fajr: 'morning', morning: 'morning', day: 'day', evening: 'evening', dusk: 'evening', night: 'night' };

const STRINGS = {
  fr: {
    title: 'Adhkar',
    back: 'Coran',
    settings: 'Réglages',
    tabs: { wake: 'Réveil', morning: 'Matin', day: 'Journée', evening: 'Soir', night: 'Nuit', prayer: 'Après la prière' },
    heads: {
      wake: 'Adhkar du réveil',
      morning: 'Adhkar du matin',
      day: 'Dans la journée',
      evening: 'Adhkar du soir',
      night: 'Adhkar de la nuit',
      prayer: 'Après la prière',
    },
    groups: {
      wake: 'En se réveillant',
      wake_night: 'Si on se réveille dans la nuit',
      night: 'Pendant la nuit',
      bed: 'En se couchant',
      turning: 'En se retournant dans le lit',
      each: 'Après chaque prière obligatoire',
      maghrib: 'Après Maghrib',
      fajr: 'Après Fajr',
    },
    when: {
      wake: 'Au réveil',
      wake_night: 'Réveil dans la nuit',
      morning_evening: 'Matin et soir',
      morning: 'Le matin',
      evening: 'Le soir',
      day: 'Dans la journée',
      day_night: 'De jour et de nuit',
      night: 'Dans la nuit',
      bed: 'Au coucher',
      turning: 'En se retournant',
      after_fajr: 'Après le salam de Fajr',
      after_prayer: 'Après la prière',
      after_maghrib: 'Après Maghrib',
    },
    names: {
      imran_end: 'Fin de la sourate Âl ‘Imrân',
      ayat_kursi: 'Âyat al-Kursî',
      ayat_kursi_prayer: 'Âyat al-Kursî',
      ayat_kursi_bed: 'Âyat al-Kursî',
      muawwidhat: 'Al-Ikhlâs, al-Falaq, an-Nâs',
      muawwidhat_prayer: 'Al-Ikhlâs, al-Falaq, an-Nâs',
      muawwidhat_bed: 'Al-Ikhlâs, al-Falaq, an-Nâs',
      sayyid_istighfar: 'Sayyid al-istighfâr',
      tasbih_prayer: 'Tasbîh après la prière',
      tasbih_fatimah: 'Tasbîh du coucher',
      baqarah_end: 'Les deux derniers versets d’al-Baqarah',
      mulk_sajdah: 'As-Sajda et al-Mulk',
    },
    prayers: { fajr: 'Fajr', sunrise: 'Lever', dhuhr: 'Dhuhr', asr: '‘Asr', maghrib: 'Maghrib', isha: '‘Ishâ' },
    nextIn: (name, d) => `${name} dans ${d}`,
    sunriseIn: (d) => `Lever du soleil dans ${d}`,
    methods: { mwl: 'Ligue islamique mondiale (18°)', uoif: 'Musulmans de France (12°)', isna: 'ISNA (15°)' },
    hour: 'h',
    minute: 'min',
    hijriNote: 'Date hégirienne calculée (Umm al-Qura) : elle peut différer d’un jour de l’annonce officielle.',
    timesNote: (method, place) => `Horaires calculés pour ${place}, méthode ${method}. Vérifiez avec votre mosquée.`,
    paris: 'Paris',
    here: 'votre position',
    times: (n) => `${n} fois`,
    once: '1 fois',
    tapCount: 'Toucher pour compter',
    tapOnce: 'Je l’ai dit',
    done: 'Fait',
    undo: 'Annuler',
    proof: 'Preuve',
    hideProof: 'Fermer',
    whenProof: 'Les mots du hadith pour le moment',
    countProof: 'Les mots du hadith pour le nombre',
    aboutProof: 'Ce que dit le hadith',
    refs: 'Références',
    inSahih: 'dans le Sahih',
    albani: 'al-Albânî',
    albaniWords: 'Mots d’al-Albânî',
    grade: { sahih: 'Sahih', hasan: 'Hasan', 'hasan sahih': 'Hasan sahih', 'hasan isnaad': 'Chaîne hasan' },
    fullHadith: 'Hadith complet',
    explain: 'Explication (HadeethEnc)',
    englishOnly: 'Traduction disponible en anglais seulement :',
    excerpt: 'Extrait du hadith, tel que cité à la page indiquée.',
    hisn: (n) => `Hisn al-Muslim n° ${n}`,
    own: 'Texte tel qu’il est écrit dans Hisn al-Muslim.',
    mine: 'Traduction non officielle (Claude)',
    source: 'Source',
    progress: (a, b) => (a === b ? `${b} sur ${b}` : `Reste ${b - a} sur ${b}`),
    position: (i, n) => `${i} / ${n}`,
    translation: 'Traduction',
    open: 'Rouvrir',
    allDone: 'Tout est dit. Qu’Allah accepte.',
    reset: 'Recommencer cette liste',
    resetPrayer: 'Recommencer pour la prochaine prière',
    loading: 'Chargement…',
    errData: 'Les adhkar n’ont pas pu être chargés. Vérifiez la connexion.',
    errQuran: 'Le texte du Coran n’a pas pu être chargé.',
    retry: 'Réessayer',
    timing: 'Quand dire les adhkar du matin et du soir ?',
    timingHadith: 'Le hadith qui nomme les deux moments',
    read: (name) => `Lire la sourate ${name}`,
    footTitle: 'Comment cette page est faite',
    footRule:
      'Chaque dhikr est dans Sahih al-Bukhârî ou Sahih Muslim, ou a été jugé sahih ou hasan par al-Albânî. Son jugement est recopié en arabe sous chaque référence. L’ordre et les numéros sont ceux de Hisn al-Muslim ; le texte à dire est celui du hadith, mot pour mot.',
    footExcluded: 'Adhkar de Hisn al-Muslim laissés de côté (hadith jugé faible par al-Albânî)',
    footSources: 'Sources',
    footMine: 'Les lignes marquées « Traduction non officielle (Claude) » ont été écrites pour cette page, faute de traduction publiée. L’arabe reste la référence.',
    setLang: 'Langue',
    setMethod: 'Calcul des horaires',
    setPlace: 'Lieu',
    setPlaceParis: 'Paris',
    setPlaceHere: 'Ma position',
    setPlaceErr: 'Position indisponible : Paris est utilisé.',
    setSize: 'Taille de l’arabe',
    close: 'Fermer',
    install: 'Sur iPhone : Partager, puis « Sur l’écran d’accueil » pour l’avoir comme une app, même hors ligne.',
  },
  en: {
    title: 'Adhkar',
    back: 'Quran',
    settings: 'Settings',
    tabs: { wake: 'Waking', morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night', prayer: 'After prayer' },
    heads: {
      wake: 'Adhkar on waking up',
      morning: 'Morning adhkar',
      day: 'During the day',
      evening: 'Evening adhkar',
      night: 'Adhkar of the night',
      prayer: 'After the prayer',
    },
    groups: {
      wake: 'On waking up',
      wake_night: 'If you wake during the night',
      night: 'During the night',
      bed: 'When going to bed',
      turning: 'When turning over in bed',
      each: 'After every obligatory prayer',
      maghrib: 'After Maghrib',
      fajr: 'After Fajr',
    },
    when: {
      wake: 'On waking',
      wake_night: 'Waking at night',
      morning_evening: 'Morning and evening',
      morning: 'In the morning',
      evening: 'In the evening',
      day: 'During the day',
      day_night: 'By day and by night',
      night: 'At night',
      bed: 'At bedtime',
      turning: 'When turning over',
      after_fajr: 'After the salam of Fajr',
      after_prayer: 'After the prayer',
      after_maghrib: 'After Maghrib',
    },
    names: {
      imran_end: 'End of Surat Al ‘Imran',
      ayat_kursi: 'Ayat al-Kursi',
      ayat_kursi_prayer: 'Ayat al-Kursi',
      ayat_kursi_bed: 'Ayat al-Kursi',
      muawwidhat: 'Al-Ikhlas, al-Falaq, an-Nas',
      muawwidhat_prayer: 'Al-Ikhlas, al-Falaq, an-Nas',
      muawwidhat_bed: 'Al-Ikhlas, al-Falaq, an-Nas',
      sayyid_istighfar: 'Sayyid al-istighfar',
      tasbih_prayer: 'Tasbih after the prayer',
      tasbih_fatimah: 'Tasbih at bedtime',
      baqarah_end: 'The last two ayat of al-Baqarah',
      mulk_sajdah: 'As-Sajdah and al-Mulk',
    },
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: '‘Asr', maghrib: 'Maghrib', isha: '‘Isha' },
    nextIn: (name, d) => `${name} in ${d}`,
    sunriseIn: (d) => `Sunrise in ${d}`,
    methods: { mwl: 'Muslim World League (18°)', uoif: 'Musulmans de France (12°)', isna: 'ISNA (15°)' },
    hour: 'h',
    minute: 'min',
    hijriNote: 'Calculated Hijri date (Umm al-Qura): it can differ by a day from the official announcement.',
    timesNote: (method, place) => `Times calculated for ${place}, ${method} method. Check with your mosque.`,
    paris: 'Paris',
    here: 'your position',
    times: (n) => `${n} times`,
    once: 'Once',
    tapCount: 'Tap to count',
    tapOnce: 'I have said it',
    done: 'Done',
    undo: 'Undo',
    proof: 'Proof',
    hideProof: 'Close',
    whenProof: 'The words of the hadith for the time',
    countProof: 'The words of the hadith for the count',
    aboutProof: 'What the hadith says',
    refs: 'References',
    inSahih: 'in the Sahih',
    albani: 'al-Albani',
    albaniWords: "Al-Albani's words",
    grade: { sahih: 'Sahih', hasan: 'Hasan', 'hasan sahih': 'Hasan sahih', 'hasan isnaad': 'Hasan chain' },
    fullHadith: 'Full hadith',
    explain: 'Explanation (HadeethEnc)',
    englishOnly: '',
    excerpt: 'Excerpt of the hadith, as quoted on the linked page.',
    hisn: (n) => `Hisn al-Muslim no. ${n}`,
    own: 'Text as written in Hisn al-Muslim.',
    mine: 'Unofficial translation (Claude)',
    source: 'Source',
    progress: (a, b) => (a === b ? `${b} of ${b}` : `${b - a} left of ${b}`),
    position: (i, n) => `${i} / ${n}`,
    translation: 'Translation',
    open: 'Open again',
    allDone: 'All said. May Allah accept.',
    reset: 'Start this list again',
    resetPrayer: 'Start again for the next prayer',
    loading: 'Loading…',
    errData: 'The adhkar could not be loaded. Check the connection.',
    errQuran: 'The Quran text could not be loaded.',
    retry: 'Try again',
    timing: 'When to say the morning and evening adhkar?',
    timingHadith: 'The hadith that names the two times',
    read: (name) => `Read Surat ${name}`,
    footTitle: 'How this page is made',
    footRule:
      "Every dhikr is in Sahih al-Bukhari or Sahih Muslim, or was graded sahih or hasan by al-Albani. His ruling is copied in Arabic under each reference. The order and numbers are those of Hisn al-Muslim; the text to say is the hadith's, word for word.",
    footExcluded: 'Adhkar of Hisn al-Muslim left out (hadith graded weak by al-Albani)',
    footSources: 'Sources',
    footMine: 'Lines marked "Unofficial translation (Claude)" were written for this page because no published translation was found. The Arabic stays the reference.',
    setLang: 'Language',
    setMethod: 'Prayer time method',
    setPlace: 'Place',
    setPlaceParis: 'Paris',
    setPlaceHere: 'My position',
    setPlaceErr: 'Position unavailable: Paris is used.',
    setSize: 'Arabic size',
    close: 'Close',
    install: 'On iPhone: Share, then "Add to Home Screen" to keep it as an app, even offline.',
  },
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined && v !== false) node.dataset[k] = v;
    }
    else if (key === 'style') node.style.cssText = value;
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

function svg(markup) {
  const wrap = document.createElement('span');
  wrap.innerHTML = markup; // static markup written in this file, never data
  return wrap.firstElementChild;
}

const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></g></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H5V3"/><path d="M5.6 7A8 8 0 1 1 4 12"/></g></svg>',
  chevron: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

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
    /* private mode or storage full: the page still works, counts are not kept */
  }
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const colon = (label) => (document.documentElement.lang === 'fr' ? `${label} : ` : `${label}: `);

const state = {
  lang: 'fr',
  method: 'mwl',
  place: null, // null = Paris, or {lat, lng}
  arSize: 28,
  tab: 'morning',
  manualTab: false,
  data: null,
  period: null,
  progress: {},
  listToken: 0,
  clockOffset: 0,
};
const S = () => STRINGS[state.lang];
const now = () => new Date(Date.now() + state.clockOffset);

function initClock() {
  // Test hook: adhkar.html?now=2026-11-09T07:10 shows the page at that time.
  const fake = new URLSearchParams(location.search).get('now');
  const t = fake ? Date.parse(fake) : NaN;
  if (!Number.isNaN(t)) state.clockOffset = t - Date.now();
}

function loadSettings() {
  const a = readStore(SETTINGS_KEY) || {};
  const q = readStore(QURAN_SETTINGS_KEY) || {};
  const nav = (navigator.language || 'fr').slice(0, 2);
  state.lang = ['fr', 'en'].includes(a.lang) ? a.lang : ['fr', 'en'].includes(q.ui) ? q.ui : nav === 'en' ? 'en' : 'fr';
  state.method = METHODS[a.method] ? a.method : 'mwl';
  state.place = a.place && Number.isFinite(a.place.lat) && Number.isFinite(a.place.lng) ? { lat: a.place.lat, lng: a.place.lng } : null;
  state.arSize = Number.isFinite(a.arSize) ? Math.min(44, Math.max(22, a.arSize)) : 28;
}

function saveSettings() {
  writeStore(SETTINGS_KEY, { lang: state.lang, method: state.method, place: state.place, arSize: state.arSize });
}

/* ------------------------------------------------------------------ */
/* Loading and checking the data                                       */
/* ------------------------------------------------------------------ */

class SourceError extends Error {
  constructor(attempts) {
    super('source');
    this.attempts = attempts;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return { status: String(response.status) };
    return { data: await response.json() };
  } catch (error) {
    return { status: error && error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

// Tries each address in turn; only data that passes `validate` is accepted.
async function fetchVerified(urls, validate) {
  const attempts = [];
  for (const url of urls) {
    const { data, status } = await fetchJson(url);
    if (data !== undefined && validate(data)) return data;
    attempts.push({ url, status: data !== undefined ? 'invalid' : status });
  }
  throw new SourceError(attempts);
}

const isText = (v) => typeof v === 'string' && v.length > 0;
const isHttps = (v) => typeof v === 'string' && v.startsWith('https://');
const textObj = (v) => v && isText(v.text) && isText(v.src);
const validRef = (r) => r && isText(r.label) && isHttps(r.url) && isText(r.grade) && ACCEPTED.test(r.grade);

function validSeg(s) {
  if (!s) return false;
  if (s.basmala === true) return true;
  if (Array.isArray(s.quran)) return s.quran.length === 3 && s.quran.every(Number.isInteger);
  return isText(s.ar) && isText(s.src) && (s.n === undefined || (Number.isInteger(s.n) && s.n > 0));
}

// The page re-checks every dhikr before showing it: every reference must be
// sahih or hasan, every text must say where it comes from, and a count above
// one must come with the words of a hadith.
function validItem(it) {
  if (!it || !/^h\d+$/.test(it.id) || !Number.isInteger(it.hisn)) return false;
  if (!Array.isArray(it.tabs) || !it.tabs.length || !it.tabs.every((tab) => TABS.includes(tab))) return false;
  if (!Array.isArray(it.recite) || !it.recite.length || !it.recite.every(validSeg)) return false;
  if (it.reciteEvening && !(Array.isArray(it.reciteEvening) && it.reciteEvening.every(validSeg))) return false;
  const total = totalOf(it);
  if (!Number.isInteger(total) || total < 1) return false;
  if (total > 1 && !(it.countAr && isText(it.countAr.ar))) return false;
  if (it.meaning !== 'quran' && !(it.meaning && textObj(it.meaning.en) && textObj(it.meaning.fr))) return false;
  if (!Array.isArray(it.whenAr) || !it.whenAr.every((w) => isText(w.ar) && isText(w.src))) return false;
  if (!it.about || !textObj(it.about.en) || !textObj(it.about.fr)) return false;
  if (!it.hadith || !isText(it.hadith.ar) || !isHttps(it.hadith.url)) return false;
  if (!Array.isArray(it.refs) || !it.refs.length || !it.refs.every(validRef)) return false;
  return true;
}

const validData = (data) => data && data.version === 2 && Array.isArray(data.items) && data.items.length > 0 && data.srcs && data.sources && data.timing;

async function loadData() {
  const data = await fetchVerified([DATA_URL], validData);
  data.items = data.items.filter(validItem);
  return data;
}

const validChapter = (n) => (data) =>
  data &&
  data.id === n &&
  Number.isInteger(data.total_verses) &&
  Array.isArray(data.verses) &&
  data.verses.length === data.total_verses &&
  data.verses.every((v, i) => v && v.id === i + 1 && isText(v.text) && typeof v.translation === 'string');

const chapterCache = new Map();
function loadChapter(lang, n) {
  const key = `${lang}:${n}`;
  if (!chapterCache.has(key)) {
    const file = TRANSLATIONS[lang].file;
    const urls = QURAN_JSON.bases.map((base) => base + QURAN_JSON.chapterPath(file, n));
    chapterCache.set(
      key,
      fetchVerified(urls, validChapter(n)).catch((error) => {
        chapterCache.delete(key);
        throw error;
      }),
    );
  }
  return chapterCache.get(key);
}

/* ------------------------------------------------------------------ */
/* Sky, sun, moon and prayer times                                     */
/* ------------------------------------------------------------------ */

function computePeriod() {
  const place = state.place || PARIS;
  state.period = periodAt(now(), place.lat, place.lng, state.method, 1);
  return state.period;
}

// Fraction of the moon's disc that is lit and whether it is waxing, from the
// mean length of the lunar month. For the picture only, not for dates.
function moonPhase(date) {
  const age = (((date.getTime() / 86400000 - 10957.76) % 29.530588853) + 29.530588853) % 29.530588853;
  const f = age / 29.530588853;
  return { lit: (1 - Math.cos(2 * Math.PI * f)) / 2, waxing: f < 0.5 };
}

function moonPath(lit, waxing) {
  // Lit part of a disc of radius 20 centred on 24,24.
  const r = 20;
  const rx = Math.abs(1 - 2 * lit) * r;
  const outer = waxing ? 1 : 0;
  const inner = lit > 0.5 ? outer : 1 - outer;
  return `M24 4 A${r} ${r} 0 0 ${outer} 24 44 A${rx.toFixed(2)} ${r} 0 0 ${inner} 24 4Z`;
}

function applySky() {
  const p = computePeriod();
  const sky = skyColors(p.segment, p.t);
  const root = document.documentElement;
  sky.stops.forEach((color, i) => root.style.setProperty(`--sky${i}`, color));
  root.style.setProperty('--stars', sky.stars.toFixed(2));
  root.dataset.sky = sky.dark ? 'dark' : 'light';
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', sky.stops[0]);

  // The sun crosses the top of the page from sunrise to sunset, the moon from
  // sunset to sunrise.
  const orb = document.getElementById('orb');
  if (orb) {
    const t = now().getTime();
    const { sunrise, maghrib } = p.today;
    let f;
    let sun = false;
    if (t >= sunrise && t < maghrib) {
      sun = true;
      f = (t - sunrise) / (maghrib - sunrise);
    } else if (t >= maghrib) f = (t - maghrib) / (p.tomorrow.sunrise - maghrib);
    else f = (t - p.yesterday.maghrib) / (sunrise - p.yesterday.maghrib);
    f = Math.min(1, Math.max(0, f));
    orb.style.left = `${(8 + 84 * f).toFixed(1)}%`;
    orb.style.top = `${(150 - 118 * Math.sin(Math.PI * f)).toFixed(0)}px`;
    orb.dataset.kind = sun ? 'sun' : 'moon';
    if (sun) orb.replaceChildren();
    else {
      const m = moonPhase(now());
      orb.replaceChildren(svg(`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="moon-dark"/><path d="${moonPath(m.lit, m.waxing)}" class="moon-lit"/></svg>`));
    }
  }
  requestAnimationFrame(() => root.classList.add('sky-ready'));
}

function fmtTime(date) {
  return new Intl.DateTimeFormat(state.lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    date,
  );
}

function fmtDuration(ms) {
  const s = S();
  const total = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} ${s.minute}`;
  return m ? `${h} ${s.hour} ${String(m).padStart(2, '0')}` : `${h} ${s.hour}`;
}

function nextPrayer() {
  const p = state.period;
  const t = now().getTime();
  for (const key of PRAYERS) if (p.today[key] > t) return { key, at: p.today[key] };
  return { key: 'fajr', at: p.tomorrow.fajr };
}

function hijriDate() {
  // The Hijri day begins at Maghrib.
  const p = state.period;
  const d = new Date(now().getTime() + (now() >= p.today.maghrib ? 86400000 : 0));
  try {
    const locale = `${state.lang === 'fr' ? 'fr-FR' : 'en-GB'}-u-ca-islamic-umalqura`;
    const text = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return /\d{4}/.test(text) ? text : '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Evening and night adhkar said after midnight still belong to the day before.
function sessionKey(tab) {
  const d = now();
  const p = state.period;
  if ((tab === 'evening' || tab === 'night') && p && d < p.today.fajr) d.setDate(d.getDate() - 1);
  return `${dayKey(d)}:${tab}`;
}

function loadProgress() {
  const saved = readStore(PROGRESS_KEY) || {};
  const keep = {};
  const limit = dayKey(new Date(now().getTime() - 2 * 86400000));
  for (const [key, value] of Object.entries(saved)) if (key.slice(0, 10) >= limit && value && typeof value === 'object') keep[key] = value;
  state.progress = keep;
}

const getCount = (tab, id) => (state.progress[sessionKey(tab)] || {})[id] || 0;

function setCount(tab, id, value) {
  const key = sessionKey(tab);
  state.progress[key] = { ...(state.progress[key] || {}), [id]: value };
  writeStore(PROGRESS_KEY, state.progress);
}

function totalOf(it) {
  const steps = it.recite.filter((seg) => seg.ar && seg.n).map((seg) => seg.n);
  return steps.length ? steps.reduce((a, b) => a + b, 0) : it.count;
}

const itemsFor = (tab) => state.data.items.filter((it) => it.tabs.includes(tab));

function tabProgress(tab) {
  const items = itemsFor(tab);
  return { done: items.filter((it) => getCount(tab, it.id) >= totalOf(it)).length, total: items.length };
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function renderHero() {
  const s = S();
  const hero = document.getElementById('hero');
  const p = state.period;
  const next = nextPrayer();
  const name = s.prayers[next.key];
  const dur = fmtDuration(next.at - now());
  const dateText = new Intl.DateTimeFormat(state.lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now());
  const hijri = hijriDate();
  const place = state.place ? s.here : s.paris;

  const times = el(
    'ol',
    { class: 'times' },
    PRAYERS.map((key) =>
      el('li', { class: next.key === key ? 'next' : null }, el('span', { class: 'times-name' }, s.prayers[key]), el('span', { class: 'times-at' }, fmtTime(p.today[key]))),
    ),
  );

  hero.replaceChildren(
    el(
      'div',
      { class: 'bar' },
      el('a', { class: 'icon-btn', href: './', 'aria-label': s.back }, svg(ICONS.back), el('span', {}, s.back)),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': s.settings, onclick: openSettings }, svg(ICONS.settings)),
    ),
    el('h1', { id: 'hero-title' }, s.heads[state.tab]),
    el('p', { class: 'date' }, dateText.charAt(0).toUpperCase() + dateText.slice(1), hijri ? el('span', { class: 'hijri' }, hijri) : null),
    el(
      'details',
      { class: 'clock' },
      el('summary', {}, el('span', { class: 'clock-next' }, next.key === 'sunrise' ? s.sunriseIn(dur) : s.nextIn(name, dur)), el('span', { class: 'clock-at' }, fmtTime(next.at)), svg(ICONS.chevron)),
      times,
      el('p', { class: 'small' }, s.timesNote(s.methods[state.method], place)),
      hijri ? el('p', { class: 'small' }, s.hijriNote) : null,
    ),
  );
}

function renderTabs() {
  const s = S();
  const nav = document.getElementById('tabs');
  const suggested = TAB_FOR_SEGMENT[state.period.segment];
  nav.replaceChildren(
    el(
      'div',
      { class: 'pills', role: 'tablist' },
      TABS.map((tab) => {
        const { done, total } = tabProgress(tab);
        return el(
          'button',
          {
            class: 'pill',
            type: 'button',
            role: 'tab',
            id: `tab-${tab}`,
            'aria-selected': String(tab === state.tab),
            dataset: { tab, now: tab === suggested ? '1' : null, complete: total && done === total ? '1' : null },
            onclick: () => selectTab(tab, true),
          },
          s.tabs[tab],
          total && done === total ? svg(ICONS.check) : el('span', { class: 'pill-n' }, String(total - done)),
        );
      }),
    ),
    el('div', { class: 'progress', id: 'progress' }, el('div', { class: 'progress-track' }, el('div', { class: 'progress-fill' })), el('span', { class: 'progress-text' })),
  );
  const active = nav.querySelector('[aria-selected="true"]');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
}

/* ------------------------------------------------------------------ */
/* One dhikr                                                           */
/* ------------------------------------------------------------------ */

// The salawat sign is drawn from the Arabic font so it is readable.
function withSalawat(text) {
  const parts = String(text).split('ﷺ');
  const out = [];
  parts.forEach((part, i) => {
    if (i) out.push(el('span', { class: 'salawat', lang: 'ar' }, 'ﷺ'));
    out.push(part);
  });
  return out;
}

function srcNode(tag) {
  const s = S();
  if (tag === 'mine') return el('span', { class: 'src mine' }, s.mine);
  const info = state.data.srcs[tag];
  if (!info) return null;
  const url = typeof info.url === 'string' ? info.url : info.url && (info.url[state.lang] || info.url.ar || info.url.en);
  return el('span', { class: 'src' }, colon(s.source), isHttps(url) ? el('a', { href: url, target: '_blank', rel: 'noopener' }, info.label) : info.label);
}

const reciteFor = (it, tab) => (tab === 'evening' && it.reciteEvening ? it.reciteEvening : it.recite);
const meaningFor = (it, tab) => (tab === 'evening' && it.meaningEvening ? it.meaningEvening : it.meaning);
const gradeText = (grade) => S().grade[grade.toLowerCase()] || grade;

function renderRecite(it, tab, slots) {
  const box = el('div', { class: 'recite' });
  for (const seg of reciteFor(it, tab)) {
    if (seg.basmala) {
      const p = el('p', { class: 'quran basmala', lang: 'ar', dir: 'rtl' }, ' ');
      slots.push({ kind: 'basmala', seg: [1, 1, 1], text: p });
      box.append(p);
    } else if (seg.quran) {
      const cap = el('p', { class: 'cap' }, ' ');
      const p = el('p', { class: 'quran', lang: 'ar', dir: 'rtl' }, el('span', { class: 'loading-line' }, S().loading));
      slots.push({ kind: 'ar', seg: seg.quran, text: p, cap });
      box.append(cap, p);
    } else {
      box.append(
        el('p', { class: 'ar', lang: 'ar', dir: 'rtl', dataset: { n: seg.n ? String(seg.n) : null } }, seg.ar, seg.n && seg.n > 1 ? el('span', { class: 'ar-n', dir: 'ltr', lang: state.lang }, `×${seg.n}`) : null),
      );
    }
  }
  return box;
}

function renderMeaning(it, tab, slots) {
  const meaning = meaningFor(it, tab);
  const box = el('div', { class: 'meaning' });
  if (meaning === 'quran') {
    for (const seg of reciteFor(it, tab)) {
      if (!seg.quran) continue;
      const p = el('p', {}, ' ');
      slots.push({ kind: 'tr', seg: seg.quran, text: p });
      box.append(p);
    }
  } else {
    const m = meaning[state.lang];
    box.append(el('p', {}, withSalawat(m.text)));
    if (m.src === 'mine') box.append(srcNode('mine'));
  }
  return box;
}

function noteNode(note) {
  const t = note[state.lang];
  return el(
    'div',
    { class: 'note' },
    el('p', {}, el('strong', {}, colon(note.label[state.lang])), withSalawat(t.text)),
    note.ar ? el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, note.ar.ar) : null,
    note.ar ? srcNode(note.ar.src) : null,
    t.src === 'mine' ? srcNode('mine') : srcNode(t.src),
  );
}

const notesFor = (it, tab, face) => (it.notes || []).filter((n) => Boolean(n.face) === face && (!n.tabs || n.tabs.includes(tab)));

function refRow(ref) {
  const s = S();
  const by = ref.grader === 'sahihayn' ? s.inSahih : s.albani;
  return el(
    'li',
    {},
    el('a', { href: ref.url, target: '_blank', rel: 'noopener' }, ref.label),
    ' ',
    el('span', { class: 'badge' }, gradeText(ref.grade)),
    el('span', { class: 'by' }, ` ${by}`, ref.where ? `, ${ref.where}` : ''),
    ref.ruling ? el('p', { class: 'ruling' }, el('span', { class: 'by' }, colon(s.albaniWords)), el('span', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, ref.ruling)) : null,
  );
}

function renderProof(it, tab) {
  const s = S();
  const h = it.hadith;
  const about = it.about[state.lang];
  const tr = h[state.lang] || h.en;
  const explain = h[`${state.lang}Explain`];
  const own = reciteFor(it, tab).some((seg) => seg.own);
  const meaning = meaningFor(it, tab);
  const tr2 = TRANSLATIONS[state.lang];
  return el(
    'div',
    { class: 'proof' },
    meaning === 'quran'
      ? el('span', { class: 'src' }, colon(s.translation), el('a', { href: tr2.url, target: '_blank', rel: 'noopener' }, tr2.translator))
      : meaning[state.lang].src !== 'mine'
        ? el('span', { class: 'src' }, colon(s.translation), srcNode(meaning[state.lang].src).lastChild)
        : null,
    reciteFor(it, tab).filter((seg) => seg.ar).slice(0, 1).map((seg) => srcNode(seg.inside || seg.src)),
    el('h3', {}, s.whenProof),
    it.whenAr.map((w) => el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, `«${w.ar}»`)),
    srcNode(it.whenAr[0].src),
    it.countAr ? [el('h3', {}, s.countProof), el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, `«${it.countAr.ar}»`), srcNode(it.countAr.src)] : null,
    el('h3', {}, s.aboutProof),
    el('p', {}, withSalawat(about.text)),
    srcNode(about.src),
    notesFor(it, tab, false).map(noteNode),
    own ? el('p', { class: 'small' }, s.own) : null,
    el('h3', {}, s.refs),
    el('ul', { class: 'refs' }, it.refs.map(refRow)),
    el(
      'details',
      { class: 'full' },
      el('summary', {}, s.fullHadith, svg(ICONS.chevron)),
      h.excerpt ? el('p', { class: 'small' }, s.excerpt) : null,
      el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, h.ar),
      srcNode(h.arSrc),
      tr ? [!h[state.lang] && s.englishOnly ? el('p', { class: 'small' }, s.englishOnly) : null, el('p', { lang: h[state.lang] ? null : 'en' }, withSalawat(tr.text)), srcNode(tr.src)] : null,
      explain ? [el('h3', {}, s.explain), el('p', {}, withSalawat(explain.text)), srcNode(explain.src)] : null,
    ),
    el('p', { class: 'small' }, el('a', { href: it.hisnUrl, target: '_blank', rel: 'noopener' }, s.hisn(it.hisn))),
  );
}

function phaseAt(it, tab, count) {
  // Which phrase is being said, for adhkar counted phrase by phrase.
  const segs = reciteFor(it, tab).filter((seg) => seg.ar && seg.n);
  let before = 0;
  for (let i = 0; i < segs.length; i += 1) {
    if (count < before + segs[i].n) return { index: i, done: count - before, of: segs[i].n };
    before += segs[i].n;
  }
  return null;
}

function renderCard(it, tab, slots, position, count) {
  const s = S();
  const total = totalOf(it);
  const name = it.name ? s.names[it.name] : null;
  const steps = reciteFor(it, tab).filter((seg) => seg.ar && seg.n).map((seg) => seg.n);
  const first = it.refs[0];
  const more = it.refs.length - 1;
  const firstAr = reciteFor(it, tab).find((seg) => seg.ar);
  const short = firstAr ? `${firstAr.ar.split(' ').slice(0, 5).join(' ')}…` : '';

  const tapLabel = el('span', { class: 'tap-label' });
  const tapNum = el('span', { class: 'tap-num' });
  const tap = el('button', { class: 'tap', type: 'button' }, el('span', { class: 'tap-fill', 'aria-hidden': 'true' }), tapLabel, tapNum);
  const undo = el('button', { class: 'undo', type: 'button', 'aria-label': s.undo }, svg(ICONS.undo));
  const proofBtn = el(
    'button',
    { class: 'proof-btn', type: 'button', 'aria-expanded': 'false' },
    el('span', { class: 'badge' }, gradeText(first.grade)),
    el('span', { class: 'proof-ref' }, first.label, more > 0 ? ` +${more}` : ''),
    el('span', { class: 'proof-word' }, s.proof),
    svg(ICONS.chevron),
  );
  const proofBox = el('div', { class: 'proof-box', hidden: true });
  const recite = renderRecite(it, tab, slots);
  // Shown alone once the dhikr is said: the card folds to this line.
  const folded = el(
    'button',
    { class: 'folded', type: 'button', 'aria-label': s.open },
    svg(ICONS.check),
    name ? el('span', {}, name) : el('span', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, short),
  );

  const card = el(
    'article',
    { class: 'card', id: `d-${it.id}`, dataset: { id: it.id } },
    el(
      'header',
      { class: 'card-head' },
      el('span', { class: 'num' }, s.position(position, count)),
      el('span', { class: 'count' }, steps.length ? steps.join(' + ') : total === 1 ? s.once : s.times(total)),
      folded,
    ),
    el(
      'div',
      { class: 'card-body' },
      name ? el('h2', {}, name) : null,
      recite,
      renderMeaning(it, tab, slots),
      notesFor(it, tab, true).map(noteNode),
      it.surahs ? el('p', { class: 'links' }, it.surahs.map((n) => el('a', { class: 'chip', href: `./#${n}`, dataset: { surah: String(n) } }, s.read(n)))) : null,
      el('div', { class: 'tap-row' }, tap, undo),
      proofBtn,
      proofBox,
    ),
  );

  proofBtn.addEventListener('click', () => {
    const open = proofBox.hidden;
    if (open && !proofBox.firstChild) proofBox.append(renderProof(it, tab));
    proofBox.hidden = !open;
    proofBtn.setAttribute('aria-expanded', String(open));
  });
  folded.addEventListener('click', () => card.classList.toggle('open'));

  const paint = () => {
    const n = Math.min(total, getCount(tab, it.id));
    const done = n >= total;
    card.classList.toggle('done', done);
    if (!done) card.classList.remove('open');
    tap.style.setProperty('--fill', `${Math.round((n / total) * 100)}%`);
    tap.setAttribute('aria-pressed', String(done));
    tapLabel.replaceChildren(done ? svg(ICONS.check) : '', done ? s.done : total === 1 ? s.tapOnce : s.tapCount);
    tapNum.textContent = total === 1 ? '' : `${n} / ${total}`;
    undo.hidden = n === 0;
    const phase = done ? null : phaseAt(it, tab, n);
    recite.querySelectorAll('.ar[data-n]').forEach((p, i) => p.classList.toggle('now', Boolean(phase) && phase.index === i));
  };

  tap.addEventListener('click', () => {
    const n = getCount(tab, it.id);
    if (n >= total) return;
    setCount(tab, it.id, n + 1);
    if (n + 1 >= total) {
      if (navigator.vibrate) navigator.vibrate(30);
      paint();
      afterDone(card);
    } else paint();
    updateProgress();
  });
  undo.addEventListener('click', () => {
    const n = Math.min(total, getCount(tab, it.id));
    setCount(tab, it.id, total === 1 || n >= total ? 0 : n - 1);
    paint();
    updateProgress();
  });
  paint();
  return card;
}

// The card just said folds to one line; the next one comes up under the list bar.
function afterDone(card) {
  const next = [...document.querySelectorAll('.card:not(.done)')].find((c) => card.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (!next) return;
  const bar = document.getElementById('tabs').getBoundingClientRect().height;
  const y = next.getBoundingClientRect().top + window.scrollY - bar - 10;
  if (next.getBoundingClientRect().top < bar || next.getBoundingClientRect().top > window.innerHeight * 0.5) window.scrollTo({ top: y, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function updateProgress() {
  const s = S();
  const { done, total } = tabProgress(state.tab);
  const bar = document.getElementById('progress');
  if (bar) {
    bar.querySelector('.progress-fill').style.width = `${total ? (done / total) * 100 : 0}%`;
    bar.querySelector('.progress-text').textContent = s.progress(done, total);
  }
  const end = document.getElementById('list-end');
  if (end) end.classList.toggle('complete', total > 0 && done === total);
  const pill = document.getElementById(`tab-${state.tab}`);
  if (pill) {
    const complete = total > 0 && done === total;
    if (complete !== (pill.dataset.complete === '1')) {
      renderTabs();
      updateProgress();
    } else if (pill.querySelector('.pill-n')) pill.querySelector('.pill-n').textContent = String(total - done);
  }
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

function renderTiming() {
  const s = S();
  const t = state.data.timing;
  return el(
    'details',
    { class: 'timing panel' },
    el('summary', {}, s.timing, svg(ICONS.chevron)),
    el('p', { class: 'small' }, t.scholar.cite[state.lang], ' — «', el('span', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, t.scholar.title), '»'),
    t.scholar.quotes.map((q, i) => [
      el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, q.ar),
      el('p', {}, t.scholar[state.lang][i].text),
    ]),
    srcNode('mine'),
    el('p', { class: 'small' }, el('a', { href: t.scholar.url, target: '_blank', rel: 'noopener' }, 'shamela.ws/book/216')),
    el('h3', {}, s.timingHadith),
    t.hadith.ar.map((a) => el('p', { class: 'ar small-ar', lang: 'ar', dir: 'rtl' }, `«${a.ar}»`)),
    el('p', {}, t.hadith[state.lang].text),
    srcNode(t.hadith[state.lang].src),
    el('ul', { class: 'refs' }, refRow(t.hadith.ref)),
  );
}

function renderList() {
  const s = S();
  const main = document.getElementById('main');
  const tab = state.tab;
  const token = (state.listToken += 1);
  const slots = [];
  const items = itemsFor(tab);
  const nodes = [];
  const groups = GROUPS[tab];
  const ordered = groups ? groups.flatMap((group) => items.filter((it) => (tab === 'wake' ? it.when : it.group) === group)) : items;
  let lastGroup = null;
  ordered.forEach((it, i) => {
    const group = groups ? (tab === 'wake' ? it.when : it.group) : null;
    if (group && group !== lastGroup) nodes.push(el('h2', { class: 'group' }, s.groups[group]));
    lastGroup = group;
    nodes.push(renderCard(it, tab, slots, i + 1, ordered.length));
  });
  if (tab === 'morning' || tab === 'evening') nodes.push(renderTiming());

  nodes.push(
    el(
      'div',
      { class: 'list-end', id: 'list-end' },
      el('p', { class: 'all-done' }, s.allDone),
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            state.progress[sessionKey(tab)] = {};
            writeStore(PROGRESS_KEY, state.progress);
            renderTabs();
            renderList();
            window.scrollTo({ top: 0 });
          },
        },
        tab === 'prayer' ? s.resetPrayer : s.reset,
      ),
    ),
  );
  main.replaceChildren(...nodes);
  main.dataset.tab = tab;
  updateProgress();
  fillQuran(slots, token);
}

async function fillQuran(slots, token) {
  if (!slots.length) return;
  const s = S();
  const lang = state.lang;
  const needed = [...new Set(slots.map((slot) => slot.seg[0]))];
  let chapters;
  try {
    chapters = Object.fromEntries(await Promise.all(needed.map(async (n) => [n, await loadChapter(lang, n)])));
  } catch {
    if (token !== state.listToken) return;
    for (const slot of slots) {
      if (slot.kind === 'basmala') continue;
      slot.text.replaceChildren(el('span', { class: 'loading-line' }, s.errQuran, ' ', el('button', { class: 'btn', type: 'button', onclick: () => renderList() }, s.retry)));
    }
    return;
  }
  if (token !== state.listToken) return;
  for (const slot of slots) {
    const [n, from, to] = slot.seg;
    const chapter = chapters[n];
    const verses = chapter.verses.slice(from - 1, to);
    const range = from === to ? `${n}:${from}` : `${n}:${from}–${to}`;
    if (slot.kind === 'basmala') slot.text.textContent = verses[0].text;
    else if (slot.kind === 'ar') {
      slot.cap.textContent = `${chapter.transliteration} (${range})`;
      const nodes = [];
      verses.forEach((v) => nodes.push(v.text, ' ', el('span', { class: 'ayah-num', 'aria-hidden': 'true' }, toArabicDigits(v.id)), ' '));
      slot.text.replaceChildren(...nodes);
    } else {
      const nodes = [el('strong', {}, `${chapter.transliteration} (${range}) `)];
      verses.forEach((v) => nodes.push(verses.length > 1 ? el('span', { class: 'n' }, `${v.id} `) : '', v.translation, ' '));
      slot.text.replaceChildren(...nodes);
    }
  }
  document.querySelectorAll('a.chip[data-surah]').forEach(async (a) => {
    try {
      const chapter = await loadChapter(lang, Number(a.dataset.surah));
      a.textContent = s.read(chapter.transliteration);
    } catch {
      /* the number stays */
    }
  });
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function renderFoot() {
  const s = S();
  const d = state.data;
  const foot = document.getElementById('foot');
  const src = d.sources;
  const link = (label, url) => el('li', {}, el('a', { href: url, target: '_blank', rel: 'noopener' }, label));
  foot.replaceChildren(
    el(
      'details',
      { class: 'panel about' },
      el('summary', {}, s.footTitle, svg(ICONS.chevron)),
      el('p', {}, s.footRule),
      el('p', {}, s.footMine),
      el('h3', {}, s.footExcluded),
      el(
        'ul',
        { class: 'refs' },
        d.excluded.map((e) =>
          el(
            'li',
            {},
            el('a', { href: e.hisnUrl, target: '_blank', rel: 'noopener' }, s.hisn(e.hisn)),
            e.refs.map((r) => el('p', { class: 'ruling' }, el('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.label), ' ', el('span', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, r.ruling))),
            e.note ? el('p', { class: 'ruling' }, e.note[state.lang], ' ', el('a', { href: e.note.url, target: '_blank', rel: 'noopener' }, 'islamqa.info')) : null,
          ),
        ),
      ),
      el('h3', {}, s.footSources),
      el(
        'ul',
        { class: 'refs' },
        link(src.hisn.name, src.hisn.url),
        link(`${src.he.name} — ar ${src.he.versions.ar}, en ${src.he.versions.en}, fr ${src.he.versions.fr}`, src.he.url),
        link(`sunnah.com (${src.hadith.name})`, src.hadith.url),
        link(src.albani.name, src.albani.url),
        link(src.jami.name, src.jami.url),
        link(src.wabil.name, src.wabil.url),
        link(`Quran: ${QURAN_JSON.name} ${QURAN_JSON.version}`, QURAN_JSON.url),
      ),
    ),
    el('p', { class: 'small install' }, s.install),
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function openSettings() {
  const dialog = document.getElementById('settings');
  renderSettings(dialog);
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
}

function renderSettings(dialog) {
  const s = S();
  const choice = (name, options, current, onpick) =>
    el(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-label': name },
      options.map(([value, label]) =>
        el('button', { type: 'button', role: 'radio', 'aria-checked': String(value === current), dataset: { value }, onclick: () => onpick(value) }, label),
      ),
    );
  const refresh = () => {
    saveSettings();
    refreshTime(true);
    renderSettings(dialog);
  };
  const err = el('p', { class: 'small', role: 'status' });
  const sample = el('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
  dialog.replaceChildren(
    el('h2', { id: 'settings-title' }, s.settings),
    el('h3', {}, s.setLang),
    choice(s.setLang, [['fr', 'Français'], ['en', 'English']], state.lang, (v) => setLang(v, dialog)),
    el('h3', {}, s.setPlace),
    choice(s.setPlace, [['paris', s.setPlaceParis], ['here', s.setPlaceHere]], state.place ? 'here' : 'paris', (v) => {
      if (v === 'paris') {
        state.place = null;
        refresh();
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Rounded to about a kilometre and kept on this device only.
            state.place = { lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 };
            refresh();
          },
          () => (err.textContent = s.setPlaceErr),
          { maximumAge: 3600000, timeout: 10000 },
        );
      } else err.textContent = s.setPlaceErr;
    }),
    err,
    el('h3', {}, s.setMethod),
    choice(s.setMethod, Object.keys(METHODS).map((key) => [key, s.methods[key]]), state.method, (v) => {
      state.method = v;
      refresh();
    }),
    el('h3', {}, s.setSize),
    el('input', {
      type: 'range',
      min: '22',
      max: '44',
      step: '1',
      value: String(state.arSize),
      'aria-label': s.setSize,
      oninput: (e) => {
        state.arSize = Number(e.target.value);
        document.documentElement.style.setProperty('--ar', `${state.arSize}px`);
        saveSettings();
      },
    }),
    sample,
    el('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, s.close),
  );
}

function setLang(lang, dialog) {
  state.lang = lang;
  document.documentElement.lang = lang;
  saveSettings();
  document.title = `${S().title} — ${S().heads[state.tab]}`;
  renderHero();
  renderTabs();
  renderList();
  renderFoot();
  if (dialog) renderSettings(dialog);
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function selectTab(tab, manual) {
  if (!TABS.includes(tab)) return;
  state.tab = tab;
  if (manual) {
    state.manualTab = true;
    history.replaceState(null, '', `#${tab}`);
  }
  document.title = `${S().title} — ${S().heads[tab]}`;
  renderHero();
  renderTabs();
  renderList();
  if (manual) document.getElementById('tabs').scrollIntoView({ block: 'start' });
}

function refreshTime(force) {
  const before = state.period && state.period.segment;
  applySky();
  if (!state.data) return;
  renderHero();
  if (force || before !== state.period.segment) {
    if (!state.manualTab && !force) state.tab = TAB_FOR_SEGMENT[state.period.segment];
    renderTabs();
    if (!force) renderList();
  }
}

async function start() {
  initClock();
  loadSettings();
  document.documentElement.lang = state.lang;
  document.documentElement.style.setProperty('--ar', `${state.arSize}px`);
  applySky();
  loadProgress();
  const fromHash = location.hash.slice(1);
  state.tab = TABS.includes(fromHash) ? fromHash : TAB_FOR_SEGMENT[state.period.segment];
  state.manualTab = TABS.includes(fromHash);

  const main = document.getElementById('main');
  const load = async () => {
    main.replaceChildren(el('p', { class: 'notice' }, S().loading));
    try {
      state.data = await loadData();
    } catch {
      main.replaceChildren(el('p', { class: 'notice' }, S().errData, ' ', el('button', { class: 'btn', type: 'button', onclick: load }, S().retry)));
      return;
    }
    document.title = `${S().title} — ${S().heads[state.tab]}`;
    renderHero();
    renderTabs();
    renderList();
    renderFoot();
  };
  await load();

  setInterval(() => refreshTime(false), 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshTime(false);
  });
  window.addEventListener('hashchange', () => {
    const tab = location.hash.slice(1);
    if (TABS.includes(tab) && tab !== state.tab) selectTab(tab, true);
  });
  // The list picker gets a solid backing once it sticks to the top.
  const tabs = document.getElementById('tabs');
  const mark = el('div', { class: 'tabs-mark', 'aria-hidden': 'true' });
  tabs.before(mark);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => tabs.classList.toggle('stuck', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(mark);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
