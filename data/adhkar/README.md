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
| Hadith of al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, an-Nasa'i, Ibn Majah: Arabic and sunnah.com English | [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784) | commit `df57907` |
| Al-Albani's rulings on the four Sunan, in his own Arabic words (Sahih wa Da'if Sunan Abi Dawud, at-Tirmidhi, an-Nasa'i, Ibn Majah; al-maktaba.org books 1755, 782, 783, 810) | [fawazahmed0/hadith, Scripts/uncleaned grades](https://github.com/fawazahmed0/hadith/tree/e4e7f39c83509194fd8ca53996033734bc4b5f83/Scripts/uncleaned%20grades) | commit `e4e7f39` |
| Al-Albani, Sahih al-Jami' as-Saghir: text and grade of hadith outside the six books | [HsnSaboor/hadith-api-toon](https://github.com/HsnSaboor/hadith-api-toon/tree/db81b0bd1d9cbfa4fe8c30148066c687056542e3/editions/jami-saghir) | commit `db81b0b` |
| Hadith text, English and French translation, explanation | [HadeethEnc.com](https://hadeethenc.com/) official Excel files: Arabic v1.8.0, English v1.25.0, French v1.17.0, byte-for-byte copies in [Younes12345698/hadeethenc-mirror](https://github.com/Younes12345698/hadeethenc-mirror/tree/429f7bd041246a943751121590287c7877b15372) | commit `429f7bd` |
| Order, numbering and some wordings and English translations | Hisn al-Muslim by Sa'id ibn Wahf al-Qahtani, hisnmuslim.com edition, copied in [YousefAsalya/Islamic-Pro-azkar-API](https://github.com/YousefAsalya/Islamic-Pro-azkar-API/tree/d793023e3b69c91674023f692425950c8ebbb64d) | commit `d793023` |
| When to say the morning and evening adhkar | Ibn al-Qayyim, al-Wabil as-Sayyib ([shamela.ws/book/216](https://shamela.ws/book/216)), text from [OpenITI/RELEASE](https://github.com/OpenITI/RELEASE/tree/cfc4157a3cf2054c0888f133970a4eaa3e22e58c/data/0751IbnQayyimJawziyya/0751IbnQayyimJawziyya.WabilSayyib) | commit `cfc4157` |
| Seven hadith outside the six books | al-Albani's grade and the book where he gives it (Sahih at-Targhib, Sahih al-Jami', as-Silsila as-Sahiha), each with a page to check | `EXTERNAL` in the build |

HadeethEnc's terms ask that its texts are not changed, that the source and the
version are named, and that new versions are followed.

## Checks made by the build

The build stops if one of these fails:

1. **Wording.** Every dhikr is found, letter for letter, inside the authentic
   hadith it cites. Ten short texts are declared instead as Hisn al-Muslim's
   own presentation (the isti'adha before Ayat al-Kursi, *subhan Allah /
   al-hamdu lillah / Allahu akbar* where the hadith only names the acts, the
   morning form of *amsayna wa amsa al-mulku lillah*, *asbahna 'ala fitrat
   al-Islam* in Ahmad's wording, the names of two surahs); the page says so.
2. **Grades.** Every reference is in Sahih al-Bukhari or Sahih Muslim, or was
   graded sahih or hasan by al-Albani. His Arabic ruling is read from his own
   edition and copied into the file. If it holds a reservation ("except the
   words…", "the chain is…"), the build stops unless that reference was
   reviewed (`REVIEWED`).
3. **Counts.** A dhikr said more than once must come with the words of a hadith
   that give the number.
4. **Vowel marks.** Every text to recite carries them.

The page re-checks grades and counts before showing a dhikr.

## Decisions that differ from Hisn al-Muslim

- **Hisn 104** («اللهم قني عذابك يوم تبعث عبادك»): said once, not three times.
  Al-Albani, Sunan Abi Dawud 5045: «صحيح، دون قوله: " ثلاث مرار "», and he
  writes that "three times" is in Sahih al-Jami' 4656 by mistake.
- **Hisn 72** (ten tahlil with *yuhyi wa yumit*): after Maghrib only. The Fajr
  hadith (at-Tirmidhi 3474) is «ضعيف» in al-Albani's edition.
- **Hisn 70** (al-Ikhlas, al-Falaq, an-Nas after the prayer): once after every
  prayer, as in the hadith (Abu Dawud 1523). "Three times after Fajr and
  Maghrib" is not in it; three times morning and evening is Hisn 76.
- **Hisn 67**: once, as in al-Bukhari 844.
- **Left out** (weak according to al-Albani): Hisn 80, 81, 83, 87, 89, 98. The
  page lists their numbers and his rulings only.
- **Wordings** are those of one authentic hadith, named under each dhikr, where
  Hisn al-Muslim blends several narrations (Hisn 2, 78, 79, 82, 84, 85, 102,
  103, 107, 109).
- **Time.** Hisn 93 and 96: «في يوم», "in a day" (Day list). Hisn 101: «في
  ليلة», "in a night". Ayat al-Kursi at bedtime: al-Bukhari 2311, quoted by
  al-Bukhari without his full chain (*mu'allaq*).

## Translations

- English: sunnah.com, HadeethEnc or the hisnmuslim.com translation of Hisn
  al-Muslim, whichever matches the wording shown.
- French: HadeethEnc where it has the hadith.
- Where no published translation was found, the line is marked
  `"src": "mine"`: written for this page by Claude, and shown with the label
  "Unofficial translation (Claude)". The Arabic stays the reference.
- Quran: Saheeh International (English) and Muhammad Hamidullah (French), from
  quran-json 3.1.2, loaded at runtime.

## Fields

```
timing       Ibn al-Qayyim's words and Abu Dawud 3667 on the two times
items[]      one dhikr per entry
  id         "h" + Hisn al-Muslim number
  tabs       wake, morning, day, evening, night, prayer
  group      night: night, bed, turning; prayer: each, maghrib, fajr
  count      number of times; absent when each phrase has its own "n"
  recite[]   {ar, src, n?, inside?, own?} | {quran: [surah, from, to]} | {basmala: true}
             inside = the hadith that contains the words; own = Hisn's presentation
  reciteEvening, meaningEvening   evening wording, where it differs
  meaning    {en, fr} each {text, src}, or "quran"
  whenAr[]   the words of the hadith that give the time
  countAr    the words of the hadith that give the count
  about      {en, fr}: what the hadith says about it
  notes[]    {label, en, fr, ar?, tabs?, face?}
  hadith     full Arabic hadith, its translations and explanation
  refs[]     {label, url, grade, grader, ruling, where}; ruling = al-Albani's words
srcs         label and link for every "src" tag used in the file
excluded[]   the left-out Hisn al-Muslim numbers and al-Albani's rulings
```

## Rebuild

```
python3 tools/adhkar/build.py HADITH_DIR HADEETHENC_DIR HISN_DIR ALBANI_DIR JAMI_DIR WABIL_FILE data/adhkar/adhkar.json
```

The folders are described at the top of `tools/adhkar/build.py`.
