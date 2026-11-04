# Authentic hadith that quote an ayah

`<surah>.json` lists, for each ayah, the authentic hadith that quote it:

```json
{"surah": 2, "ayat": {"158": [{"b": "bukhari", "n": 4496, "no": "4496", "ref": "65/23"}, …]}}
```

- `b`: the collection; `n`: the hadith's number in the dataset (used to load its text);
  `no`: the number people cite (for Muslim, Abd al-Baqi's number, e.g. 810 or 1277a);
  `ref`: book/hadith, the in-book reference used by sunnah.com.
- `g`: al-Albani's grade, only for Abu Dawud, Tirmidhi, Nasa'i and Ibn Majah.

These files hold no hadith text. The site loads the texts at runtime, unchanged, from
[fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784)
(commit `df57907`, public domain), and checks that each file holds that very hadith
(same number, same book reference).

## Which hadith are kept

- Sahih al-Bukhari and Sahih Muslim: every numbered narration. Left out: Muslim's
  introduction and the extra unnumbered narrations (numbered like 774.2 in the dataset).
- Sunan Abi Dawud, Jami' at-Tirmidhi, Sunan an-Nasa'i, Sunan Ibn Majah: only the hadith
  that al-Albani graded *Sahih*, *Hasan*, *Hasan Sahih*, *Sahih Mutawatir* or
  *Sahih Lighairihi*. His grades come from his editions of these four books, taken by the
  dataset from al-maktaba.org. Grades on the chain only ("... isnad"), sayings of
  Companions or Successors (mawquf, maqtu'), and every weak grade are left out.

## When a hadith is placed under an ayah

The link always comes from the hadith's own words, never from an opinion:

1. The hadith quotes the ayah: a passage marked as Quran with `{ }` in the Arabic text
   matches, word for word, a passage found in only one ayah. Without `{ }`, at least 5
   words found in only one ayah, introduced by a quoting word (nazala, anzala, qara'a,
   tala, al-ayah, qawluhu...) or at least 8 words long; words that recur in hadith but
   are never marked as a quote (a dhikr such as "lahu al-mulk wa lahu al-hamd") do not count.
2. The hadith names the ayah: "ayat al-kursi" (2:255), "the two ayat at the end of
   Surat al-Baqarah" / "khawatim Surat al-Baqarah" (2:285-286).
3. One case added by hand: Muslim 810 (Ubayy: the greatest ayah), which quotes words that
   begin both 2:255 and 3:2; Muslim's chapter is "The virtue of Surat al-Kahf and Ayat
   al-Kursi" ([sunnah.com/muslim/6/313](https://sunnah.com/muslim/6/313)).

Matching ignores only vowel marks and the shapes of alif, ya and ta marbuta.

Result (4 November 2026): 1,684 hadith on 554 ayat (Bukhari 663, Muslim 308,
Abu Dawud 184, Tirmidhi 204, Nasa'i 200, Ibn Majah 125). Most ayat have no such hadith;
the site then says so.

Rebuild: `python3 tools/hadith-map/build.py <folder with the pinned files> data/hadith`
(the list of files is at the top of `tools/hadith-map/build.py`).
