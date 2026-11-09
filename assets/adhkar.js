// Adhkar of the morning, the day, the evening and the night.
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
const TABS = ['morning', 'day', 'evening', 'night'];
const GROUPS = ['night', 'bed', 'turning'];
const ACCEPTED = /^(sahih|hasan)/i;
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/* ------------------------------------------------------------------ */
/* Interface text                                                      */
/* ------------------------------------------------------------------ */

const STRINGS = {
  fr: {
    docTitle: 'Adhkar du matin, du soir et de la nuit',
    back: 'Coran',
    backLabel: 'Retour à la lecture du Coran',
    langLabel: 'Langue de la traduction',
    settings: 'Réglages',
    tabsLabel: 'Moment de la journée',
    tab: { morning: 'Matin', day: 'Journée', evening: 'Soir', night: 'Nuit' },
    title: { morning: 'Adhkar du matin', day: 'Adhkar de la journée', evening: 'Adhkar du soir', night: 'Adhkar de la nuit' },
    titleAr: { morning: 'أذكار الصباح', day: 'أذكار النهار', evening: 'أذكار المساء', night: 'أذكار الليل' },
    period: {
      fajr: 'Entre Fajr et le lever du soleil',
      morning: 'Entre le lever du soleil et Dhuhr',
      day: 'Entre Dhuhr et Asr',
      evening: 'Entre Asr et Maghrib',
      dusk: 'Entre Maghrib et Isha',
      night: 'Nuit, après Isha',
    },
    prayers: { fajr: 'Fajr', sunrise: 'Lever', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    placeParis: 'Paris',
    placeHere: 'Votre position',
    timesNote: (method, fajr) => `Calcul : ${method}, Fajr ${fajr}°`,
    progress: (done, total) => `${done}/${total}`,
    progressLabel: (done, total) => `${done} sur ${total} terminés`,
    rule: 'Ordre : Hisn al-Muslim. Ne sont gardés que les hadiths de Sahîh al-Bukhârî et de Sahîh Muslim, et ceux qu’al-Albânî a jugés sahih ou hasan.',
    timeInHadith: 'Le moment cité par le hadith',
    hadithTr: 'Traduction du hadith',
    dayIntro: 'Leurs hadiths donnent un nombre dans une journée, sans heure précise :',
    nightIntro: 'Trois moments, chacun d’après son hadith : dans la nuit, au coucher, et en se retournant la nuit.',
    movedToDay: 'Ces adhkar de ce chapitre de Hisn al-Muslim sont dans l’onglet Journée, car leurs hadiths disent :',
    openDay: 'Ouvrir l’onglet Journée',
    group: { night: 'Dans la nuit', bed: 'Au coucher', turning: 'En se retournant la nuit' },
    when: {
      morning_evening: 'Matin et soir',
      day_night: 'Le jour et la nuit',
      morning: 'Matin',
      after_fajr: 'Au salam de Fajr',
      evening: 'Soir',
      day: 'Dans la journée',
      night: 'Dans la nuit',
      bed: 'Au coucher',
      turning: 'En se retournant la nuit',
    },
    times: (n) => (n === 1 ? '1 fois' : `${n} fois`),
    names: {
      ayat_kursi: 'Âyat al-Kursî',
      muawwidhat: 'Al-Ikhlâs, al-Falaq et an-Nâs',
      sayyid_istighfar: 'Sayyid al-istighfâr',
      baqarah_end: 'Fin de la sourate al-Baqara',
      muawwidhat_bed: 'Al-Ikhlâs, al-Falaq et an-Nâs, dans les mains',
      ayat_kursi_bed: 'Âyat al-Kursî',
      tasbih_fatimah: 'Tasbîh : 33, 33 et 34',
      mulk_sajdah: 'As-Sajda et al-Mulk',
    },
    eveningWording: 'Formule du soir',
    arabic: 'Arabe',
    quranSrc: 'Coran, texte uthmani de QuranEnc.com',
    translation: 'Traduction',
    mine: 'Traduction non officielle (Claude)',
    trQuran: (name) => `Traduction : ${name} (Tanzil.net)`,
    hadith: 'Le hadith',
    excerpt: 'Extrait',
    confirm: 'Le Prophète ﷺ a dit :',
    practice: 'Comment :',
    virtue: 'Mérite de la sourate al-Mulk',
    countFrom: (n, label) => `Le nombre de ${n} fois vient de ${label}.`,
    countNote: 'Nombre :',
    hisnNote: 'Place dans Hisn al-Muslim :',
    eveningNote: 'Le soir :',
    muallaq: 'Al-Bukhârî cite ce hadith sans donner sa chaîne complète (mu‘allaq).',
    refs: 'Références',
    graders: { 'al-Albani': 'al-Albânî', sahihayn: '' },
    grades: { Sahih: 'Sahih', Hasan: 'Hasan', 'Hasan Sahih': 'Hasan sahih', 'Hasan Isnaad': 'Chaîne hasan', Daif: 'Faible (da‘îf)', Mawdu: 'Forgé (mawdû‘)' },
    full: 'Hadith complet et explication',
    fullExcerpt: 'Texte arabe et source',
    fullArabic: 'Texte arabe',
    fullTr: 'Traduction',
    noFr: 'Pas de traduction française publiée trouvée : voici la traduction anglaise.',
    explain: 'Explication',
    readSurah: (name, n) => `Lire ${name} (${n})`,
    surahNames: { 32: 'as-Sajda', 67: 'al-Mulk' },
    tapToCount: 'Toucher pour compter',
    markDone: 'Marquer comme fait',
    done: 'Fait',
    undo: 'Retirer un',
    countAria: (name, c, total) => `${name} : ${c} sur ${total}`,
    restart: 'Recommencer cette liste',
    restartConfirm: 'Toucher encore pour tout remettre à zéro',
    loading: 'Chargement des adhkar…',
    loadingQuran: 'Chargement du texte du Coran…',
    errData: 'Les adhkar n’ont pas pu être chargés. Vérifiez la connexion puis réessayez.',
    errQuran: 'Le texte du Coran n’a pas pu être chargé.',
    errTried: 'Adresses essayées',
    retry: 'Réessayer',
    skipped: (n) => `${n} dhikr n’a pas été affiché, car ses données n’ont pas passé la vérification.`,
    footSources: 'D’où viennent les textes',
    footHisn: 'Texte arabe, ordre et traduction anglaise : Hisn al-Muslim de Sa‘îd ibn Wahf al-Qahtânî, édition de hisnmuslim.com. Copie utilisée :',
    footHe: (v) => `Hadiths, traductions et explications : HadeethEnc.com, l’Encyclopédie des hadiths traduits, fichiers officiels version ${v.ar} (arabe), ${v.en} (anglais) et ${v.fr} (français).`,
    footHadith: 'Hadiths d’al-Bukhârî, Muslim, Abû Dâwud, at-Tirmidhî et Ibn Mâjah, traduction anglaise de sunnah.com, et jugements d’al-Albânî : fawazahmed0/hadith-api.',
    footExt: 'Hadiths hors de ces livres (an-Nasâ’î dans as-Sunan al-Kubrâ, al-Hâkim, Ahmad, Ibn as-Sunnî) : le jugement d’al-Albânî et l’ouvrage où il le donne sont indiqués sous chaque hadith, avec un lien pour vérifier.',
    footQuran: 'Coran : texte uthmani de QuranEnc.com ; traductions de Muhammad Hamidullah (français) et Saheeh International (anglais) par Tanzil.net ; fichiers quran-json 3.1.2.',
    footMine: 'Quand aucune traduction publiée n’a été trouvée, la traduction a été écrite pour cette page et porte la mention « Traduction non officielle (Claude) ». Le texte arabe reste la référence.',
    footTimes: 'Horaires de prière et couleurs du ciel : calculés sur votre téléphone à partir de la date et du lieu (méthode PrayTimes.org). Rien n’est envoyé.',
    footExcluded: 'Non repris',
    footExcludedLead: 'Ces adhkar du même chapitre de Hisn al-Muslim ne sont pas sur cette page, car al-Albânî les a jugés faibles :',
    settingsTitle: 'Réglages',
    lang: 'Langue',
    place: 'Lieu des horaires',
    useHere: 'Utiliser ma position',
    useParis: 'Revenir à Paris',
    locating: 'Recherche de la position…',
    locError: 'Position indisponible. Les horaires restent ceux de Paris.',
    placeHint: 'La position reste sur votre téléphone, arrondie à environ 1 km.',
    method: 'Méthode de calcul',
    methods: {
      mwl: 'Ligue islamique mondiale (18°, 17°)',
      uoif: 'UOIF, Musulmans de France (12°, 12°)',
      isna: 'ISNA (15°, 15°)',
    },
    methodHint: 'Les angles sont ceux de Fajr et de Isha. Choisissez la méthode de votre mosquée : son calendrier peut différer de quelques minutes.',
    methodShort: { mwl: 'Ligue islamique mondiale', uoif: 'UOIF', isna: 'ISNA' },
    asr: 'Asr',
    asrStd: 'Standard (shâfi‘ite, mâlikite, hanbalite)',
    asrHanafi: 'Hanafite',
    arSize: 'Taille du texte arabe',
    smaller: 'Plus petit',
    larger: 'Plus grand',
    close: 'Fermer',
  },
  en: {
    docTitle: 'Morning, evening and night adhkar',
    back: 'Quran',
    backLabel: 'Back to the Quran reader',
    langLabel: 'Translation language',
    settings: 'Settings',
    tabsLabel: 'Time of day',
    tab: { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' },
    title: { morning: 'Morning adhkar', day: 'Daytime adhkar', evening: 'Evening adhkar', night: 'Night adhkar' },
    titleAr: { morning: 'أذكار الصباح', day: 'أذكار النهار', evening: 'أذكار المساء', night: 'أذكار الليل' },
    period: {
      fajr: 'Between Fajr and sunrise',
      morning: 'Between sunrise and Dhuhr',
      day: 'Between Dhuhr and Asr',
      evening: 'Between Asr and Maghrib',
      dusk: 'Between Maghrib and Isha',
      night: 'Night, after Isha',
    },
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    placeParis: 'Paris',
    placeHere: 'Your location',
    timesNote: (method, fajr) => `Method: ${method}, Fajr ${fajr}°`,
    progress: (done, total) => `${done}/${total}`,
    progressLabel: (done, total) => `${done} of ${total} done`,
    rule: 'Order: Hisn al-Muslim. Only hadith from Sahih al-Bukhari and Sahih Muslim, and those al-Albani graded sahih or hasan, are kept.',
    timeInHadith: 'The time named in the hadith',
    hadithTr: 'Translation of the hadith',
    dayIntro: 'Their hadith give a number in a day, with no set hour:',
    nightIntro: 'Three times, each from its hadith: during the night, when going to bed, and when turning over at night.',
    movedToDay: 'These adhkar of this Hisn al-Muslim chapter are in the Day tab, because their hadith say:',
    openDay: 'Open the Day tab',
    group: { night: 'During the night', bed: 'When going to bed', turning: 'When turning over at night' },
    when: {
      morning_evening: 'Morning and evening',
      day_night: 'Day and night',
      morning: 'Morning',
      after_fajr: 'At the salam of Fajr',
      evening: 'Evening',
      day: 'In the day',
      night: 'During the night',
      bed: 'Going to bed',
      turning: 'Turning over at night',
    },
    times: (n) => (n === 1 ? 'Once' : `${n} times`),
    names: {
      ayat_kursi: 'Ayat al-Kursi',
      muawwidhat: 'Al-Ikhlas, al-Falaq and an-Nas',
      sayyid_istighfar: 'Sayyid al-istighfar',
      baqarah_end: 'End of Surat al-Baqarah',
      muawwidhat_bed: 'Al-Ikhlas, al-Falaq and an-Nas, into the hands',
      ayat_kursi_bed: 'Ayat al-Kursi',
      tasbih_fatimah: 'Tasbih: 33, 33 and 34',
      mulk_sajdah: 'As-Sajdah and al-Mulk',
    },
    eveningWording: 'Evening wording',
    arabic: 'Arabic',
    quranSrc: 'Quran, Uthmani text from QuranEnc.com',
    translation: 'Translation',
    mine: 'Unofficial translation (Claude)',
    trQuran: (name) => `Translation: ${name} (Tanzil.net)`,
    hadith: 'The hadith',
    excerpt: 'Excerpt',
    confirm: 'The Prophet ﷺ said:',
    practice: 'How:',
    virtue: 'Virtue of Surat al-Mulk',
    countFrom: (n, label) => `The count of ${n} comes from ${label}.`,
    countNote: 'Count:',
    hisnNote: 'Place in Hisn al-Muslim:',
    eveningNote: 'In the evening:',
    muallaq: 'Al-Bukhari quotes this hadith without giving his full chain (mu‘allaq).',
    refs: 'References',
    graders: { 'al-Albani': 'al-Albani', sahihayn: '' },
    grades: { Sahih: 'Sahih', Hasan: 'Hasan', 'Hasan Sahih': 'Hasan sahih', 'Hasan Isnaad': 'Hasan chain', Daif: 'Weak (da‘if)', Mawdu: 'Fabricated (mawdu‘)' },
    full: 'Full hadith and explanation',
    fullExcerpt: 'Arabic text and source',
    fullArabic: 'Arabic text',
    fullTr: 'Translation',
    noFr: '',
    explain: 'Explanation',
    readSurah: (name, n) => `Read ${name} (${n})`,
    surahNames: { 32: 'as-Sajdah', 67: 'al-Mulk' },
    tapToCount: 'Tap to count',
    markDone: 'Mark as done',
    done: 'Done',
    undo: 'Remove one',
    countAria: (name, c, total) => `${name}: ${c} of ${total}`,
    restart: 'Start this list again',
    restartConfirm: 'Tap again to clear the counts',
    loading: 'Loading the adhkar…',
    loadingQuran: 'Loading the Quran text…',
    errData: 'The adhkar could not be loaded. Check the connection and try again.',
    errQuran: 'The Quran text could not be loaded.',
    errTried: 'Addresses tried',
    retry: 'Try again',
    skipped: (n) => `${n} dhikr was not shown because its data failed the check.`,
    footSources: 'Where the texts come from',
    footHisn: "Arabic text, order and English translation: Hisn al-Muslim by Sa'id ibn Wahf al-Qahtani, hisnmuslim.com edition. Copy used:",
    footHe: (v) => `Hadith, translations and explanations: HadeethEnc.com, the Encyclopedia of Translated Prophetic Hadiths, official files version ${v.ar} (Arabic), ${v.en} (English) and ${v.fr} (French).`,
    footHadith: "Hadith from al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi and Ibn Majah, the sunnah.com English translation, and al-Albani's grades: fawazahmed0/hadith-api.",
    footExt: "Hadith outside these books (an-Nasa'i in as-Sunan al-Kubra, al-Hakim, Ahmad, Ibn as-Sunni): al-Albani's grade and the book where he gives it are shown under each hadith, with a link to check.",
    footQuran: 'Quran: Uthmani text from QuranEnc.com; Saheeh International (English) and Muhammad Hamidullah (French) translations from Tanzil.net; quran-json 3.1.2 files.',
    footMine: 'Where no published translation was found, the translation was written for this page and is marked "Unofficial translation (Claude)". The Arabic text is the reference.',
    footTimes: 'Prayer times and sky colours: calculated on your phone from the date and the place (PrayTimes.org method). Nothing is sent anywhere.',
    footExcluded: 'Left out',
    footExcludedLead: 'These adhkar from the same Hisn al-Muslim chapter are not on this page, because al-Albani graded them weak:',
    settingsTitle: 'Settings',
    lang: 'Language',
    place: 'Place for the times',
    useHere: 'Use my location',
    useParis: 'Back to Paris',
    locating: 'Finding your location…',
    locError: 'Location unavailable. The times stay those of Paris.',
    placeHint: 'Your location stays on your phone, rounded to about 1 km.',
    method: 'Calculation method',
    methods: {
      mwl: 'Muslim World League (18°, 17°)',
      uoif: 'UOIF, Musulmans de France (12°, 12°)',
      isna: 'ISNA (15°, 15°)',
    },
    methodHint: "The angles are those of Fajr and Isha. Pick your mosque's method: its timetable may differ by a few minutes.",
    methodShort: { mwl: 'Muslim World League', uoif: 'UOIF', isna: 'ISNA' },
    asr: 'Asr',
    asrStd: "Standard (Shafi'i, Maliki, Hanbali)",
    asrHanafi: 'Hanafi',
    arSize: 'Arabic text size',
    smaller: 'Smaller',
    larger: 'Larger',
    close: 'Close',
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
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

// "Label : " in French (no-break space before the colon), "Label: " in English.
const colon = (label) => (document.documentElement.lang === 'fr' ? `${label}\u00a0: ` : `${label}: `);

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  lang: 'fr',
  tab: 'morning',
  data: null,
  skipped: 0,
  settings: { method: 'mwl', asr: 1, place: null, arSize: 27 },
  period: null,
  progress: {},
  listToken: 0,
  clockOffset: 0,
};

const S = () => STRINGS[state.lang];

// For testing a time of day: adhkar.html?now=2026-11-09T07:10
function initClock() {
  const param = new URLSearchParams(location.search).get('now');
  if (!param) return;
  const wanted = new Date(param);
  if (!Number.isNaN(wanted.getTime())) state.clockOffset = wanted.getTime() - Date.now();
}
const clock = () => new Date(Date.now() + state.clockOffset);

function loadSettings() {
  const saved = readStore(SETTINGS_KEY) || {};
  const quran = readStore(QURAN_SETTINGS_KEY) || {};
  if (saved.lang === 'fr' || saved.lang === 'en') state.lang = saved.lang;
  else if (quran.ui === 'fr' || quran.ui === 'en') state.lang = quran.ui;
  else state.lang = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  if (METHODS[saved.method]) state.settings.method = saved.method;
  if (saved.asr === 1 || saved.asr === 2) state.settings.asr = saved.asr;
  if (saved.place && Number.isFinite(saved.place.lat) && Number.isFinite(saved.place.lng)) state.settings.place = saved.place;
  if (Number.isFinite(saved.arSize)) state.settings.arSize = Math.min(40, Math.max(20, saved.arSize));
}

function saveSettings() {
  writeStore(SETTINGS_KEY, { lang: state.lang, ...state.settings });
}

const coords = () => state.settings.place || PARIS;

/* ------------------------------------------------------------------ */
/* Loading: same-origin data, Quran from the pinned CDN addresses      */
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

function validRef(r) {
  return r && isText(r.label) && isHttps(r.url) && isText(r.grade) && ACCEPTED.test(r.grade);
}

// The page re-checks every dhikr before showing it: every reference must be
// sahih or hasan, and every text must say where it comes from.
function validItem(it) {
  if (!it || !/^h\d+$/.test(it.id) || !Number.isInteger(it.hisn)) return false;
  if (!Array.isArray(it.tabs) || !it.tabs.length || !it.tabs.every((tab) => TABS.includes(tab))) return false;
  const total = Array.isArray(it.count) ? it.count.reduce((a, b) => a + b, 0) : it.count;
  if (!Number.isInteger(total) || total < 1) return false;
  const segOk = (s) =>
    s && ((isText(s.ar) && isText(s.src)) || (Array.isArray(s.quran) && s.quran.length === 3 && s.quran.every(Number.isInteger)));
  if (!Array.isArray(it.recite) || !it.recite.length || !it.recite.every(segOk)) return false;
  if (it.reciteEvening && !(Array.isArray(it.reciteEvening) && it.reciteEvening.every(segOk))) return false;
  if (it.meaning !== 'quran' && !(it.meaning && textObj(it.meaning.en) && textObj(it.meaning.fr))) return false;
  if (!Array.isArray(it.whenAr) || !it.whenAr.every((w) => isText(w.ar) && isText(w.src))) return false;
  if (!it.about || !textObj(it.about.en) || !textObj(it.about.fr)) return false;
  if (!it.hadith || !isText(it.hadith.ar) || !isHttps(it.hadith.url)) return false;
  if (!Array.isArray(it.refs) || !it.refs.length || !it.refs.every(validRef)) return false;
  if (it.virtue && !validRef(it.virtue.ref)) return false;
  return true;
}

function validData(data) {
  return data && Array.isArray(data.items) && data.items.length > 0 && data.srcs && data.sources && data.times;
}

async function loadData() {
  const data = await fetchVerified([DATA_URL], validData);
  const items = data.items.filter(validItem);
  state.skipped = data.items.length - items.length;
  data.items = items;
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
/* Sky and prayer times                                                */
/* ------------------------------------------------------------------ */

const TAB_FOR_SEGMENT = { fajr: 'morning', morning: 'morning', day: 'day', evening: 'evening', dusk: 'evening', night: 'night' };
const SCALE = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const SCALE_FOR_SEGMENT = { fajr: 0, morning: 1, day: 2, evening: 3, dusk: 4, night: 5 };

function computePeriod() {
  const { lat, lng } = coords();
  state.period = periodAt(clock(), lat, lng, state.settings.method, state.settings.asr);
}

function applySky() {
  const { segment, t } = state.period;
  const sky = skyColors(segment, t);
  const root = document.documentElement;
  sky.stops.forEach((color, i) => root.style.setProperty(`--sky${i}`, color));
  root.style.setProperty('--stars', sky.stars.toFixed(2));
  root.dataset.sky = sky.dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', sky.stops[0]);
  if (!root.classList.contains('sky-ready')) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('sky-ready')));
}

function fmtTime(date) {
  return date.toLocaleTimeString(state.lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

// The "now" dot sits between the two prayer times around it. At night it
// moves from the Isha mark to the right edge until midnight, then from the
// left edge to the Fajr mark.
function scalePosition() {
  const { segment, t, start, end } = state.period;
  const step = 100 / 6;
  if (segment === 'night') {
    const now = clock();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateKey(start) === dateKey(now)) {
      const next = new Date(midnight.getTime() + 86400000);
      return { x: 5.5 * step + 0.5 * step * Math.min(1, (now - start) / (next - start)), moon: true };
    }
    return { x: 0.5 * step * Math.min(1, Math.max(0, (now - midnight) / (end - midnight))), moon: true };
  }
  return { x: (SCALE_FOR_SEGMENT[segment] + 0.5 + t) * step, moon: segment === 'dusk' && t > 0.5 };
}

// After midnight the night started yesterday: no mark of today is current.
function currentMark() {
  const { segment, start } = state.period;
  if (segment === 'night' && dateKey(start) !== dateKey(clock())) return -1;
  return SCALE_FOR_SEGMENT[segment];
}

function renderTimes(box) {
  const s = S();
  const p = state.period;
  const today = p.today;
  const marks = SCALE.map((key, i) => {
    const current = currentMark() === i;
    return el(
      'li',
      { class: current ? 'is-current' : null },
      el('span', { class: 'name' }, s.prayers[key]),
      el('span', { class: 'time' }, fmtTime(today[key])),
    );
  });
  const pos = scalePosition();
  const place = state.settings.place ? s.placeHere : s.placeParis;
  box.replaceChildren(
    el(
      'p',
      { class: 'now-line' },
      el('strong', {}, s.period[p.segment]),
      el('span', { class: 'place' }, `${place}, ${fmtTime(clock())}`),
    ),
    el(
      'div',
      { class: 'scale-wrap' },
      el('span', { class: `scale-now${pos.moon ? ' is-moon' : ''}`, style: `--x:${pos.x.toFixed(2)}%`, 'aria-hidden': 'true' }),
      el('ol', { class: 'scale' }, marks),
    ),
    el('p', { class: 'times-note' }, el('button', { class: 'link-btn', type: 'button', onclick: openSettings }, s.timesNote(s.methodShort[state.settings.method], METHODS[state.settings.method].fajr))),
  );
}

/* ------------------------------------------------------------------ */
/* Progress (per day and per list, kept in this browser only)          */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The evening and the night belong to the day they started: after midnight
// and before Fajr, they still count for the previous date.
function sessionKey(tab) {
  const now = clock();
  const day = new Date(now);
  if ((tab === 'evening' || tab === 'night') && now < state.period.today.fajr) day.setDate(day.getDate() - 1);
  return `${dateKey(day)}:${tab}`;
}

function loadProgress() {
  const saved = readStore(PROGRESS_KEY) || {};
  const keep = new Set();
  const now = clock();
  for (let back = 0; back < 3; back += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    keep.add(dateKey(d));
  }
  const progress = {};
  for (const [key, counts] of Object.entries(saved)) {
    if (keep.has(key.split(':')[0]) && counts && typeof counts === 'object') progress[key] = counts;
  }
  state.progress = progress;
  writeStore(PROGRESS_KEY, progress);
}

const totalOf = (it) => (Array.isArray(it.count) ? it.count.reduce((a, b) => a + b, 0) : it.count);

function getCount(tab, id) {
  const counts = state.progress[sessionKey(tab)];
  return counts && Number.isInteger(counts[id]) ? counts[id] : 0;
}

function setCount(tab, id, value) {
  const key = sessionKey(tab);
  state.progress[key] = { ...(state.progress[key] || {}), [id]: value };
  writeStore(PROGRESS_KEY, state.progress);
}

function itemsFor(tab) {
  return state.data ? state.data.items.filter((it) => it.tabs.includes(tab)) : [];
}

function tabProgress(tab) {
  const items = itemsFor(tab);
  const done = items.filter((it) => getCount(tab, it.id) >= totalOf(it)).length;
  return { done, total: items.length };
}

/* ------------------------------------------------------------------ */
/* Chrome: hero, tabs, footer                                          */
/* ------------------------------------------------------------------ */

const dom = {};

function renderHero() {
  const s = S();
  const hero = document.getElementById('hero');
  const langButtons = ['fr', 'en'].map((lang) =>
    el(
      'button',
      { type: 'button', lang, 'aria-pressed': String(state.lang === lang), onclick: () => setLang(lang) },
      lang.toUpperCase(),
    ),
  );
  dom.heroAr = el('p', { class: 'hero-ar', lang: 'ar', dir: 'rtl', 'aria-hidden': 'true' });
  dom.heroTitle = el('h1', { class: 'hero-title' });
  dom.times = el('section', { class: 'times', 'aria-live': 'off' });
  hero.replaceChildren(
    el(
      'div',
      { class: 'topnav' },
      el('a', { class: 'back', href: './', 'aria-label': s.backLabel }, svg(ICONS.back), el('span', {}, s.back)),
      el(
        'div',
        { class: 'topnav-end' },
        el('div', { class: 'lang-switch', role: 'group', 'aria-label': s.langLabel }, langButtons),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': s.settings, title: s.settings, 'aria-haspopup': 'dialog', onclick: openSettings }, svg(ICONS.settings)),
      ),
    ),
    dom.heroAr,
    dom.heroTitle,
    dom.times,
  );
  updateHeroTitle();
  renderTimes(dom.times);
}

function updateHeroTitle() {
  const s = S();
  dom.heroAr.textContent = s.titleAr[state.tab];
  dom.heroTitle.textContent = s.title[state.tab];
  document.title = `${s.title[state.tab]} · ${s.docTitle}`;
}

function renderTabs() {
  const s = S();
  const nav = document.getElementById('tabs');
  nav.setAttribute('aria-label', s.tabsLabel);
  dom.tabButtons = {};
  const list = el('div', { class: 'tablist', role: 'tablist' });
  for (const tab of TABS) {
    const progress = el('span', { class: 'progress' });
    const button = el(
      'button',
      {
        class: 'tab',
        type: 'button',
        role: 'tab',
        id: `tab-${tab}`,
        'aria-controls': 'main',
        'aria-selected': String(state.tab === tab),
        tabindex: state.tab === tab ? '0' : '-1',
        onclick: () => selectTab(tab, true),
        onkeydown: (event) => {
          const i = TABS.indexOf(tab);
          let next = null;
          if (event.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
          if (event.key === 'ArrowLeft') next = TABS[(i + TABS.length - 1) % TABS.length];
          if (next) {
            event.preventDefault();
            selectTab(next, true);
            dom.tabButtons[next].button.focus();
          }
        },
      },
      el('span', {}, s.tab[tab]),
      progress,
    );
    dom.tabButtons[tab] = { button, progress };
    list.append(button);
  }
  nav.replaceChildren(list);
  updateTabProgress();
}

function updateTabProgress() {
  if (!dom.tabButtons) return;
  const s = S();
  for (const tab of TABS) {
    const { button, progress } = dom.tabButtons[tab];
    if (!state.data) {
      progress.textContent = '';
      continue;
    }
    const { done, total } = tabProgress(tab);
    progress.textContent = s.progress(done, total);
    progress.setAttribute('aria-label', s.progressLabel(done, total));
    button.classList.toggle('is-complete', total > 0 && done === total);
  }
}

function watchStuckTabs() {
  const nav = document.getElementById('tabs');
  const sentinel = el('div', { 'aria-hidden': 'true', style: 'height:1px;margin-top:-1px' });
  nav.before(sentinel);
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting)).observe(sentinel);
}

/* ------------------------------------------------------------------ */
/* Source labels                                                       */
/* ------------------------------------------------------------------ */

// Interface strings write ﷺ; draw it with the Arabic font.
function withSalawat(text) {
  const parts = text.split('ﷺ');
  const out = [];
  parts.forEach((part, i) => {
    if (i) out.push(el('span', { class: 'salawat', lang: 'ar' }, 'ﷺ'));
    out.push(part);
  });
  return out;
}

function srcInfo(tag) {
  return (state.data && state.data.srcs[tag]) || null;
}

// "Translation: Sahih Muslim 2702a (sunnah.com)" with a link, or the
// unofficial label.
function srcLine(obj, { prefix, textLang } = {}) {
  const s = S();
  if (!obj) return null;
  if (obj.src === 'mine') return el('p', { class: 'src mine' }, s.mine);
  const info = srcInfo(obj.src);
  if (!info) return el('p', { class: 'src' }, obj.src);
  const lang = textLang || state.lang;
  let url = info.url;
  let label = info.label;
  if (obj.src.startsWith('he:')) {
    url = info.url[lang] || info.url.en || info.url.ar;
    label = `HadeethEnc.com, hadith ${obj.src.slice(3)} (v${state.data.sources.he.versions[lang === 'fr' ? 'fr' : 'en']})`;
  } else if (obj.src.startsWith('hisn:')) {
    url = info.enUrl;
    label = `${info.label}, hisnmuslim.com`;
  } else if (obj.src.startsWith('hadith:')) {
    label = `${info.label}, sunnah.com`;
  }
  return el('p', { class: 'src' }, prefix ? colon(prefix) : '', el('a', { href: url, target: '_blank', rel: 'noopener' }, label));
}

function trSrcLine(obj) {
  return srcLine(obj, { prefix: S().translation });
}

function gradeText(grade) {
  return S().grades[grade] || grade;
}

function refRow(ref) {
  const s = S();
  const grader = ref.grader in s.graders ? s.graders[ref.grader] : ref.grader;
  const by = [grader, ref.where].filter(Boolean).join(', ');
  return el(
    'li',
    {},
    el('a', { href: ref.url, target: '_blank', rel: 'noopener' }, ref.label),
    el('span', { class: 'grade' }, gradeText(ref.grade), by ? el('small', {}, by) : null),
  );
}

/* ------------------------------------------------------------------ */
/* One dhikr                                                           */
/* ------------------------------------------------------------------ */

function reciteFor(it, tab) {
  return tab === 'evening' && it.reciteEvening ? it.reciteEvening : it.recite;
}

function meaningFor(it, tab) {
  return tab === 'evening' && it.meaningEvening ? it.meaningEvening : it.meaning;
}

function nameOf(it) {
  return (it.name && S().names[it.name]) || `Hisn al-Muslim ${it.hisn}`;
}

function countLabel(it) {
  const s = S();
  if (Array.isArray(it.count)) return it.count.join(' + ');
  return s.times(it.count);
}

const stripMarks = (text) => (text || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();
const isBasmala = (text) => stripMarks(text) === 'بسم الله الرحمن الرحيم';

function renderRecite(it, tab, quranSlots) {
  const s = S();
  const segs = reciteFor(it, tab);
  const box = el('div', { class: 'recite' });
  const arSources = new Set();
  let hasQuran = false;
  segs.forEach((seg, i) => {
    if (seg.quran) {
      hasQuran = true;
      const cap = el('p', { class: 'surah-cap' });
      const text = el('p', { class: 'quran', lang: 'ar', dir: 'rtl' }, el('span', { class: 'loading-line' }, s.loadingQuran));
      // The basmala said before a surah belongs under the surah's name.
      const prev = box.lastElementChild;
      if (prev && i > 0 && isBasmala(segs[i - 1].ar)) prev.before(cap);
      else box.append(cap);
      box.append(text);
      quranSlots.push({ seg: seg.quran, cap, text, kind: 'ar' });
    } else {
      box.append(el('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, seg.ar));
      arSources.add(seg.src);
    }
  });
  const parts = [];
  for (const tag of arSources) {
    const info = srcInfo(tag);
    if (info) parts.push(el('a', { href: info.url, target: '_blank', rel: 'noopener' }, info.label));
  }
  if (hasQuran) parts.push(s.quranSrc);
  if (parts.length) {
    const line = el('p', { class: 'src' }, colon(s.arabic));
    parts.forEach((part, i) => {
      if (i) line.append(' ; ');
      line.append(part);
    });
    box.append(line);
  }
  return box;
}

function renderMeaning(it, tab, quranSlots) {
  const s = S();
  const meaning = meaningFor(it, tab);
  const box = el('div', { class: 'meaning' });
  if (meaning === 'quran') {
    for (const seg of reciteFor(it, tab)) {
      if (!seg.quran) continue;
      const p = el('p', { class: 'tr', lang: state.lang }, el('span', { class: 'loading-line' }, s.loadingQuran));
      box.append(p);
      quranSlots.push({ seg: seg.quran, text: p, kind: 'tr' });
    }
    box.append(el('p', { class: 'src' }, s.trQuran(TRANSLATIONS[state.lang].translator)));
    return box;
  }
  const tr = meaning[state.lang];
  box.append(el('p', { class: 'tr', lang: state.lang }, tr.text), trSrcLine(tr));
  return box;
}

function renderNotes(it, tab) {
  const s = S();
  const notes = [];
  const lang = state.lang;
  if (tab === 'evening' && it.eveningNote) {
    notes.push(
      el(
        'div',
        { class: 'note' },
        el('p', { style: 'margin:0' }, el('span', { class: 'label' }, s.eveningNote), ' ', it.eveningNote[lang].text),
        it.reciteEveningNote ? el('p', { class: 'quote-ar', lang: 'ar', dir: 'rtl' }, it.reciteEveningNote.ar) : null,
        srcLine(it.eveningNote[lang]),
      ),
    );
  }
  if (it.countNote) {
    notes.push(el('div', { class: 'note' }, el('p', { style: 'margin:0' }, el('span', { class: 'label' }, s.countNote), ' ', it.countNote[lang].text), srcLine(it.countNote[lang])));
  }
  if (it.hisnNote) {
    notes.push(el('div', { class: 'note' }, el('p', { style: 'margin:0' }, el('span', { class: 'label' }, s.hisnNote), ' ', it.hisnNote[lang].text), srcLine(it.hisnNote[lang])));
  }
  if (it.muallaq) {
    notes.push(el('div', { class: 'note' }, el('p', { style: 'margin:0' }, s.muallaq)));
  }
  return notes;
}

function renderProof(it) {
  const s = S();
  const lang = state.lang;
  const box = el('section', { class: 'proof', 'aria-label': s.hadith });
  box.append(el('h4', { class: 'proof-title' }, s.hadith));
  for (const w of it.whenAr) box.append(el('p', { class: 'when-ar', lang: 'ar', dir: 'rtl' }, `«${w.ar}»`));
  box.append(el('p', { class: 'about', lang }, it.about[lang].text), srcLine(it.about[lang]));

  if (it.confirm) {
    box.append(
      el('div', { class: 'extra' }, el('p', { class: 'label' }, withSalawat(s.confirm)), el('p', { class: 'about', lang }, it.confirm[lang].text), srcLine(it.confirm[lang])),
    );
  }
  if (it.practice) {
    box.append(
      el('div', { class: 'extra' }, el('p', { class: 'label' }, s.practice), el('p', { class: 'about', lang }, it.practice[lang].text), srcLine(it.practice[lang])),
    );
  }
  if (it.countSource) {
    const info = srcInfo(it.countSource.src);
    const label = info ? info.label : it.countSource.src;
    const n = totalOf(it);
    if (lang === 'en') {
      box.append(el('div', { class: 'extra' }, el('p', { class: 'label' }, s.countFrom(n, label)), el('p', { class: 'about', lang: 'en' }, it.countSource.text), srcLine(it.countSource)));
    } else {
      box.append(el('div', { class: 'extra' }, el('p', { class: 'label' }, s.countFrom(n, label))));
    }
  }
  if (it.virtue) {
    box.append(
      el(
        'div',
        { class: 'extra' },
        el('p', { class: 'label' }, s.virtue),
        el('p', { class: 'about', lang }, it.virtue[lang].text),
        srcLine(it.virtue[lang]),
        el('ul', { class: 'refs' }, refRow(it.virtue.ref)),
      ),
    );
  }

  box.append(el('ul', { class: 'refs', 'aria-label': s.refs }, it.refs.map(refRow)));
  box.append(renderFull(it));
  return box;
}

function renderFull(it) {
  const s = S();
  const lang = state.lang;
  const h = it.hadith;
  const details = el('details', { class: 'full' });
  details.append(el('summary', {}, h.excerpt ? s.fullExcerpt : s.full));
  const arInfo = srcInfo(h.arSrc);
  details.append(
    el('h4', {}, h.excerpt ? `${s.fullArabic} (${s.excerpt.toLowerCase()})` : s.fullArabic),
    el('p', { class: 'hadith-ar', lang: 'ar', dir: 'rtl' }, h.ar),
    el('p', { class: 'src' }, el('a', { href: h.url, target: '_blank', rel: 'noopener' }, arInfo ? arInfo.label : h.url)),
  );
  // A French reader gets the English text when no French one was published.
  const trLang = h[lang] ? lang : 'en';
  const tr = h[trLang];
  if (tr) {
    details.append(el('h4', {}, s.fullTr));
    if (trLang !== lang && s.noFr) details.append(el('p', { class: 'src' }, s.noFr));
    details.append(el('p', { class: 'hadith-tr', lang: trLang }, tr.text), srcLine(tr, { textLang: trLang }));
  }
  const explain = h[`${trLang}Explain`];
  if (explain) {
    details.append(el('h4', {}, s.explain), el('p', { class: 'hadith-tr', lang: trLang }, explain.text), srcLine(explain, { textLang: trLang }));
  }
  return details;
}

function renderReadLinks(it) {
  if (!Array.isArray(it.surahs)) return null;
  const s = S();
  return el(
    'div',
    { class: 'read-links' },
    it.surahs.map((n) => el('a', { class: 'pill-link', href: `./#${n}` }, s.readSurah(s.surahNames[n] || `${n}`, n))),
  );
}

// Tasbih phrases for the counter, cut from the Hisn al-Muslim text itself:
// «سبحان الله (ثلاثاً وثلاثين) والحمد لله (…) والله أكبر (…)».
function phasesOf(it) {
  if (!Array.isArray(it.count)) return null;
  const phrases = it.recite[0].ar
    .split(/\s*\([^)]*\)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (phrases.length !== it.count.length) return null;
  return phrases.map((phrase, i) => ({ phrase, n: it.count[i] }));
}

function renderCounter(it, tab, article) {
  const s = S();
  const total = totalOf(it);
  const phases = phasesOf(it);
  const name = nameOf(it);
  const tap = el('button', { class: 'tap', type: 'button' });
  const undo = el('button', { class: 'undo', type: 'button', 'aria-label': s.undo, title: s.undo }, svg(ICONS.undo));

  const paint = () => {
    const c = getCount(tab, it.id);
    const done = c >= total;
    tap.classList.toggle('is-done', done);
    tap.style.setProperty('--p', String(Math.min(1, c / total)));
    let label;
    let number;
    if (done) {
      label = el('span', {}, s.done);
      number = el('span', { class: 'n' }, total > 1 ? `${total}/${total}` : '', ' ', svg(ICONS.check));
    } else if (phases) {
      let left = c;
      let k = 0;
      while (k < phases.length - 1 && left >= phases[k].n) {
        left -= phases[k].n;
        k += 1;
      }
      label = el('span', { class: 'phrase', lang: 'ar', dir: 'rtl' }, phases[k].phrase);
      number = el('span', { class: 'n' }, `${left}/${phases[k].n}`);
    } else if (total === 1) {
      label = el('span', {}, s.markDone);
      number = el('span', { class: 'n' }, '');
    } else {
      label = el('span', {}, s.tapToCount);
      number = el('span', { class: 'n' }, `${c}/${total}`);
    }
    tap.replaceChildren(label, number);
    tap.setAttribute('aria-label', s.countAria(name, c, total));
    undo.disabled = c === 0;
    const check = article.querySelector('.check');
    if (check) check.hidden = !done;
    article.classList.toggle('is-done', done);
  };

  tap.addEventListener('click', () => {
    const c = getCount(tab, it.id);
    if (c >= total) return;
    setCount(tab, it.id, c + 1);
    paint();
    updateTabProgress();
    if (c + 1 >= total) advanceFrom(article);
  });
  undo.addEventListener('click', () => {
    const c = getCount(tab, it.id);
    if (c <= 0) return;
    setCount(tab, it.id, c - 1);
    paint();
    updateTabProgress();
  });
  return { row: el('div', { class: 'count-row' }, tap, undo), paint };
}

// After a dhikr is finished, bring the next unfinished one into view.
function advanceFrom(article) {
  const all = [...document.querySelectorAll('#main .dhikr')];
  const next = all.slice(all.indexOf(article) + 1).find((node) => !node.classList.contains('is-done'));
  if (!next) return;
  setTimeout(() => next.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }), 350);
}

function renderItem(it, tab, quranSlots) {
  const s = S();
  const article = el('article', { class: 'dhikr', id: `${tab}-${it.id}`, 'aria-labelledby': `${tab}-${it.id}-title` });
  const named = Boolean(it.name && s.names[it.name]);
  const check = el('span', { class: 'check', hidden: true }, svg(ICONS.check));
  const title = named
    ? el('h3', { class: 'dhikr-name', id: `${tab}-${it.id}-title` }, nameOf(it), check)
    : el('h3', { class: 'visually-hidden', id: `${tab}-${it.id}-title` }, nameOf(it));
  const chips = el(
    'p',
    { class: 'chips', style: 'margin:0' },
    el('span', { class: 'chip count' }, countLabel(it)),
    el('span', { class: 'chip' }, s.when[it.when] || it.when),
    tab === 'evening' && it.reciteEvening ? el('span', { class: 'chip' }, s.eveningWording) : null,
    named ? null : el('span', { class: 'hisn-only' }, check),
  );
  const counter = renderCounter(it, tab, article);
  const parts = [
    el(
      'header',
      { class: 'dhikr-head' },
      el('div', {}, title, chips),
      el('a', { class: 'hisn-link', href: it.hisnUrl, target: '_blank', rel: 'noopener' }, `Hisn ${it.hisn}`),
    ),
    renderRecite(it, tab, quranSlots),
    renderMeaning(it, tab, quranSlots),
    renderReadLinks(it),
    ...renderNotes(it, tab),
    renderProof(it),
    counter.row,
  ];
  article.append(...parts.filter(Boolean));
  counter.paint();
  return article;
}

/* ------------------------------------------------------------------ */
/* The list for one tab                                                */
/* ------------------------------------------------------------------ */

function timesIntro(index) {
  const s = S();
  const times = state.data.times;
  const lang = state.lang;
  return el(
    'section',
    { class: 'panel' },
    el('p', { class: 'rule' }, s.rule),
    el('p', { style: 'margin:10px 0 0;font-weight:650' }, s.timeInHadith),
    el('p', { class: 'quote-ar', lang: 'ar', dir: 'rtl' }, `«${times.ar[index].ar}»`),
    el('ul', { class: 'refs' }, refRow(times.ref)),
    el('details', { class: 'full' }, el('summary', {}, s.hadithTr), el('p', { class: 'about', lang }, times[lang].text), srcLine(times[lang])),
  );
}

function dayIntro() {
  const s = S();
  const items = itemsFor('day');
  return el(
    'section',
    { class: 'panel' },
    el('p', { class: 'rule' }, s.rule),
    el('p', { style: 'margin:10px 0 0' }, s.dayIntro),
    items.map((it) => el('p', { class: 'quote-ar', lang: 'ar', dir: 'rtl' }, `«${it.whenAr[0].ar}»`)),
  );
}

function nightIntro() {
  const s = S();
  return el('section', { class: 'panel' }, el('p', { class: 'rule' }, s.rule), el('p', { style: 'margin:10px 0 0' }, s.nightIntro));
}

// Morning and evening: say where Hisn al-Muslim's "in a day" adhkar went.
function movedNote() {
  const s = S();
  const moved = itemsFor('day').filter((it) => it.hisn >= 75 && it.hisn <= 98);
  if (!moved.length) return null;
  return el(
    'section',
    { class: 'panel' },
    el('p', {}, s.movedToDay),
    moved.map((it) => [
      el('p', { class: 'quote-ar', lang: 'ar', dir: 'rtl' }, `«${it.whenAr[0].ar}»`),
      el('p', { class: 'moved-ref' }, el('a', { href: it.hisnUrl, target: '_blank', rel: 'noopener' }, `Hisn al-Muslim ${it.hisn}`)),
    ]),
    el('p', {}, el('button', { class: 'btn', type: 'button', onclick: () => selectTab('day', true, true) }, s.openDay)),
  );
}

function listEnd(tab) {
  const s = S();
  const button = el('button', { class: 'text-btn', type: 'button' }, s.restart);
  let armed = false;
  let timer = 0;
  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      button.textContent = s.restartConfirm;
      button.classList.add('is-confirm');
      timer = setTimeout(() => {
        armed = false;
        button.textContent = s.restart;
        button.classList.remove('is-confirm');
      }, 4000);
      return;
    }
    clearTimeout(timer);
    delete state.progress[sessionKey(tab)];
    writeStore(PROGRESS_KEY, state.progress);
    renderList();
    updateTabProgress();
  });
  return el('div', { class: 'list-end' }, button);
}

function renderList() {
  const s = S();
  const main = document.getElementById('main');
  const token = ++state.listToken;
  const tab = state.tab;
  if (!state.data) return;
  const items = itemsFor(tab);
  const quranSlots = [];
  const nodes = [];

  if (state.skipped) nodes.push(el('p', { class: 'notice', role: 'status' }, s.skipped(state.skipped)));
  if (tab === 'morning') nodes.push(timesIntro(0));
  if (tab === 'evening') nodes.push(timesIntro(1));
  if (tab === 'day') nodes.push(dayIntro());
  if (tab === 'night') nodes.push(nightIntro());

  if (tab === 'night') {
    for (const group of GROUPS) {
      const groupItems = items.filter((it) => it.group === group);
      if (!groupItems.length) continue;
      nodes.push(el('h2', { class: 'panel panel-title', id: `group-${group}` }, s.group[group]));
      for (const it of groupItems) nodes.push(renderItem(it, tab, quranSlots));
    }
  } else {
    for (const it of items) nodes.push(renderItem(it, tab, quranSlots));
  }
  if (tab === 'morning' || tab === 'evening') {
    const note = movedNote();
    if (note) nodes.push(note);
  }
  nodes.push(listEnd(tab));
  main.replaceChildren(...nodes);
  fillQuran(quranSlots, token);
}

async function fillQuran(slots, token) {
  if (!slots.length) return;
  const s = S();
  const lang = state.lang;
  const needed = [...new Set(slots.map((slot) => slot.seg[0]))];
  let chapters;
  try {
    chapters = Object.fromEntries(await Promise.all(needed.map(async (n) => [n, await loadChapter(lang, n)])));
  } catch (error) {
    if (token !== state.listToken) return;
    for (const slot of slots) {
      const box = el('span', { class: 'loading-line' }, s.errQuran, ' ', el('button', { class: 'btn', type: 'button', onclick: () => renderList() }, s.retry));
      slot.text.replaceChildren(box);
    }
    return;
  }
  if (token !== state.listToken) return;
  for (const slot of slots) {
    const [n, from, to] = slot.seg;
    const chapter = chapters[n];
    const verses = chapter.verses.slice(from - 1, to);
    const range = from === to ? `${n}:${from}` : `${n}:${from}–${to}`;
    if (slot.kind === 'ar') {
      if (slot.cap) slot.cap.textContent = `${chapter.transliteration} (${range})`;
      const nodes = [];
      verses.forEach((v) => nodes.push(v.text, ' ', el('span', { class: 'ayah-num', 'aria-hidden': 'true' }, toArabicDigits(v.id)), ' '));
      slot.text.replaceChildren(...nodes);
    } else {
      const nodes = [el('strong', {}, `${chapter.transliteration} (${range}) `)];
      verses.forEach((v) => nodes.push(verses.length > 1 ? el('span', { class: 'n' }, `${v.id} `) : '', v.translation, ' '));
      slot.text.replaceChildren(...nodes);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function renderFoot() {
  const s = S();
  const foot = document.getElementById('foot');
  if (!state.data) {
    foot.replaceChildren();
    return;
  }
  const src = state.data.sources;
  const link = (text, url) => el('a', { href: url, target: '_blank', rel: 'noopener' }, text);
  const hisnCopy = src.hisn.copy.replace('https://github.com/', '').replace('/tree/', ' @ ').slice(0, 60);
  const lang = state.lang;
  const excluded = state.data.excluded.map((e) => {
    const parts = [link(`Hisn al-Muslim ${e.hisn}`, e.hisnUrl), lang === 'fr' ? '\u00a0: ' : ': '];
    if (e.refs.length) {
      e.refs.forEach((r, i) => {
        if (i) parts.push(' ; ');
        parts.push(link(r.label, r.url), ` (${gradeText(r.grade).toLowerCase()})`);
      });
    } else if (e.note) {
      parts.push(e.note[lang] || e.note.en, ' ', link('IslamQA', e.note.url));
    }
    return el('li', {}, parts);
  });
  foot.replaceChildren(
    el(
      'section',
      { class: 'panel' },
      el('h2', { class: 'panel-title' }, s.footSources),
      el(
        'ul',
        {},
        el('li', {}, s.footHisn, ' ', link(hisnCopy, src.hisn.copy)),
        el('li', {}, s.footHe(src.he.versions), ' ', link('hadeethenc.com', src.he.url)),
        el('li', {}, s.footHadith, ' ', link(`commit ${src.hadith.commit.slice(0, 7)}`, src.hadith.url)),
        el('li', {}, s.footExt),
        el('li', {}, s.footQuran),
        el('li', {}, s.footMine),
        el('li', {}, s.footTimes),
      ),
    ),
    el(
      'section',
      { class: 'panel' },
      el('details', {}, el('summary', {}, s.footExcluded), el('p', {}, s.footExcludedLead), el('ul', {}, excluded)),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function openSettings() {
  const dialog = document.getElementById('settings');
  renderSettings(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function renderSettings(dialog) {
  const s = S();
  const method = el(
    'select',
    {
      id: 'set-method',
      onchange: (event) => {
        state.settings.method = event.target.value;
        saveSettings();
        refreshTime();
      },
    },
    Object.keys(METHODS).map((key) => el('option', { value: key, selected: state.settings.method === key }, s.methods[key])),
  );
  const asr = el(
    'select',
    {
      id: 'set-asr',
      onchange: (event) => {
        state.settings.asr = Number(event.target.value);
        saveSettings();
        refreshTime();
      },
    },
    el('option', { value: '1', selected: state.settings.asr === 1 }, s.asrStd),
    el('option', { value: '2', selected: state.settings.asr === 2 }, s.asrHanafi),
  );
  const placeStatus = el('p', { class: 'hint', role: 'status' }, s.placeHint);
  const placeButtons = el(
    'div',
    { class: 'row' },
    el(
      'button',
      {
        class: 'btn',
        type: 'button',
        onclick: () => {
          if (!navigator.geolocation) {
            placeStatus.textContent = s.locError;
            return;
          }
          placeStatus.textContent = s.locating;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const round = (v) => Math.round(v * 100) / 100;
              state.settings.place = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
              saveSettings();
              refreshTime();
              renderSettings(dialog);
            },
            () => {
              placeStatus.textContent = s.locError;
            },
            { timeout: 15000, maximumAge: 3600000 },
          );
        },
      },
      s.useHere,
    ),
    state.settings.place
      ? el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              state.settings.place = null;
              saveSettings();
              refreshTime();
              renderSettings(dialog);
            },
          },
          s.useParis,
        )
      : null,
  );
  const size = el('output', { id: 'set-size' }, String(state.settings.arSize));
  const step = (delta) => {
    state.settings.arSize = Math.min(40, Math.max(20, state.settings.arSize + delta));
    document.documentElement.style.setProperty('--ar', `${state.settings.arSize}px`);
    size.textContent = String(state.settings.arSize);
    saveSettings();
  };
  const langSelect = el(
    'select',
    { id: 'set-lang', onchange: (event) => setLang(event.target.value, dialog) },
    el('option', { value: 'fr', selected: state.lang === 'fr' }, 'Français'),
    el('option', { value: 'en', selected: state.lang === 'en' }, 'English'),
  );
  const place = state.settings.place ? `${s.placeHere} (${state.settings.place.lat}, ${state.settings.place.lng})` : s.placeParis;
  dialog.replaceChildren(
    el(
      'form',
      { class: 'settings-inner', method: 'dialog' },
      el('h2', { id: 'settings-title' }, s.settingsTitle),
      el('div', { class: 'field' }, el('label', { for: 'set-lang' }, s.lang), langSelect),
      el('div', { class: 'field' }, el('p', { class: 'label', style: 'margin:0 0 6px;font-weight:650;font-size:14px' }, colon(s.place), place), placeButtons, placeStatus),
      el('div', { class: 'field' }, el('label', { for: 'set-method' }, s.method), method, el('p', { class: 'hint' }, s.methodHint)),
      el('div', { class: 'field' }, el('label', { for: 'set-asr' }, s.asr), asr),
      el(
        'div',
        { class: 'field' },
        el('p', { class: 'label', style: 'margin:0 0 6px;font-weight:650;font-size:14px' }, s.arSize),
        el(
          'div',
          { class: 'stepper' },
          el('button', { type: 'button', 'aria-label': s.smaller, onclick: () => step(-2) }, '−'),
          size,
          el('button', { type: 'button', 'aria-label': s.larger, onclick: () => step(2) }, '+'),
        ),
      ),
      el('div', { class: 'settings-end' }, el('button', { class: 'btn', value: 'close' }, s.close)),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function setLang(lang, dialog) {
  if (lang === state.lang || !STRINGS[lang]) return;
  state.lang = lang;
  document.documentElement.lang = lang;
  saveSettings();
  renderHero();
  renderTabs();
  renderList();
  renderFoot();
  if (dialog && dialog.open) renderSettings(dialog);
}

function selectTab(tab, manual, scroll) {
  if (!TABS.includes(tab)) return;
  const changed = tab !== state.tab;
  state.tab = tab;
  if (manual) history.replaceState(null, '', `#${tab}`);
  for (const key of TABS) {
    const { button } = dom.tabButtons[key];
    button.setAttribute('aria-selected', String(key === tab));
    button.tabIndex = key === tab ? 0 : -1;
  }
  document.getElementById('main').setAttribute('aria-labelledby', `tab-${tab}`);
  updateHeroTitle();
  if (changed || scroll) {
    renderList();
    const nav = document.getElementById('tabs');
    if (nav.classList.contains('is-stuck') || scroll) {
      const top = document.getElementById('main').getBoundingClientRect().top + window.scrollY - nav.offsetHeight;
      window.scrollTo({ top, behavior: 'auto' });
    }
  }
}

function refreshTime() {
  computePeriod();
  applySky();
  if (dom.times) renderTimes(dom.times);
}

function tabFromHash() {
  const hash = location.hash.slice(1);
  return TABS.includes(hash) ? hash : null;
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

async function start() {
  initClock();
  loadSettings();
  document.documentElement.lang = state.lang;
  document.documentElement.style.setProperty('--ar', `${state.settings.arSize}px`);
  computePeriod();
  applySky();
  state.tab = tabFromHash() || TAB_FOR_SEGMENT[state.period.segment];
  loadProgress();
  renderHero();
  renderTabs();
  watchStuckTabs();

  const main = document.getElementById('main');
  main.setAttribute('role', 'tabpanel');
  main.setAttribute('aria-labelledby', `tab-${state.tab}`);
  const load = async () => {
    main.replaceChildren(el('p', { class: 'notice', role: 'status' }, S().loading));
    try {
      state.data = await loadData();
    } catch (error) {
      const box = el('div', { class: 'notice', role: 'alert' }, el('p', { style: 'margin:0 0 10px' }, S().errData), el('button', { class: 'btn', type: 'button', onclick: load }, S().retry));
      if (error && error.attempts) {
        const list = el('ul', {}, error.attempts.map((a) => el('li', {}, `${a.url} (${a.status})`)));
        box.append(el('details', {}, el('summary', {}, S().errTried), list));
      }
      main.replaceChildren(box);
      return;
    }
    updateTabProgress();
    renderList();
    renderFoot();
  };
  await load();

  window.addEventListener('hashchange', () => {
    const tab = tabFromHash();
    if (tab) selectTab(tab, false);
  });

  // The sky and the times follow the clock.
  let lastDay = dateKey(clock());
  const tick = () => {
    refreshTime();
    const today = dateKey(clock());
    if (today !== lastDay) {
      lastDay = today;
      loadProgress();
      updateTabProgress();
      renderList();
    }
  };
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

start();
