// Every Quran text, translation and tafsir shown on this site is downloaded at
// runtime, unchanged, from the pinned sources below. Nothing is copied into this
// repository. Each address is pinned to a fixed version (an npm version or a git
// commit), so the content cannot change behind the site's back.
//
// Checked on 3 November 2026:
// - quran-json, git tag v3.1.2 (commit 707ba0f): 114 chapter files per language,
//   6,236 verses; Arabic = Uthmani text from QuranEnc.com, French = Muhammad
//   Hamidullah (via Tanzil.net), English = Saheeh International (via Tanzil.net).
// - spa5k/tafsir_api, commit eb82bb6 (30 Sep 2026): editions.json lists
//   id 35 "en-tafisr-ibn-kathir" (English, abridged), id 22
//   "ar-tafsir-ibn-kathir" (Arabic) and id 30 "tafseer-ibn-e-kaseer-urdu"
//   (Urdu); one JSON file per ayah: {surah, ayah, text}.
// - fawazahmed0/quran-api, commit 93e6f64: copy of the KFGQPC HAFS Uthmanic
//   Script font (King Fahd Complex), loaded in styles.css.

export const QURAN_JSON = {
  name: 'quran-json',
  version: '3.1.2',
  commit: '707ba0f37ddcb59fed06bcbf21c639004e610d26',
  // Tried in this order; the first one that answers with valid data is used.
  bases: [
    'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/',
    'https://cdn.jsdelivr.net/gh/risan/quran-json@707ba0f37ddcb59fed06bcbf21c639004e610d26/',
    'https://raw.githubusercontent.com/risan/quran-json/707ba0f37ddcb59fed06bcbf21c639004e610d26/',
  ],
  indexPath: (lang) => `dist/chapters/${lang}/index.json`,
  chapterPath: (lang, n) => `dist/chapters/${lang}/${n}.json`,
  url: 'https://github.com/risan/quran-json/tree/v3.1.2',
  author: { name: 'Risan Bagja Pradana', url: 'https://risanb.com' },
  license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
};

export const ARABIC_TEXT = {
  name: 'QuranEnc.com',
  url: 'https://quranenc.com/',
};

export const TRANSLATIONS = {
  fr: {
    file: 'fr',
    translator: 'Muhammad Hamidullah',
    via: 'Tanzil.net',
    url: 'https://tanzil.net/trans/fr.hamidullah',
  },
  en: {
    file: 'en',
    translator: 'Saheeh International',
    via: 'Tanzil.net',
    url: 'https://tanzil.net/trans/en.sahih',
  },
  ur: {
    translator: 'Muhammad Junagarhi',
    via: 'Tanzil.net',
    url: 'https://tanzil.net/trans/',
  },
};

// Urdu translation of Muhammad Junagarhi (Tanzil text), one JSON file per surah:
// {"chapter": [{"chapter": n, "verse": i, "text": "…"}]}. Checked on
// 3 November 2026: 6,236 verses, each under the right ayah.
export const URDU = {
  name: 'fawazahmed0/quran-api',
  edition: 'urd-muhammadjunagar',
  commit: '93e6f64925ae76273520d636fcaaf061129f2316',
  bases: [
    'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@93e6f64925ae76273520d636fcaaf061129f2316/',
    'https://raw.githubusercontent.com/fawazahmed0/quran-api/93e6f64925ae76273520d636fcaaf061129f2316/',
  ],
  chapterPath: (n) => `editions/urd-muhammadjunagar/${n}.json`,
  url: 'https://github.com/fawazahmed0/quran-api/tree/93e6f64925ae76273520d636fcaaf061129f2316',
};

// Roman Urdu: NOT an official translation. Junagarhi's Urdu written in Latin
// letters by Claude, word by word, at the user's request (see
// data/roman-urdu/README.md). Stored in this repository because it exists
// nowhere else; always shown with an "unofficial" label.
export const ROMAN_URDU = {
  bases: ['data/roman-urdu/'],
  chapterPath: (n) => `${n}.json`,
  readme: 'https://github.com/dyanshah76-gif/Quran/blob/main/data/roman-urdu/README.md',
};

export const TAFSIR = {
  name: 'spa5k/tafsir_api',
  commit: 'eb82bb6294efe30ad5c135c03b1864afaa70e855',
  bases: [
    'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@eb82bb6294efe30ad5c135c03b1864afaa70e855/',
    'https://raw.githubusercontent.com/spa5k/tafsir_api/eb82bb6294efe30ad5c135c03b1864afaa70e855/',
  ],
  ayahPath: (slug, surah, ayah) => `tafsir/${slug}/${surah}/${ayah}.json`,
  url: 'https://github.com/spa5k/tafsir_api/tree/eb82bb6294efe30ad5c135c03b1864afaa70e855',
  license: { name: 'MIT', url: 'https://github.com/spa5k/tafsir_api/blob/eb82bb6294efe30ad5c135c03b1864afaa70e855/LICENSE' },
  editions: {
    en: {
      id: 35,
      slug: 'en-tafisr-ibn-kathir', // spelling "tafisr" is the dataset's own slug
      lang: 'en',
      dir: 'ltr',
      qul: 'https://qul.tarteel.ai/resources/tafsir/35',
    },
    ar: {
      id: 22,
      slug: 'ar-tafsir-ibn-kathir',
      lang: 'ar',
      dir: 'rtl',
      qul: 'https://qul.tarteel.ai/resources/tafsir/22',
    },
    ur: {
      id: 30,
      slug: 'tafseer-ibn-e-kaseer-urdu',
      lang: 'ur',
      dir: 'rtl',
      qul: 'https://qul.tarteel.ai/resources/tafsir/30',
    },
  },
};

export const QURAN_FONT = {
  name: 'KFGQPC HAFS Uthmanic Script',
  maker: 'King Fahd Glorious Quran Printing Complex',
  makerUrl: 'https://fonts.qurancomplex.gov.sa/',
  copyUrl: 'https://github.com/fawazahmed0/quran-api/tree/93e6f64925ae76273520d636fcaaf061129f2316/fonts',
  family: 'QuranHafs',
};
