# Coran: lecture et tafsir

A calm, mobile-first Quran reader. Pick a surah, read each ayah in Arabic with
its translation underneath, and tap any ayah to open Tafsir Ibn Kathir for that
exact ayah.

Live site: https://dyanshah76-gif.github.io/Quran/
Link to an ayah: https://dyanshah76-gif.github.io/Quran/#2:255

## Where every word comes from

No Quran text, translation or tafsir is stored in this repository or written by
hand. The site downloads them at runtime, unchanged, from these pinned sources
(see `assets/sources.js`):

| Content | Source | Pinned version | Licence / terms |
| --- | --- | --- | --- |
| Arabic text (Uthmani, Hafs, Madinah Mushaf) | [QuranEnc.com](https://quranenc.com/), via [quran-json](https://github.com/risan/quran-json/tree/v3.1.2) | npm `quran-json@3.1.2` = git tag `v3.1.2` (`707ba0f`) | quran-json: CC BY-SA 4.0. QuranEnc: no modification, cite QuranEnc.com |
| French translation: Muhammad Hamidullah | [Tanzil.net](https://tanzil.net/trans/fr.hamidullah), via quran-json | same | Tanzil: non-commercial use |
| English translation: Saheeh International | [Tanzil.net](https://tanzil.net/trans/en.sahih), via quran-json | same | Tanzil: non-commercial use |
| Tafsir Ibn Kathir, English (abridged) | QUL resource [35](https://qul.tarteel.ai/resources/tafsir/35), slug `en-tafisr-ibn-kathir`, via [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) | commit `eb82bb6` | dataset code MIT; texts belong to their publishers |
| Tafsir Ibn Kathir, Arabic | QUL resource [22](https://qul.tarteel.ai/resources/tafsir/22), slug `ar-tafsir-ibn-kathir`, via spa5k/tafsir_api | commit `eb82bb6` | same |
| Quran font: KFGQPC HAFS Uthmanic Script v13 | [King Fahd Complex](https://fonts.qurancomplex.gov.sa/), copy in [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api) | commit `93e6f64` | credited in the footer |

Every response is checked before it is shown: chapter number, number of ayahs,
ayah numbers, and for the tafsir the surah and ayah inside the file must match
what was asked. If a CDN address fails, the next one is tried (jsDelivr npm,
jsDelivr GitHub, raw GitHub). If all fail, the page says so and offers a retry.

When Ibn Kathir explains several ayahs together, the dataset repeats the same
passage on each of them. The tafsir panel detects this and says which ayahs the
passage covers (for example 112:1 to 112:4).

## Files

```
index.html          page shell, early theme script
favicon.svg         octagram icon
.nojekyll           tells GitHub Pages to serve files as they are
assets/
  styles.css        layout, light and dark themes, Quran font
  app.js            routing, loading, tafsir panel, settings
  sources.js        the pinned source addresses and IDs
  i18n.js           interface text in French and English
README.md
```

## Addresses

- `#` list of surahs
- `#2` surah 2
- `#2:255` surah 2, scrolled to ayah 255 (shareable)

## Put it on GitHub Pages

1. Repository **Settings** → **Pages**.
2. **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, then **Save**.
3. After 1 to 2 minutes the site is at `https://<user>.github.io/<repo>/`.

No build step: edit the files and commit, and Pages republishes on its own.

## Changing a source

Edit `assets/sources.js`. Pin a fixed version (npm version or git commit), never
a moving branch, and check the IDs in the dataset's own files before using them.
