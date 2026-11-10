// Every Quran text, translation, tafsir and hadith shown on this site is
// downloaded at runtime, unchanged, from the pinned sources below. Each address
// is pinned to a fixed version (an npm version or a git commit), so the content
// cannot change behind the site's back.
//
// Checked on 3–4 November 2026:
// - quran-json, git tag v3.1.2 (commit 707ba0f): 114 chapter files per language,
//   6,236 verses; Arabic = Uthmani text from QuranEnc.com, French = Muhammad
//   Hamidullah (via Tanzil.net), English = Saheeh International (via Tanzil.net).
// - spa5k/tafsir_api, commit eb82bb6 (30 Sep 2026): editions.json lists
//   Al-Mukhtasar fi Tafsir al-Qur'an al-Karim (Tafsir Center for Quranic
//   Studies): id 251 "ar-tafsir-al-mukhtasar" (Arabic), id 266
//   "en-tafsir-al-mukhtasar" (English), id 259 "french-mokhtasar" (French);
//   one JSON file per ayah: {surah, ayah, text}. All 6,236 files present in
//   each language, none empty, and no entry shifted onto another ayah.
// - fawazahmed0/hadith-api, commit df57907 (public domain): one JSON file per
//   hadith number, Arabic + English, French, Urdu; al-Albani's grades for the
//   four Sunan. Which hadith quote which ayah: data/hadith (tools/hadith-map).
// - fawazahmed0/quran-api, commit 93e6f64: copy of the KFGQPC HAFS Uthmanic
//   Script font (King Fahd Complex), loaded in styles.css.
//
// One exception: the adhkar page (adhkar.html) reads its texts from
// data/adhkar/adhkar.json, a file on this site built from pinned sources by
// tools/adhkar/build.py (see data/adhkar/README.md). Its Quran passages are
// still downloaded at runtime from QURAN_JSON below.

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

// Al-Mukhtasar fi Tafsir al-Qur'an al-Karim: explains the meaning of each ayah,
// by a group of tafsir scholars under the Tafsir Center for Quranic Studies
// (Riyadh). It quotes no reports, so nothing in it needs grading.
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
    ar: {
      id: 251,
      slug: 'ar-tafsir-al-mukhtasar',
      lang: 'ar',
      dir: 'rtl',
      qul: 'https://qul.tarteel.ai/resources/tafsir/251',
    },
    fr: {
      id: 259,
      slug: 'french-mokhtasar',
      lang: 'fr',
      dir: 'ltr',
      qul: 'https://qul.tarteel.ai/resources/tafsir/259',
    },
    en: {
      id: 266,
      slug: 'en-tafsir-al-mukhtasar',
      lang: 'en',
      dir: 'ltr',
      qul: 'https://qul.tarteel.ai/resources/tafsir/266',
    },
  },
};

// Panel tabs. Urdu has no al-Mukhtasar in open data: its tab shows the hadith only.
export const PANEL_LANGS = ['ar', 'fr', 'en', 'ur'];

// Hadith texts: one file per hadith number, e.g. editions/eng-bukhari/4496.json
// = {"metadata": {...}, "hadiths": [{hadithnumber, text, grades, reference}]}.
// A file may also hold an unnumbered narration that follows (4496.2); the site
// picks the entry whose number and book reference match the index.
export const HADITH = {
  name: 'fawazahmed0/hadith-api',
  commit: 'df57907be35291c91ad6a6691180e22ca9920784',
  bases: [
    'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@df57907be35291c91ad6a6691180e22ca9920784/',
    'https://raw.githubusercontent.com/fawazahmed0/hadith-api/df57907be35291c91ad6a6691180e22ca9920784/',
  ],
  path: (edition, book, n) => `editions/${edition}-${book}/${n}.json`,
  url: 'https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784',
  license: { name: 'Unlicense', url: 'https://github.com/fawazahmed0/hadith-api/blob/df57907be35291c91ad6a6691180e22ca9920784/LICENSE' },
  gradesFrom: 'https://al-maktaba.org/',
  edition: { ar: 'ara', en: 'eng', fr: 'fra', ur: 'urd' },
  // languages each collection has in the dataset (no French Tirmidhi)
  books: {
    bukhari: ['ar', 'en', 'fr', 'ur'],
    muslim: ['ar', 'en', 'fr', 'ur'],
    abudawud: ['ar', 'en', 'fr', 'ur'],
    tirmidhi: ['ar', 'en', 'ur'],
    nasai: ['ar', 'en', 'fr', 'ur'],
    ibnmajah: ['ar', 'en', 'fr', 'ur'],
  },
  // sunnah.com uses the same hadith numbers, except for Muslim, whose dataset
  // numbers differ: there the in-book reference "book/hadith" is used.
  link: (book, n, ref) => (book === 'muslim' ? `https://sunnah.com/muslim/${ref}` : `https://sunnah.com/${book}:${n}`),
};

// Which authentic hadith quote which ayah, made by tools/hadith-map/build.py
// from the pinned files above: data/hadith/<surah>.json.
export const HADITH_INDEX = {
  bases: ['data/hadith/'],
  path: (s) => `${s}.json`,
  readme: 'https://github.com/dyanshah76-gif/Quran/blob/main/data/hadith/README.md',
  grades: ['Sahih', 'Hasan', 'Hasan Sahih', 'Sahih Mutawatir', 'Sahih Lighairihi'],
};

export const QURAN_FONT = {
  name: 'KFGQPC HAFS Uthmanic Script',
  maker: 'King Fahd Glorious Quran Printing Complex',
  makerUrl: 'https://fonts.qurancomplex.gov.sa/',
  copyUrl: 'https://github.com/fawazahmed0/quran-api/tree/93e6f64925ae76273520d636fcaaf061129f2316/fonts',
  family: 'QuranHafs',
};

// Recitation, one MP3 file per ayah, from EveryAyah.com (Verse By Verse Quran
// project). The site only plays these recordings; it does not host or change
// them. File name: three digits for the surah, three for the ayah.
export const AUDIO = {
  name: 'EveryAyah.com',
  url: 'https://everyayah.com/',
  base: 'https://everyayah.com/data/',
  file: (folder, s, a) => `${folder}/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`,
  default: 'minshawi',
  reciters: {
    minshawi: { folder: 'Minshawy_Murattal_128kbps', name: 'Muhammad Siddiq al-Minshawi', ar: 'محمد صديق المنشاوي' },
    husary: { folder: 'Husary_128kbps', name: 'Mahmud Khalil al-Husary', ar: 'محمود خليل الحصري' },
    hudhaify: { folder: 'Hudhaify_128kbps', name: 'Ali al-Hudhaify', ar: 'علي الحذيفي' },
    muaiqly: { folder: 'MaherAlMuaiqly128kbps', name: 'Maher al-Muaiqly', ar: 'ماهر المعيقلي' },
    abdulbasit: { folder: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit Abdus-Samad', ar: 'عبد الباسط عبد الصمد' },
  },
};
