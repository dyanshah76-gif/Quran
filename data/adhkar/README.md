# Adhkar data

`adhkar.json` holds every text of the adhkar page (`adhkar.html`) except the
Quran passages, which the page loads at runtime from the same pinned
quran-json files as the Quran reader.

It is built by `tools/adhkar/build.py`. Every Arabic text, translation, grade
and link is copied from the sources below without changes. When only part of a
text is shown, the build cuts it between a start and an end marker and stops if
either is missing, so no text is typed by hand.

## Sources

| Content | Source | Pinned version |
| --- | --- | --- |
| Arabic text of each dhikr, its number and the order | Hisn al-Muslim by Sa'id ibn Wahf al-Qahtani, hisnmuslim.com edition, copied in [YousefAsalya/Islamic-Pro-azkar-API](https://github.com/YousefAsalya/Islamic-Pro-azkar-API/tree/d793023e3b69c91674023f692425950c8ebbb64d) | commit `d793023` |
| English translation of most adhkar | the same hisnmuslim.com edition | same |
| Hadith text, English and French translation, explanation | [HadeethEnc.com](https://hadeethenc.com/) official Excel files: Arabic v1.8.0, English v1.25.0, French v1.17.0, byte-for-byte copies in [Younes12345698/hadeethenc-mirror](https://github.com/Younes12345698/hadeethenc-mirror/tree/429f7bd041246a943751121590287c7877b15372) | commit `429f7bd` |
| Hadith of al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, Ibn Majah: Arabic, sunnah.com English, al-Albani's grades | [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784) | commit `df57907` |
| Five hadith outside these books (Ubayy and the jinn; the advice to Fatimah; «asbahna 'ala fitrat al-Islam»; ten tahlil; turning over at night) | al-Albani's grade and the book where he gives it (Sahih al-Targhib, Sahih al-Jami', al-Silsila al-Sahiha), each with a page to check | see `ext` in the file |

HadeethEnc's terms ask that its texts are not changed, that the source and the
version are named, and that new versions are followed. The page names
HadeethEnc and the version under every text taken from it.

## Rules

- **Grades.** A dhikr is kept only if every hadith it rests on is in Sahih
  al-Bukhari or Sahih Muslim, or was graded sahih or hasan by al-Albani. The
  build stops if a kept reference has another grade, or if a left-out one is
  sahih or hasan. The page checks the grades again before showing a dhikr.
- **Left out.** Six adhkar of the morning and evening chapter of Hisn al-Muslim
  (numbers 80, 81, 83, 87, 89, 98) are graded weak by al-Albani. The page lists
  their numbers and grades only, not their text.
- **Order.** Hisn al-Muslim's order: chapter 27 (morning and evening),
  chapter 28 (sleep), chapter 29 (turning over at night).
- **Time.** Each dhikr is placed at the time its own hadith gives, and the page
  shows those words in Arabic. Where this differs from Hisn al-Muslim, a note
  says so:
  - Hisn 93 (*la ilaha illa Allah…*, 100 times) and Hisn 96 (*astaghfiru
    Allah wa atubu ilayh*, 100 times): their hadith say «في يوم», "in a day",
    so they are in the Day tab.
  - Hisn 101 (the last two ayat of al-Baqarah): the hadith says «في ليلة», "in
    a night", so it is under "During the night", not "When going to bed".
  - Ayat al-Kursi appears twice, each with its own hadith: morning and evening
    (Ubayy ibn Ka'b, Sahih al-Targhib 662) and at bedtime (al-Bukhari 2311,
    quoted by al-Bukhari without his full chain, *mu'allaq*).
  - Surat al-Mulk and as-Sajdah are at bedtime: «لا ينام حتى يقرأ», "he would
    not sleep until he had recited" (at-Tirmidhi 3404).
- **Counts.** From the hadith, or from Hisn al-Muslim where the hadith gives
  none. Where the count comes from a second hadith, the page names it.

## Translations

- English: the hisnmuslim.com translation of Hisn al-Muslim, or HadeethEnc or
  sunnah.com where theirs is closer to the hadith. Two hisnmuslim.com lines are
  not used: Hisn 86 renders السميع as "All-Seeing", and Hisn 105 reverses
  «أموت وأحيا».
- French: HadeethEnc where it has the hadith.
- Where no published translation was found, the line is marked
  `"src": "mine"`: written for this page by Claude, and shown with the label
  "Unofficial translation (Claude)". The Arabic stays the reference.
- Quran: Saheeh International (English) and Muhammad Hamidullah (French), from
  quran-json 3.1.2, loaded at runtime.

## Fields

```
items[]      one dhikr per entry, in Hisn al-Muslim order
  id         "h" + Hisn al-Muslim number
  tabs       morning, day, evening, night
  group      night tab only: night, bed or turning
  count      number of times, or [33, 33, 34]
  when       time tag shown on the page
  recite[]   {ar, src} copied text, or {quran: [surah, from, to]}
  reciteEvening, meaningEvening   evening wording, where it differs
  meaning    {en, fr} each {text, src}, or "quran"
  whenAr[]   the words of the hadith that give the time
  about      {en, fr}: what the hadith says about it
  hadith     full Arabic hadith, its translations and explanation
  refs[]     {label, url, grade, grader, where}
srcs         label and link for every "src" tag used in the file
times        Sunan Abi Dawud 3667, the hadith that names the two times
excluded[]   the left-out Hisn al-Muslim numbers and their grades
```

## Rebuild

```
python3 tools/adhkar/build.py HADITH_DIR HADEETHENC_DIR HISN_DIR data/adhkar/adhkar.json
```

The three folders are listed at the top of `tools/adhkar/build.py`.
