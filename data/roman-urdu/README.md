# Roman Urdu: unofficial transcription

These files are **not an official translation** and do not come from a
publisher. They are Muhammad Junagarhi's Urdu translation (Tanzil text, as
shipped by [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api) at
commit `93e6f64`) written in Latin letters by Claude, word by word, on the
user's request.

Why: the only Roman Urdu editions found as open data have errors. The Junagarhi
one (quranraj.com) puts several translations under the wrong ayah (all of
Al-Fatiha, Yunus 10:32–39, Taha 20:119, Al-Mulk 67:3–5) and differs from the
Urdu in places; the Maududi one has cut-off verses and English words mixed in.

How (see `tools/roman-urdu/build.py`):

1. The Urdu verse is the starting point, so each line belongs to the right ayah.
2. Each Urdu word is spelled the way quranraj.com spells it, learned only where
   a Roman word clearly matches the Urdu word.
3. About 300 words were spelled by hand (`tools/roman-urdu/manual.json`), for
   example کہ = kay, نہ = na, and names such as Musa or Ibrahim.

Every verse was compared letter skeleton by letter skeleton with its Urdu
original (median similarity 0.99). Spelling mistakes are still possible.
The Urdu text is the reference.

Format: `{n}.json` = `{"surah": n, "verses": ["…", …]}`, one string per ayah.
