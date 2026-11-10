#!/usr/bin/env python3
"""Build data/adhkar/adhkar.json for the adhkar page (adhkar.html).

Every Arabic text, translation, grade and link in the output is copied
unchanged from the pinned sources below. Excerpts are cut from a source text
with a start and an end marker, and the build stops if a marker is missing, so
nothing can be retyped by hand. The only texts not copied from a source are the
lines marked "mine": translations written for this page because no published
one was found. The page labels them as such.

The build also checks, and stops if a check fails:
  1. every dhikr is found, letter for letter, in the authentic hadith it cites
     (or is explicitly declared as Hisn al-Muslim's own presentation);
  2. every reference is in al-Bukhari or Muslim, or graded sahih or hasan by
     al-Albani, and al-Albani's own Arabic ruling carries no reservation that
     has not been reviewed here (see REVIEWED);
  3. every count above one is backed by the words of a hadith;
  4. every text to recite carries its vowel marks.

Quran passages are not copied here: the page loads them at runtime from the
same pinned quran-json files as the Quran reader.

Usage:
  python3 tools/adhkar/build.py HADITH_DIR HADEETHENC_DIR HISN_DIR ALBANI_DIR JAMI_DIR WABIL_FILE OUT_JSON

  HADITH_DIR      fawazahmed0/hadith-api @ df57907: full editions
                  ara-<book>.json and eng-<book>.json
  HADEETHENC_DIR  the official HadeethEnc.com Excel files
                  HadeethEnc.com_ar-v1.8.0.xlsx, _en-v1.25.0.xlsx, _fr-v1.17.0.xlsx
                  (byte-for-byte copies in Younes12345698/hadeethenc-mirror @ 429f7bd)
  HISN_DIR        data/ar.json and data/en.json of YousefAsalya/Islamic-Pro-azkar-API
                  @ d793023 (the hisnmuslim.com API: Hisn al-Muslim by
                  Sa'id ibn Wahf al-Qahtani, with the book's numbering)
  ALBANI_DIR      "Scripts/uncleaned grades" of fawazahmed0/hadith @ e4e7f39:
                  al-Albani's rulings copied from al-maktaba.org, books 1755
                  (Sahih wa Da'if Sunan Abi Dawud), 782 (at-Tirmidhi), 783
                  (an-Nasa'i), 810 (Ibn Majah)
  JAMI_DIR        editions/jami-saghir of HsnSaboor/hadith-api-toon @ db81b0b
                  (Sahih al-Jami' as-Saghir, al-Albani)
  WABIL_FILE      OpenITI/RELEASE @ cfc4157, data/0751IbnQayyimJawziyya/
                  0751IbnQayyimJawziyya.WabilSayyib/
                  0751IbnQayyimJawziyya.WabilSayyib.Shamela0000216-ara1
                  (Ibn al-Qayyim, al-Wabil as-Sayyib, shamela.ws/book/216)
"""

import csv
import glob
import io
import json
import os
import re
import sys
import unicodedata

import openpyxl

SOURCES = {
    'hadith': {
        'name': 'fawazahmed0/hadith-api',
        'commit': 'df57907be35291c91ad6a6691180e22ca9920784',
        'url': 'https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784',
        'note': 'Arabic text and sunnah.com English translations of the six books',
    },
    'he': {
        'name': 'HadeethEnc.com (Encyclopedia of Translated Prophetic Hadiths)',
        'versions': {'ar': '1.8.0', 'en': '1.25.0', 'fr': '1.17.0'},
        'url': 'https://hadeethenc.com/',
        'mirror': 'https://github.com/Younes12345698/hadeethenc-mirror/tree/429f7bd041246a943751121590287c7877b15372',
    },
    'hisn': {
        'name': 'Hisn al-Muslim (Sa\'id ibn Wahf al-Qahtani), hisnmuslim.com',
        'copy': 'https://github.com/YousefAsalya/Islamic-Pro-azkar-API/tree/d793023e3b69c91674023f692425950c8ebbb64d',
        'url': 'https://sunnah.com/hisn',
    },
    'albani': {
        'name': "al-Albani, Sahih wa Da'if Sunan Abi Dawud, at-Tirmidhi, an-Nasa'i, Ibn Majah (al-maktaba.org books 1755, 782, 783, 810)",
        'commit': 'e4e7f39c83509194fd8ca53996033734bc4b5f83',
        'url': 'https://github.com/fawazahmed0/hadith/tree/e4e7f39c83509194fd8ca53996033734bc4b5f83/Scripts/uncleaned%20grades',
    },
    'jami': {
        'name': "al-Albani, Sahih al-Jami' as-Saghir",
        'commit': 'db81b0bd1d9cbfa4fe8c30148066c687056542e3',
        'url': 'https://github.com/HsnSaboor/hadith-api-toon/tree/db81b0bd1d9cbfa4fe8c30148066c687056542e3/editions/jami-saghir',
    },
    'wabil': {
        'name': 'Ibn al-Qayyim, al-Wabil as-Sayyib (Dar al-Hadith, Cairo, 3rd ed. 1999)',
        'commit': 'cfc4157a3cf2054c0888f133970a4eaa3e22e58c',
        'url': 'https://shamela.ws/book/216',
        'copy': 'https://github.com/OpenITI/RELEASE/tree/cfc4157a3cf2054c0888f133970a4eaa3e22e58c/data/0751IbnQayyimJawziyya/0751IbnQayyimJawziyya.WabilSayyib',
    },
}

BOOK_NAMES = {
    'bukhari': 'Sahih al-Bukhari',
    'muslim': 'Sahih Muslim',
    'abudawud': 'Sunan Abi Dawud',
    'tirmidhi': "Jami' at-Tirmidhi",
    'nasai': "Sunan an-Nasa'i",
    'ibnmajah': 'Sunan Ibn Majah',
}

ALBANI_FILES = {'abudawud': '1755gradings.txt', 'tirmidhi': '782gradings.txt', 'nasai': '783gradings.txt', 'ibnmajah': '810gradings.txt'}


class BuildError(Exception):
    pass


# ---------------------------------------------------------------- text helpers

MARKS = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭ]')
DIRECTION = re.compile(r'[‌-‏‪-‮⁦-⁩]')


def nfc(s):
    # Canonical form only (e.g. the order of shadda and fatha); the letters
    # and marks themselves are unchanged.
    return unicodedata.normalize('NFC', s)


def clean(s):
    """Drop invisible direction marks (they are layout hints, not text) and
    tidy the spaces they leave behind."""
    s = DIRECTION.sub('', s)
    return re.sub(r'[ \t]+', ' ', s).strip()


def letters(s):
    """Letters only: no vowel marks, one form of alif, ya and ta marbuta, no
    punctuation. Used to check that a dhikr is inside a hadith text."""
    s = MARKS.sub('', nfc(s)).replace('ـ', '')
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    s = re.sub(r'صلى الله عليه وسلم|ﷺ', ' ', s)
    s = re.sub(r'[^ء-ي]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def vowel_ratio(s):
    marks = len(MARKS.findall(s))
    base = len(re.findall(r'[ء-ي]', s))
    return marks / base if base else 0


def cut(text, start, end, where):
    """Return text from the first `start` to the end of the next `end`."""
    text, start, end = nfc(text), nfc(start), nfc(end)
    i = text.find(start)
    if i < 0:
        raise BuildError(f'{where}: start marker not found: {start!r}')
    j = text.find(end, i)
    if j < 0:
        raise BuildError(f'{where}: end marker not found: {end!r}')
    return text[i:j + len(end)]


# ---------------------------------------------------------------- loaders

class Hadith:
    def __init__(self, folder):
        self.folder = folder
        self.cache = {}

    def book(self, book, lang):
        key = (book, lang)
        if key not in self.cache:
            path = os.path.join(self.folder, f'{"ara" if lang == "ar" else "eng"}-{book}.json')
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            self.cache[key] = {str(h['hadithnumber']): h for h in data['hadiths']}
        return self.cache[key]

    def get(self, book, n):
        n = str(n)
        ar = self.book(book, 'ar').get(n)
        en = self.book(book, 'en').get(n)
        if not ar or not ar.get('text'):
            raise BuildError(f'{book} {n}: missing Arabic')
        ref = ar.get('reference') or {}
        number = ar.get('arabicnumber') or n
        return {
            'book': book,
            'n': n,
            'number': display_number(number),
            'ref': f"{ref.get('book')}/{ref.get('hadith')}",
            'ar': clean(ar['text']),
            'en': clean(en['text']) if en else '',
        }


def display_number(value):
    """1598 -> '1598'; 2723.02 -> '2723b' (sunnah.com style)."""
    s = str(value)
    if '.' not in s:
        return s
    whole, frac = s.split('.')
    k = int(frac.ljust(2, '0')[:2])
    return f'{whole}{chr(ord("a") + k - 1)}' if k > 0 else whole


def hadith_link(h):
    book, n = h['book'], h['n']
    if book == 'muslim' or '.' in n:
        return f'https://sunnah.com/{book}/{h["ref"]}'
    return f'https://sunnah.com/{book}:{n}'


class HadeethEnc:
    def __init__(self, folder):
        self.rows = {}
        for lang, version in SOURCES['he']['versions'].items():
            path = os.path.join(folder, f'HadeethEnc.com_{lang}-v{version}.xlsx')
            wb = openpyxl.load_workbook(path, read_only=True)
            rows = list(wb.worksheets[0].iter_rows(values_only=True))
            header = list(rows[1])
            table = {}
            for row in rows[2:]:
                if row and row[0] is not None and str(row[0]).isdigit():
                    table[str(row[0])] = dict(zip(header, ['' if c is None else str(c) for c in row]))
            self.rows[lang] = table

    def get(self, hid):
        hid = str(hid)
        ar = self.rows['ar'].get(hid)
        if not ar:
            raise BuildError(f'HadeethEnc {hid}: not in the Arabic file')
        out = {'id': hid, 'ar': ar['hadith_text'], 'link': {}}
        out['link']['ar'] = ar['link']
        for lang in ('en', 'fr'):
            row = self.rows[lang].get(hid)
            if row:
                out[lang] = row['hadith_text']
                out[f'{lang}_explanation'] = row['explanation']
                out['link'][lang] = row['link']
        return out


class Hisn:
    def __init__(self, folder):
        self.items = {}
        for lang in ('ar', 'en'):
            with open(os.path.join(folder, f'{lang}.json'), encoding='utf-8') as f:
                for chapter in json.load(f):
                    for item in chapter['array']:
                        self.items.setdefault(item['filename'], {})[lang] = item['text']

    def get(self, n):
        item = self.items.get(str(n))
        if not item or 'ar' not in item:
            raise BuildError(f'Hisn al-Muslim {n}: not found')
        return item


class Albani:
    """Al-Albani's own words on each hadith of the four Sunan."""

    START = re.compile(r'^\[?(\d+)\]? \| ?(.*)$')

    def __init__(self, folder):
        self.books = {}
        for book, name in ALBANI_FILES.items():
            table = {}
            current = None
            with open(os.path.join(folder, name), encoding='utf-8') as f:
                for line in f:
                    line = line.rstrip('\n')
                    m = self.START.match(line)
                    if m:
                        current = int(m.group(1))
                        text = m.group(2).replace('تحقيق الألباني:', '').strip()
                        table.setdefault(current, [])
                        if text not in table[current]:
                            table[current].append(text)
                    elif current is not None and line.strip():
                        table[current][-1] += ' ' + line.strip()
            self.books[book] = table

    def ruling(self, book, n):
        if '.' in str(n):
            return None  # extra narrations numbered 3604b etc. have no entry
        found = self.books[book].get(int(n))
        if not found:
            raise BuildError(f'{book} {n}: no ruling by al-Albani in his edition')
        if len(found) > 1:
            raise BuildError(f'{book} {n}: several rulings {found}')
        return found[0]


class Jami:
    """Sahih al-Jami' as-Saghir: number -> (text, grade)."""

    def __init__(self, folder):
        self.rows = {}
        for path in glob.glob(os.path.join(folder, 'sections', '*.toon')):
            with open(path, encoding='utf-8') as f:
                lines = f.read().split('\n')
            body = '\n'.join(line[2:] if line.startswith('  ') else line for line in lines[1:])
            for row in csv.reader(io.StringIO(body)):
                if len(row) >= 3 and row[0].isdigit():
                    self.rows[row[0]] = (row[1].strip().strip('«»').strip(), row[2].strip())

    def get(self, n):
        if str(n) not in self.rows:
            raise BuildError(f"Sahih al-Jami' {n}: not found")
        return self.rows[str(n)]


class Wabil:
    """Ibn al-Qayyim's al-Wabil as-Sayyib, OpenITI text. '~~' continues a
    paragraph and 'ms094' marks a page: both are markup, removed here."""

    def __init__(self, path):
        with open(path, encoding='utf-8') as f:
            raw = f.read()
        raw = raw.replace('\n~~', ' ')
        raw = re.sub(r'\bms\d+\b', ' ', raw)
        self.text = re.sub(r'[ \t]+', ' ', raw)


# ---------------------------------------------------------------- spec helpers
#
# A text source is one of:
#   H(book, n)     hadith-api (Arabic / sunnah.com English); Muslim by dataset number
#   HE(id)         HadeethEnc (Arabic / English / French)
#   HISN(n)        Hisn al-Muslim item n (Arabic / English)
#   SJ(n)          Sahih al-Jami' as-Saghir no. n (Arabic)
#   EXT(key)       a short text copied from a web page, see EXTERNAL
#
# X(source, lang, start, end) is an excerpt, W(source, lang) the whole text,
# MINE(text) a translation written for this page, J(a, '…', b) joins excerpts
# of one source ('…' marks words left out).

def H(book, n):
    return ('h', book, str(n))


def HE(i):
    return ('he', str(i))


def HISN(n):
    return ('hisn', str(n))


def SJ(n):
    return ('sj', str(n))


def EXT(key):
    return ('ext', key)


def X(source, lang, start, end=None):
    return ('x', source, lang, start, start if end is None else end)


def W(source, lang):
    return ('w', source, lang)


def MINE(text):
    return ('mine', text)


def J(*parts):
    return ('join', parts)


# Recited text. `inside` names the authentic hadith that must contain it;
# without it, the source itself is the hadith.
def AR(source, start, end=None, n=None, inside=None, own=False):
    return {'kind': 'ar', 'source': source, 'start': start, 'end': start if end is None else end, 'n': n, 'inside': inside, 'own': own}


def Q(surah, first, last):
    return {'kind': 'quran', 'ayat': [surah, first, last]}


BASMALA = {'kind': 'basmala'}

# Hadith outside the six books. `ar` is copied from the page at `url`, where
# al-Albani's ruling can be read; `jami` gives the number in Sahih al-Jami'
# when the build takes the text from there instead.
EXTERNAL = {
    'ubayy': {
        'ar': 'مَنْ قالَها حِينَ يُمسِي أُجِيرَ مِنَّا حتَى يُصْبِحَ ومَن قالَها حينَ يصبحُ أُجِيرَ مِنَّا حتى يُمسِي',
        'cite': "Ubayy ibn Ka'b and the jinn: an-Nasa'i (as-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/562)",
        'grade': 'Sahih',
        'where': 'Sahih at-Targhib 662',
        'url': 'https://surahquran.com/Hadith-100968.html',
    },
    'fatimah': {
        'jami': 5820,
        'cite': "Anas, the advice to Fatimah: an-Nasa'i (as-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/545)",
        'grade': 'Hasan',
        'where': "Sahih al-Jami' 5820, Sahih at-Targhib 661, as-Silsila as-Sahiha 227",
        'url': 'https://kalemtayeb.com/safahat/item/115307',
    },
    'fitrah': {
        'jami': 4674,
        'cite': "'Abd ar-Rahman ibn Abza: Ahmad (al-Musnad 3/406), Ibn as-Sunni ('Amal al-Yawm wa al-Layla 34)",
        'grade': 'Sahih',
        'where': "Sahih al-Jami' 4674",
        'url': 'https://surahquran.com/Hadith-96702.html',
    },
    'tahlil10': {
        'ar': 'من قال إذا أصبح : لا إله إلا اللهُ وحده لا شريك له ، له الملكُ ، و له الحمدُ ، و هو على كلِّ شيءٍ قديرٌ ( عشرَ مراتٍ )',
        'cite': "Abu Ayyub al-Ansari: Ahmad (al-Musnad 23518), an-Nasa'i ('Amal al-Yawm wa al-Layla 24)",
        'grade': 'Hasan Sahih',
        'where': 'Sahih at-Targhib 474',
        'url': 'https://surahquran.com/Hadith-97535.html',
    },
    'turning': {
        'jami': 4693,
        'cite': "'A'ishah: an-Nasa'i (as-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/540), Ibn Hibban, Ibn as-Sunni",
        'grade': 'Sahih',
        'where': "Sahih al-Jami' 4693, as-Silsila as-Sahiha 2066",
        'url': 'https://en.tohed.com/hadith/sahih-al-jami-al-saghir/4693/',
    },
    'evening3': {
        'jami': 6427,
        'cite': "Abu Hurayrah, three times in the evening: at-Tirmidhi 3604b, Ahmad, Ibn Hibban, al-Hakim",
        'grade': 'Sahih',
        'where': "Sahih at-Targhib 652, Sahih al-Jami' 6427",
        'url': 'https://surahquran.com/Hadith-67759.html',
    },
    'kursi_prayer': {
        'jami': 6464,
        'cite': "Abu Umamah: an-Nasa'i ('Amal al-Yawm wa al-Layla 100), at-Tabarani, Ibn as-Sunni",
        'grade': 'Sahih',
        'where': "Sahih al-Jami' 6464, as-Silsila as-Sahiha 972",
        'url': 'https://islamqa.info/ar/215945',
    },
}

# Al-Albani's ruling is more than "sahih" or "hasan" on these references. Each
# one was read and a decision recorded; an unlisted reservation stops the build.
REVIEWED = {
    ('abudawud', '5045'): 'count',   # sahih except the words "three times": said once on the page, with a note
    ('abudawud', '5090'): 'chain',   # "hasan al-isnad" for this hadith: kept, shown as a hasan chain
    ('tirmidhi', '3534'): 'hasan',   # "حسن صحيح الترغيب (1/160/472)": hasan, then the reference to Sahih at-Targhib
}
RESERVATION = ['دون', 'إلا', 'لكن', 'سوى', 'ضعيف', 'منكر', 'شاذ', 'موضوع', 'مدرج', 'موقوف', 'مقطوع', 'مرسل', 'لفظ', 'إسناد',
               'زيادة', 'ليس', 'خطأ', 'غلط', 'باطل', 'مضطرب', 'معلول', 'يصح', 'المحفوظ', 'الصواب', 'وهم', 'أصح', 'ملاحظة',
               'قوله', 'جملة', 'الأرجح', 'الراجح', 'نظر', 'يثبت', 'منقطع']

WHEN = ('wake', 'wake_night', 'morning_evening', 'morning', 'evening', 'day', 'day_night', 'night', 'bed', 'turning',
        'after_fajr', 'after_prayer', 'after_maghrib')
TABS = ('wake', 'morning', 'day', 'evening', 'night', 'prayer')

TAHLIL_FR = "Il n'y a de divinité [digne d'adoration] qu'Allah, Seul, sans associé. À Lui la royauté et à Lui la louange, et Il est capable de toute chose."

ITEMS = [
    # ================================================ waking up (Hisn al-Muslim, chapter 1)
    {
        'hisn': 1, 'tabs': ['wake'], 'count': 1, 'when': 'wake',
        'recite': [AR(H('bukhari', 6324), 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا', 'وَإِلَيْهِ النُّشُورُ')],
        'meaning': {
            'en': X(H('bukhari', 6324), 'en', 'All the Praises are for Allah Who has made us alive', 'unto Him is the Resurrection'),
            'fr': MINE("Louange à Allah qui nous a rendu la vie après nous avoir fait mourir, et c'est vers Lui qu'est la résurrection."),
        },
        'primary': H('bukhari', 6324),
        'when_ar': [X(H('bukhari', 6324), 'ar', 'وَإِذَا اسْتَيْقَظَ مِنْ مَنَامِهِ قَالَ')],
        'about': {
            'en': X(H('bukhari', 6324), 'en', 'And when he woke up from his sleep, he would say'),
            'fr': MINE('Et lorsqu’il se réveillait de son sommeil, il disait : …'),
        },
        'refs': [H('bukhari', 6324), H('bukhari', 6312), H('muslim', 6887)],
    },
    {
        'hisn': 3, 'tabs': ['wake'], 'count': 1, 'when': 'wake',
        'recite': [AR(H('tirmidhi', 3401), 'الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي', 'وَأَذِنَ لِي بِذِكْرِهِ')],
        'meaning': {
            'en': X(HISN(3), 'en', 'All praise is for Allah who restored to me my health', 'allowed me to remember Him.'),
            'fr': MINE("Louange à Allah qui m'a accordé la santé dans mon corps, m'a rendu mon âme et m'a permis de L'évoquer."),
        },
        'primary': H('tirmidhi', 3401),
        'when_ar': [X(H('tirmidhi', 3401), 'ar', 'فَإِذَا اسْتَيْقَظَ فَلْيَقُلِ')],
        'about': {
            'en': MINE('And when he wakes up, let him say: …'),
            'fr': MINE('Et lorsqu’il se réveille, qu’il dise : …'),
        },
        'refs': [H('tirmidhi', 3401)],
    },
    {
        'hisn': 2, 'tabs': ['wake'], 'count': 1, 'when': 'wake_night',
        'recite': [
            AR(H('bukhari', 1154), 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ', 'وَلاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ'),
            AR(H('bukhari', 1154), 'اللَّهُمَّ اغْفِرْ لِي'),
        ],
        'meaning': {
            'en': X(H('bukhari', 1154), 'en', 'None has the right to be worshipped but Allah. He is the Only One', 'O Allah! Forgive me)'),
            'fr': MINE(TAHLIL_FR + " Louange à Allah, gloire et pureté à Allah, il n'y a de divinité [digne d'adoration] qu'Allah, Allah est le plus Grand, et il n'y a de force ni de puissance que par Allah. Puis : Ô Allah ! Pardonne-moi."),
        },
        'primary': H('bukhari', 1154),
        'when_ar': [X(H('bukhari', 1154), 'ar', 'مَنْ تَعَارَّ مِنَ اللَّيْلِ فَقَالَ')],
        'about': {
            'en': X(H('bukhari', 1154), 'en', 'Or invokes (Allah), he will be responded to', 'his prayer will be accepted'),
            'fr': MINE("Celui qui se réveille la nuit et dit cela, puis dit : « Ô Allah ! Pardonne-moi », ou invoque, est exaucé ; et s'il fait ses ablutions et prie, sa prière est acceptée."),
        },
        'refs': [H('bukhari', 1154)],
    },
    {
        'hisn': 4, 'tabs': ['wake'], 'count': 1, 'when': 'wake_night',
        'name': 'imran_end',
        'recite': [Q(3, 190, 200)],
        'meaning': 'quran',
        'primary': H('bukhari', 183),
        'when_ar': [X(H('bukhari', 183), 'ar', 'اسْتَيْقَظَ رَسُولُ اللَّهِ', 'مِنْ سُورَةِ آلِ عِمْرَانَ')],
        'about': {
            'en': X(H('bukhari', 183), 'en', "Allah's Messenger (ﷺ) slept till the middle of the night", 'then stood up to offer the prayer.'),
            'fr': MINE("Le Messager d'Allah ﷺ dormit jusqu'au milieu de la nuit, un peu avant ou un peu après, puis se réveilla ; il s'assit en essuyant de sa main le sommeil de son visage, puis récita les dix derniers versets de la sourate Âl 'Imrân. Il se leva ensuite vers une outre suspendue, fit soigneusement ses ablutions, puis se mit à prier."),
        },
        'refs': [H('bukhari', 183), H('muslim', 1789)],
    },
    # ================================================ morning and evening (chapter 27)
    {
        'hisn': 75, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'name': 'ayat_kursi',
        'recite': [AR(HISN(75), 'أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ', own=True), Q(2, 255, 255)],
        'meaning': 'quran',
        'primary': EXT('ubayy'),
        'when_ar': [W(EXT('ubayy'), 'ar')],
        'about': {
            'en': MINE('Whoever says it in the evening is protected from us [the jinn] until the morning, and whoever says it in the morning is protected from us until the evening.'),
            'fr': MINE("Celui qui la dit le soir est protégé de nous [les djinns] jusqu'au matin, et celui qui la dit le matin est protégé de nous jusqu'au soir."),
        },
        'refs': [EXT('ubayy')],
    },
    {
        'hisn': 76, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'name': 'muawwidhat',
        'recite': [BASMALA, Q(112, 1, 4), BASMALA, Q(113, 1, 5), BASMALA, Q(114, 1, 6)],
        'meaning': 'quran',
        'primary': HE(6082),
        'when_ar': [X(HE(6082), 'ar', 'حِينَ تُمْسِي', 'وَتُصْبِحُ')],
        'count_ar': X(HE(6082), 'ar', 'ثَلَاثَ مَرَّاتٍ'),
        'about': {
            'en': X(HE(6082), 'en', '{Say:', 'protection from everything.'),
            'fr': X(HE(6082), 'fr', '{" Dis', 'pour tout !'),
        },
        'refs': [H('abudawud', 5082), H('tirmidhi', 3575)],
    },
    {
        'hisn': 77, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        # The morning wording is Hisn al-Muslim's: the evening wording of Muslim
        # with "this day" for "this night", as the hadith itself opens it.
        'recite': [AR(HISN(77), 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ', 'وَعَذَابٍ فِي الْقَبْرِ', own=True)],
        'recite_evening': [
            AR(H('muslim', 6908), 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ', 'لاَ شَرِيكَ لَهُ'),
            AR(H('muslim', 6908), 'لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ', 'وَعَذَابٍ فِي الْقَبْرِ'),
        ],
        'meaning': {
            'en': X(HISN(77), 'en', 'We have reached the morning', 'punishment in the grave.'),
            'fr': MINE("Nous nous retrouvons au matin, ainsi que la royauté, appartenant à Allah ; les louanges sont pour Allah, il n'est de divinité [digne d'adoration] excepté Allah, Lui Seul, Il n'a point d'associé. À Lui la royauté, à Lui les louanges et Il est capable de toute chose. Ô Seigneur ! Je Te demande le meilleur de ce qui se trouve dans ce jour et le meilleur de ce qui vient après. Et je cherche protection auprès de Toi contre le mal de ce qui se trouve dans ce jour et le mal de ce qui vient après. Ô Seigneur ! Je cherche protection auprès de Toi contre la paresse et les maux de la vieillesse. Ô Seigneur ! Je cherche protection auprès de Toi contre le châtiment du Feu et le châtiment de la tombe."),
        },
        'meaning_evening': {
            'en': J(X(HE(3008), 'en', 'The evening has reached', 'alone without any partner.'), X(HE(3008), 'en', 'To Him belongs the dominion', 'torment in the grave.')),
            'fr': J(X(HE(3008), 'fr', 'Nous nous retrouvons au soir', 'point d’associé.'), X(HE(3008), 'fr', 'A Lui la royauté', 'châtiment de la tombe.')),
        },
        'primary': HE(3008),
        'when_ar': [X(H('muslim', 6908), 'ar', 'إِذَا أَمْسَى قَالَ'), X(H('muslim', 6908), 'ar', 'وَإِذَا أَصْبَحَ قَالَ ذَلِكَ أَيْضًا')],
        'about': {
            'en': X(HE(3008), 'en', 'In the evening, the Prophet', 'used to say'),
            'fr': X(HE(3008), 'fr', 'Lorsque le Prophète', 'il disait'),
        },
        'notes': [{
            'tabs': ['morning'],
            'label': {'en': 'Morning wording', 'fr': 'Formule du matin'},
            'ar': X(H('muslim', 6908), 'ar', 'وَإِذَا أَصْبَحَ قَالَ ذَلِكَ أَيْضًا', 'وَأَصْبَحَ الْمُلْكُ لِلَّهِ'),
            'en': MINE('Muslim gives the evening wording, then: "and in the morning he said that too: Asbahna wa asbaha al-mulku lillah". The morning wording shown here is the one of Hisn al-Muslim, with "this day" in place of "this night".'),
            'fr': MINE("Muslim donne la formule du soir, puis : « et au matin il disait cela aussi : Asbahnâ wa asbaha l-mulku liLlâh ». La formule du matin affichée ici est celle de Hisn al-Muslim, avec « ce jour » à la place de « cette nuit »."),
        }],
        'refs': [H('muslim', 6908)],
    },
    {
        'hisn': 78, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [AR(H('abudawud', 5068), 'اللَّهُمَّ بِكَ أَصْبَحْنَا', 'وَإِلَيْكَ النُّشُورُ')],
        'recite_evening': [AR(H('ibnmajah', 3868), 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا', 'وَإِلَيْكَ الْمَصِيرُ')],
        'meaning': {
            'en': X(HE(5490), 'en', 'O Allah, by You we have reached the morning', 'to You is the Resurrection.'),
            'fr': MINE("Ô Allah ! C'est par Toi que nous nous retrouvons au matin, par Toi que nous nous retrouvons au soir, par Toi que nous vivons, par Toi que nous mourons, et vers Toi est la résurrection."),
        },
        'meaning_evening': {
            'en': X(HISN(78), 'en', 'O Allah, by Your leave we have reached the evening', 'unto You is our return.'),
            'fr': MINE("Ô Allah ! C'est par Toi que nous nous retrouvons au soir, par Toi que nous nous retrouvons au matin, par Toi que nous vivons, par Toi que nous mourons, et vers Toi est le retour."),
        },
        'primary': H('abudawud', 5068),
        'when_ar': [X(H('abudawud', 5068), 'ar', 'كَانَ يَقُولُ إِذَا أَصْبَحَ'), X(H('ibnmajah', 3868), 'ar', 'وَإِذَا أَمْسَيْتُمْ فَقُولُوا')],
        'about': {
            'en': X(HE(5490), 'en', 'Upon reaching the morning, he used to say'),
            'fr': MINE("Il disait cela lorsqu'il se retrouvait au matin ; et : « quand vous vous retrouvez au soir, dites : … »"),
        },
        'refs': [H('abudawud', 5068), H('ibnmajah', 3868), H('tirmidhi', 3391)],
    },
    {
        'hisn': 79, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'day_night',
        'name': 'sayyid_istighfar',
        'recite': [AR(HE(5503), 'اللَّهُمَّ أَنْتَ رَبِّي', 'لاَ يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ', inside=H('bukhari', 6306))],
        'meaning': {
            'en': X(HISN(79), 'en', 'O Allah, You are my Lord', 'none can forgive sin except You.'),
            'fr': MINE("Ô Allah ! Tu es mon Seigneur, il n'y a de divinité [digne d'adoration] que Toi. Tu m'as créé et je suis Ton serviteur. Je reste fidèle à Ton engagement et à Ta promesse autant que je le peux. Je cherche protection auprès de Toi contre le mal de ce que j'ai fait. Je reconnais devant Toi Ton bienfait envers moi, et je reconnais devant Toi mon péché. Pardonne-moi donc, car nul ne pardonne les péchés à part Toi."),
        },
        'primary': HE(5503),
        'when_ar': [X(HE(5503), 'ar', 'وَمَنْ قَالَهَا مِنَ النَّهَارِ'), X(HE(5503), 'ar', 'وَمَنْ قَالَهَا مِنَ اللَّيْلِ')],
        'about': {
            'en': X(HE(5503), 'en', 'And whoever says this during the day', 'from the people of Paradise."'),
            'fr': MINE("Celui qui la dit pendant la journée en étant convaincu de son contenu, puis meurt ce jour-là avant le soir, fait partie des gens du Paradis ; et celui qui la dit pendant la nuit en étant convaincu de son contenu, puis meurt avant le matin, fait partie des gens du Paradis."),
        },
        'refs': [H('bukhari', 6306)],
    },
    {
        'hisn': 82, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'recite': [
            AR(H('abudawud', 5090), 'اللَّهُمَّ عَافِنِي فِي بَدَنِي', 'فِي بَصَرِي لاَ إِلَهَ إِلاَّ أَنْتَ'),
            AR(H('abudawud', 5090), 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ', 'مِنْ عَذَابِ الْقَبْرِ لاَ إِلَهَ إِلاَّ أَنْتَ'),
        ],
        'meaning': {
            'en': J(X(H('abudawud', 5090), 'en', 'O Allah! Grant me health in my body', 'There is no god but Thou.'),
                    X(H('abudawud', 5090), 'en', 'O Allah! I seek refuge in Thee from infidelity', 'There is no god but Thee')),
            'fr': MINE("Ô Allah ! Accorde la santé à mon corps. Ô Allah ! Accorde la santé à mon ouïe. Ô Allah ! Accorde la santé à ma vue. Il n'y a de divinité [digne d'adoration] que Toi. Ô Allah ! Je cherche protection auprès de Toi contre la mécréance et la pauvreté. Ô Allah ! Je cherche protection auprès de Toi contre le châtiment de la tombe. Il n'y a de divinité [digne d'adoration] que Toi."),
        },
        'primary': H('abudawud', 5090),
        'when_ar': [X(H('abudawud', 5090), 'ar', 'تُعِيدُهَا ثَلاَثًا حِينَ تُصْبِحُ', 'وَثَلاَثًا حِينَ تُمْسِي')],
        'count_ar': X(H('abudawud', 5090), 'ar', 'تُعِيدُهَا ثَلاَثًا حِينَ تُصْبِحُ', 'وَثَلاَثًا حِينَ تُمْسِي'),
        'about': {
            'en': X(H('abudawud', 5090), 'en', 'You repeat them three times in the morning', 'I like to follow his practice.'),
            'fr': MINE("'Abd ar-Rahmân ibn Abî Bakrah dit à son père : « Tu les répètes trois fois le matin et trois fois le soir. » Il répondit : « J'ai entendu le Messager d'Allah ﷺ invoquer par ces paroles, et j'aime suivre sa sunna. »"),
        },
        'refs': [H('abudawud', 5090)],
    },
    {
        'hisn': 84, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [AR(H('ibnmajah', 3871), 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا', 'أَنْ أُغْتَالَ مِنْ تَحْتِي')],
        'meaning': {
            'en': X(HISN(84), 'en', 'O Allah, I ask You for pardon', 'swallowed up by the earth.'),
            'fr': MINE("Ô Allah ! Je Te demande le pardon et la préservation dans ce monde et dans l'au-delà. Ô Allah ! Je Te demande le pardon et la préservation dans ma religion, ma vie d'ici-bas, ma famille et mes biens. Ô Allah ! Couvre mes défauts, rassure-moi dans mes frayeurs et protège-moi par devant, par derrière, à ma droite, à ma gauche et au-dessus de moi ; et je cherche refuge auprès de Toi contre le fait d'être pris par surprise par en dessous."),
        },
        'primary': H('ibnmajah', 3871),
        'when_ar': [X(H('ibnmajah', 3871), 'ar', 'حِينَ يُمْسِي وَحِينَ يُصْبِحُ')],
        'about': {
            'en': X(HE(5485), 'en', 'The Messenger of Allah', 'in the evening and the morning'),
            'fr': MINE("Le Messager d'Allah ﷺ ne délaissait jamais ces invocations, le soir et le matin."),
        },
        'refs': [H('ibnmajah', 3871), H('abudawud', 5074)],
    },
    {
        'hisn': 85, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [AR(H('tirmidhi', 3529), 'اللَّهُمَّ فَاطِرَ السَّمَوَاتِ', 'أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ')],
        'meaning': {
            'en': X(H('tirmidhi', 3529), 'en', 'O Allah, Creator of the heavens and the earth', 'or bring it upon a Muslim'),
            'fr': MINE("Ô Allah ! Créateur des cieux et de la terre, Connaisseur de l'invisible et du visible, il n'y a de divinité [digne d'adoration] que Toi, Seigneur et Maître de toute chose. Je cherche protection auprès de Toi contre le mal de mon âme, contre le mal du diable et de son piège [autre lecture : de son polythéisme], et contre le fait de commettre un mal contre moi-même ou de le faire subir à un musulman."),
        },
        'primary': H('tirmidhi', 3529),
        'when_ar': [X(H('tirmidhi', 3529), 'ar', 'عَلِّمْنِي مَا أَقُولُ إِذَا أَصْبَحْتُ وَإِذَا أَمْسَيْتُ')],
        'about': {
            'en': X(H('tirmidhi', 3529), 'en', 'O Messenger of Allah, teach me what to say at morning and afternoon.'),
            'fr': MINE("Abû Bakr as-Siddîq dit : « Ô Messager d'Allah ! Apprends-moi ce que je dois dire quand je me retrouve au matin et quand je me retrouve au soir. »"),
        },
        'refs': [H('tirmidhi', 3529), H('tirmidhi', 3392), H('abudawud', 5067)],
    },
    {
        'hisn': 86, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'recite': [AR(HISN(86), 'بِسْمِ اللَّهِ الَّذِي', 'السَّمِيعُ الْعَلِيمُ', inside=H('abudawud', 5088))],
        'meaning': {
            'en': X(HE(6093), 'en', 'In the name of Allah, with Whose name', 'the All-Knowing'),
            'fr': MINE("Au nom d'Allah, avec le nom duquel rien ne peut nuire, ni sur la terre ni dans le ciel, et Il est Celui qui entend tout, l'Omniscient."),
        },
        'primary': HE(6093),
        'when_ar': [X(H('tirmidhi', 3388), 'ar', 'فِي صَبَاحِ كُلِّ يَوْمٍ وَمَسَاءِ كُلِّ لَيْلَةٍ')],
        'count_ar': X(H('tirmidhi', 3388), 'ar', 'ثَلاَثَ مَرَّاتٍ'),
        'about': {
            'en': X(HE(6093), 'en', 'Whoever says three times', 'until the evening.'),
            'fr': MINE("Celui qui la dit trois fois ne sera pas frappé par un malheur soudain jusqu'au matin, et celui qui la dit trois fois le matin ne sera pas frappé par un malheur soudain jusqu'au soir."),
        },
        'refs': [H('abudawud', 5088), H('tirmidhi', 3388), H('ibnmajah', 3869)],
    },
    {
        'hisn': 88, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [AR(HISN(88), 'يَا حَيُّ يَا قَيُّومُ', 'طَرْفَةَ عَيْنٍ', inside=EXT('fatimah'))],
        'meaning': {
            'en': X(HISN(88), 'en', 'O Ever Living', 'the blink of an eye.'),
            'fr': MINE("Ô Vivant ! Ô Toi qui subsistes par Toi-même et fais subsister toute chose ! C'est par Ta miséricorde que je demande secours : arrange pour moi toutes mes affaires et ne me confie pas à moi-même, ne serait-ce que le temps d'un clin d'œil."),
        },
        'primary': EXT('fatimah'),
        'when_ar': [X(EXT('fatimah'), 'ar', 'أن تقولي إذا أصبحت وإذا أمسيت')],
        'about': {
            'en': MINE('The Prophet ﷺ said to Fatimah: "What keeps you from listening to my advice? That you say, when you reach the morning and when you reach the evening: …"'),
            'fr': MINE("Le Prophète ﷺ dit à Fâtimah : « Qu'est-ce qui t'empêche d'écouter mon conseil ? Que tu dises, quand tu te retrouves au matin et quand tu te retrouves au soir : … »"),
        },
        'refs': [EXT('fatimah')],
    },
    {
        'hisn': 90, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        # Hisn al-Muslim gives Ahmad's wording (with "wa 'ala" repeated and the
        # salat on the Prophet); Sahih al-Jami' 4674 has the same words without them.
        'recite': [AR(HISN(90), 'أَصْبَحْنا عَلَى فِطْرَةِ', 'مِنَ الْمُشرِكِينَ', own=True)],
        'meaning': {
            'en': X(HISN(90), 'en', 'We rise upon the fitrah of Islam', 'associate others with Allah.'),
            'fr': MINE("Nous nous retrouvons au matin sur la saine nature (fitra) de l'islam, sur la parole de la sincérité, sur la religion de notre Prophète Muhammad ﷺ et sur la voie de notre père Ibrâhîm, monothéiste pur, soumis [à Allah], et qui n'était pas du nombre des associateurs."),
        },
        'primary': EXT('fitrah'),
        'when_ar': [X(EXT('fitrah'), 'ar', 'كان إذا أصبح وإذا أمسى قال')],
        'about': {
            'en': MINE('When morning came and when evening came, he ﷺ would say: …'),
            'fr': MINE("Lorsqu'il se retrouvait au matin et lorsqu'il se retrouvait au soir, il ﷺ disait : …"),
        },
        'notes': [
            {
                'tabs': ['evening'], 'face': True,
                'label': {'en': 'In the evening', 'fr': 'Le soir'},
                'en': X(HISN(90), 'en', 'Note: for the evening', 'instead of asbahna.'),
                'fr': MINE('Hisn al-Muslim : le soir, on dit « amsaynâ » au lieu de « asbahnâ ».'),
            },
            {
                'label': {'en': 'Wording', 'fr': 'Formule'},
                'ar': W(EXT('fitrah'), 'ar'),
                'en': MINE("The wording shown is the one of Hisn al-Muslim, from Ahmad's Musnad. Sahih al-Jami' 4674 has the same words without the repeated \"wa 'ala\":"),
                'fr': MINE("La formule affichée est celle de Hisn al-Muslim, d'après le Musnad d'Ahmad. Sahîh al-Jâmi' 4674 a les mêmes mots sans la répétition de « wa 'alâ » :"),
            },
        ],
        'refs': [EXT('fitrah')],
    },
    {
        'hisn': 91, 'tabs': ['morning', 'evening'], 'count': 100, 'when': 'morning_evening',
        'recite': [AR(HISN(91), 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', inside=H('muslim', 6843))],
        'meaning': {
            'en': X(HISN(91), 'en', 'How perfect Allah is and I praise Him.'),
            'fr': MINE('Gloire et pureté à Allah, et par Sa louange.'),
        },
        'primary': H('muslim', 6843),
        'when_ar': [X(H('muslim', 6843), 'ar', 'حِينَ يُصْبِحُ وَحِينَ يُمْسِي')],
        'count_ar': X(H('muslim', 6843), 'ar', 'مِائَةَ مَرَّةٍ'),
        'about': {
            'en': X(H('muslim', 6843), 'en', 'He who recites in the morning', 'more than these words'),
            'fr': MINE("Celui qui dit le matin et le soir « Subhâna Llâhi wa bi-hamdih » cent fois, personne ne viendra le Jour de la Résurrection avec quelque chose de meilleur que ce qu'il apportera, sauf quelqu'un qui aura dit la même chose ou davantage."),
        },
        'refs': [H('muslim', 6843)],
    },
    {
        'hisn': 92, 'tabs': ['morning', 'evening'], 'count': 10, 'when': 'morning_evening',
        'recite': [AR(HISN(92), 'لاَ إِلَهَ إِلاَّ اللَّهُ', 'قَدِيرٌ', inside=H('abudawud', 5077))],
        'meaning': {
            'en': X(HISN(92), 'en', 'None has the right to be worshipped', 'over all things omnipotent.'),
            'fr': MINE(TAHLIL_FR),
        },
        'primary': H('abudawud', 5077),
        'when_ar': [X(H('abudawud', 5077), 'ar', 'مَنْ قَالَ إِذَا أَصْبَحَ'), X(H('abudawud', 5077), 'ar', 'وَإِنْ قَالَهَا إِذَا أَمْسَى')],
        'count_ar': X(EXT('tahlil10'), 'ar', 'عشرَ مراتٍ'),
        'about': {
            'en': X(H('abudawud', 5077), 'en', 'If anyone says in the morning', 'till the morning.'),
            'fr': MINE("Celui qui la dit le matin aura l'équivalent [de la récompense] de l'affranchissement d'un esclave parmi les descendants d'Ismâ'îl ; dix bonnes actions lui seront inscrites, dix mauvaises actions lui seront effacées, il sera élevé de dix degrés et il sera protégé du diable jusqu'au soir. Et s'il la dit le soir, il aura la même chose jusqu'au matin."),
        },
        'notes': [{
            'face': True,
            'label': {'en': 'Count', 'fr': 'Nombre'},
            'en': MINE('Ten times in the hadith of Abu Ayyub (Sahih at-Targhib 474). The reward below is for saying it once (Abu Dawud 5077).'),
            'fr': MINE("Dix fois dans le hadith d'Abû Ayyûb (Sahîh at-Targhîb 474). La récompense ci-dessous est pour celui qui la dit une fois (Abû Dâwud 5077)."),
        }],
        'refs': [H('abudawud', 5077), H('ibnmajah', 3867), EXT('tahlil10')],
    },
    {
        'hisn': 94, 'tabs': ['morning'], 'count': 3, 'when': 'morning',
        'recite': [AR(HISN(94), 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'وَمِدَادَ كَلِمَاتِهِ', inside=H('muslim', 6913))],
        'meaning': {
            'en': X(HISN(94), 'en', 'How perfect Allah is and I praise Him by the number', 'the ink of His words.'),
            'fr': MINE("Gloire et pureté à Allah, et par Sa louange, autant que le nombre de Ses créatures, autant qu'il Lui plaît, autant que le poids de Son Trône et autant que l'encre de Ses paroles."),
        },
        'primary': HE(5508),
        'when_ar': [X(HE(5508), 'ar', 'بُكْرَةً حِينَ صَلَّى الصُّبْحَ')],
        'count_ar': X(H('muslim', 6913), 'ar', 'ثَلاَثَ مَرَّاتٍ'),
        'about': {
            'en': X(HE(5508), 'en', 'I said four words three times after I had left you', 'they would outweigh them'),
            'fr': MINE("J'ai dit après toi quatre paroles, trois fois ; si on les pesait contre tout ce que tu as dit depuis ce matin, elles l'emporteraient."),
        },
        'refs': [H('muslim', 6913)],
    },
    {
        'hisn': 95, 'tabs': ['morning'], 'count': 1, 'when': 'after_fajr',
        'recite': [AR(HISN(95), 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً', 'مُتَقَبَّلاً', inside=H('ibnmajah', 925))],
        'meaning': {
            'en': X(HISN(95), 'en', 'O Allah, I ask You for knowledge', 'deeds which are acceptable.'),
            'fr': MINE('Ô Allah ! Je Te demande une science utile, une subsistance bonne et des œuvres acceptées.'),
        },
        'primary': H('ibnmajah', 925),
        'when_ar': [X(H('ibnmajah', 925), 'ar', 'إِذَا صَلَّى الصُّبْحَ حِينَ يُسَلِّمُ')],
        'about': {
            'en': X(H('ibnmajah', 925), 'en', 'It was narrated from Umm Salamah', 'he would say'),
            'fr': MINE("Lorsque le Prophète ﷺ priait la prière du matin (Subh), au moment du salut final, il disait : …"),
        },
        'refs': [H('ibnmajah', 925)],
    },
    {
        'hisn': 97, 'tabs': ['evening'], 'count': 3, 'when': 'evening',
        'recite': [AR(HISN(97), 'أَعُوذُ بِكَلِمَاتِ اللَّهِ', 'مَا خَلَقَ', inside=H('muslim', 6880))],
        'meaning': {
            'en': X(HISN(97), 'en', 'I take refuge in Allah', 'the evil He has created.'),
            'fr': MINE("Je cherche refuge auprès des paroles parfaites d'Allah contre le mal de ce qu'Il a créé."),
        },
        'primary': H('muslim', 6880),
        'when_ar': [X(H('muslim', 6880), 'ar', 'حِينَ أَمْسَيْتَ')],
        'count_ar': X(HE(66086), 'ar', 'مَنْ قَالَ حِينَ يُمْسِي ثَلاَثَ مَرَّاتٍ'),
        'about': {
            'en': X(H('muslim', 6880), 'en', 'Had you recited these words in the evening', 'would not have done any harm to you'),
            'fr': MINE("Si tu avais dit, en arrivant au soir : « Je cherche refuge auprès des paroles parfaites d'Allah contre le mal de ce qu'Il a créé », il [le scorpion] ne t'aurait pas nui."),
        },
        'notes': [{
            'label': {'en': 'Count', 'fr': 'Nombre'},
            'ar': W(HE(66086), 'ar'),
            'en': X(H('tirmidhi', '3604.02'), 'en', 'Whoever says three times when he reaches the evening', 'shall harm him that night.'),
            'fr': MINE("Celui qui dit trois fois, en arrivant au soir : « Je cherche refuge auprès des paroles parfaites d'Allah contre le mal de ce qu'Il a créé », aucune piqûre venimeuse ne lui nuira cette nuit-là."),
        }],
        'refs': [H('muslim', 6880), EXT('evening3'), H('ibnmajah', 3518)],
    },
    # ================================================ any time of the day
    {
        'hisn': 93, 'tabs': ['day'], 'count': 100, 'when': 'day',
        'recite': [AR(HISN(93), 'لاَ إِلَهَ إِلاَّ اللَّهُ', 'قَدِيرٌ', inside=HE(65905))],
        'meaning': {
            'en': X(HISN(93), 'en', 'None has the right to be worshipped', 'over all things omnipotent.'),
            'fr': MINE(TAHLIL_FR),
        },
        'primary': HE(65905),
        'when_ar': [X(HE(65905), 'ar', 'فِي يَوْمٍ مِائَةَ مَرَّةٍ'), X(HE(65905), 'ar', 'يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ')],
        'count_ar': X(HE(65905), 'ar', 'فِي يَوْمٍ مِائَةَ مَرَّةٍ'),
        'about': {
            'en': X(HE(65905), 'en', 'Whoever says a hundred times in a day', 'someone who says more than that.'),
            'fr': MINE("Celui qui la dit cent fois dans une journée aura l'équivalent de l'affranchissement de dix esclaves ; cent bonnes actions lui seront inscrites, cent mauvaises actions lui seront effacées, et ce sera pour lui une protection contre le diable ce jour-là jusqu'au soir ; et personne n'apportera mieux que ce qu'il a apporté, sauf quelqu'un qui en aura fait davantage."),
        },
        'notes': [{
            'label': {'en': 'In Hisn al-Muslim', 'fr': 'Dans Hisn al-Muslim'},
            'en': MINE('Hisn al-Muslim lists it with the morning adhkar («مائة مرة إذا أصبح»); the hadith says «فِي يَوْمٍ», "in a day".'),
            'fr': MINE("Hisn al-Muslim le place avec les adhkar du matin («مائة مرة إذا أصبح») ; le hadith dit «فِي يَوْمٍ», « dans une journée »."),
        }],
        'refs': [H('bukhari', 3293), H('muslim', 6842)],
    },
    {
        'hisn': 96, 'tabs': ['day'], 'count': 100, 'when': 'day',
        'recite': [AR(HISN(96), 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', inside=H('bukhari', 6307))],
        'meaning': {
            'en': X(HE(4808), 'en', 'I ask Allah for forgiveness and repent to Him'),
            'fr': X(HE(4808), 'fr', 'Je demande certes pardon à Allah et me repens à Lui'),
        },
        'primary': HE(4808),
        'when_ar': [X(H('muslim', 6858), 'ar', 'فِي الْيَوْمِ مِائَةَ مَرَّةٍ')],
        'count_ar': X(H('muslim', 6858), 'ar', 'فِي الْيَوْمِ مِائَةَ مَرَّةٍ'),
        'about': {
            'en': X(HE(4808), 'en', 'By Allah! I ask Allah', 'seventy times a day.'),
            'fr': X(HE(4808), 'fr', 'Par Allah ! Je demande', 'dans la journée.'),
        },
        'notes': [{
            'label': {'en': 'Count', 'fr': 'Nombre'},
            'en': J(MINE('"More than seventy times" in al-Bukhari 6307; a hundred in Muslim 2702:'), X(H('muslim', 6858), 'en', 'I seek forgiveness from Allah a hundred times a day')),
            'fr': MINE("« Plus de soixante-dix fois » dans al-Bukhârî 6307 ; cent fois dans Muslim 2702 : « je demande pardon à Allah cent fois par jour »."),
        }],
        'refs': [H('bukhari', 6307), H('muslim', 6858)],
    },
    # ================================================ after the prayer (chapter 25)
    {
        'hisn': 66, 'tabs': ['prayer'], 'group': 'each', 'when': 'after_prayer',
        'recite': [
            AR(H('muslim', 1334), 'أَسْتَغْفِرُ اللَّهَ', n=3),
            AR(H('muslim', 1334), 'اللَّهُمَّ أَنْتَ السَّلاَمُ', 'وَالإِكْرَامِ', n=1),
        ],
        'meaning': {
            'en': X(HISN(66), 'en', 'I ask Allah for forgiveness.', 'O Possessor of majesty and honour.'),
            'fr': MINE("Je demande pardon à Allah (trois fois). Ô Allah ! Tu es la Paix et de Toi vient la paix. Béni sois-Tu, ô Détenteur de la majesté et de la générosité."),
        },
        'primary': H('muslim', 1334),
        'when_ar': [X(H('muslim', 1334), 'ar', 'إِذَا انْصَرَفَ مِنْ صَلاَتِهِ')],
        'count_ar': X(H('muslim', 1334), 'ar', 'اسْتَغْفَرَ ثَلاَثًا'),
        'about': {
            'en': X(H('muslim', 1334), 'en', 'When the Messenger of Allah (ﷺ) finished his prayer', 'three times and said'),
            'fr': MINE("Lorsque le Messager d'Allah ﷺ terminait sa prière, il demandait pardon trois fois puis disait : …"),
        },
        'refs': [H('muslim', 1334)],
    },
    {
        'hisn': 67, 'tabs': ['prayer'], 'group': 'each', 'count': 1, 'when': 'after_prayer',
        'recite': [AR(H('bukhari', 844), 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ', 'مِنْكَ الْجَدُّ')],
        'meaning': {
            'en': X(HE(65102), 'en', 'There is no god but Allah, alone', 'against You'),
            'fr': X(HE(65102), 'fr', "Il n'y a aucune divinité", 'contre Toi.'),
        },
        'primary': HE(65102),
        'when_ar': [X(H('bukhari', 844), 'ar', 'كَانَ يَقُولُ فِي دُبُرِ كُلِّ صَلاَةٍ مَكْتُوبَةٍ')],
        'about': {
            'en': X(HE(65102), 'en', 'The Prophet', 'after every obligatory prayer'),
            'fr': X(HE(65102), 'fr', 'Le Prophète', 'après chaque prière obligatoire'),
        },
        'refs': [H('bukhari', 844), H('muslim', 1338)],
    },
    {
        'hisn': 68, 'tabs': ['prayer'], 'group': 'each', 'count': 1, 'when': 'after_prayer',
        'recite': [AR(H('muslim', 1343), 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ', 'وَلَوْ كَرِهَ الْكَافِرُونَ')],
        'meaning': {
            'en': X(HE(6203), 'en', 'There is no god but Allah, alone, with no partner.', 'even if the disbelievers'),
            'fr': X(HE(6203), 'fr', "Il n'est de divinité qu'Allah, Seul", 'les mécréants.'),
        },
        'primary': HE(6203),
        'when_ar': [X(H('muslim', 1343), 'ar', 'كَانَ ابْنُ الزُّبَيْرِ يَقُولُ فِي دُبُرِ كُلِّ صَلاَةٍ حِينَ يُسَلِّمُ'),
                    X(H('muslim', 1343), 'ar', 'كَانَ رَسُولُ اللَّهِ صلى الله عليه وسلم يُهَلِّلُ بِهِنَّ دُبُرَ كُلِّ صَلاَةٍ')],
        'about': {
            'en': X(HE(6203), 'en', 'The Messenger of Allah', 'after every prayer'),
            'fr': X(HE(6203), 'fr', "Le Messager d'Allah", 'après chaque prière.'),
        },
        'refs': [H('muslim', 1343)],
    },
    {
        'hisn': 69, 'tabs': ['prayer'], 'group': 'each', 'when': 'after_prayer',
        'name': 'tasbih_prayer',
        # The hadith names the acts (tasbih, tahmid, takbir); the three phrases
        # are written as Hisn al-Muslim has them.
        'recite': [
            AR(HISN(69), 'سُبْحَانَ اللَّهِ', n=33, own=True),
            AR(HISN(69), 'الْحَمْدُ لِلَّهِ', n=33, own=True),
            AR(HISN(69), 'اللَّهُ أَكْبَرُ', n=33, own=True),
            AR(H('muslim', 1352), 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ', 'قَدِيرٌ', n=1),
        ],
        'meaning': {
            'en': X(HISN(69), 'en', 'How perfect Allah is, all praise is for Allah', 'over all things omnipotent.'),
            'fr': MINE("Gloire et pureté à Allah (33 fois), louange à Allah (33 fois), Allah est le plus Grand (33 fois) ; puis, pour compléter cent : " + TAHLIL_FR),
        },
        'primary': HE(10948),
        'when_ar': [X(H('muslim', 1352), 'ar', 'فِي دُبُرِ كُلِّ صَلاَةٍ')],
        'count_ar': X(H('muslim', 1352), 'ar', 'مَنْ سَبَّحَ اللَّهَ فِي دُبُرِ كُلِّ صَلاَةٍ', 'وَقَالَ تَمَامَ الْمِائَةِ'),
        'about': {
            'en': X(HE(10948), 'en', 'Whoever glorifies Allah directly after each prayer', 'like the sea foam.'),
            'fr': MINE("Celui qui glorifie Allah après chaque prière trente-trois fois, Le loue trente-trois fois et proclame Sa grandeur trente-trois fois, cela fait quatre-vingt-dix-neuf, puis dit pour compléter cent : « Lâ ilâha illa Llâh… », ses péchés lui sont pardonnés, même s'ils sont comme l'écume de la mer."),
        },
        'refs': [H('muslim', 1352)],
    },
    {
        'hisn': 70, 'tabs': ['prayer'], 'group': 'each', 'count': 1, 'when': 'after_prayer',
        'name': 'muawwidhat_prayer',
        'recite': [BASMALA, Q(112, 1, 4), BASMALA, Q(113, 1, 5), BASMALA, Q(114, 1, 6)],
        'meaning': 'quran',
        'primary': H('abudawud', 1523),
        'when_ar': [X(H('abudawud', 1523), 'ar', 'أَنْ أَقْرَأَ بِالْمُعَوِّذَاتِ دُبُرَ كُلِّ صَلاَةٍ')],
        'about': {
            'en': X(H('nasai', 1336), 'en', 'The Messenger of Allah (ﷺ) commanded me', 'following every prayer'),
            'fr': MINE("Le Messager d'Allah ﷺ m'a ordonné de réciter les sourates protectrices (al-mu'awwidhât) après chaque prière."),
        },
        'refs': [H('abudawud', 1523), H('nasai', 1336), H('tirmidhi', 2903)],
    },
    {
        'hisn': 71, 'tabs': ['prayer'], 'group': 'each', 'count': 1, 'when': 'after_prayer',
        'name': 'ayat_kursi_prayer',
        'recite': [Q(2, 255, 255)],
        'meaning': 'quran',
        'primary': EXT('kursi_prayer'),
        'when_ar': [W(EXT('kursi_prayer'), 'ar')],
        'about': {
            'en': MINE('Whoever recites Ayat al-Kursi after every obligatory prayer, nothing keeps him from entering Paradise except death.'),
            'fr': MINE("Celui qui récite le Verset du Trône après chaque prière obligatoire, rien ne l'empêche d'entrer au Paradis sinon la mort."),
        },
        'refs': [EXT('kursi_prayer')],
    },
    {
        'hisn': 72, 'tabs': ['prayer'], 'group': 'maghrib', 'count': 10, 'when': 'after_maghrib',
        'recite': [AR(H('tirmidhi', 3534), 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ', 'قَدِيرٌ')],
        'meaning': {
            'en': X(HISN(72), 'en', 'None has the right to be worshipped', 'over all things omnipotent.'),
            'fr': MINE("Il n'y a de divinité [digne d'adoration] qu'Allah, Seul, sans associé. À Lui la royauté et à Lui la louange. Il donne la vie et donne la mort, et Il est capable de toute chose."),
        },
        'primary': H('tirmidhi', 3534),
        'when_ar': [X(H('tirmidhi', 3534), 'ar', 'عَشْرَ مَرَّاتٍ عَلَى إِثْرِ الْمَغْرِبِ')],
        'count_ar': X(H('tirmidhi', 3534), 'ar', 'عَشْرَ مَرَّاتٍ عَلَى إِثْرِ الْمَغْرِبِ'),
        'about': {
            'en': X(H('tirmidhi', 3534), 'en', 'Allah shall send for him protectors', 'ten believing slaves.'),
            'fr': MINE("Celui qui la dit dix fois à la suite du Maghrib, Allah lui envoie des gardiens qui le protègent du diable jusqu'au matin ; Il lui inscrit dix bonnes actions qui valent [le Paradis], lui efface dix péchés destructeurs, et cela équivaut pour lui à l'affranchissement de dix esclaves croyants."),
        },
        'notes': [{
            'label': {'en': 'In Hisn al-Muslim', 'fr': 'Dans Hisn al-Muslim'},
            'en': MINE('Hisn al-Muslim gives it after Maghrib and after Fajr. The Fajr hadith (at-Tirmidhi 3474) was graded weak by al-Albani in his edition of at-Tirmidhi, so only Maghrib is kept here.'),
            'fr': MINE("Hisn al-Muslim le donne après Maghrib et après Fajr. Le hadith de Fajr (at-Tirmidhî 3474) a été jugé faible par al-Albânî dans son édition d'at-Tirmidhî : seul Maghrib est gardé ici."),
            'weak_ref': H('tirmidhi', 3474),
        }],
        'refs': [H('tirmidhi', 3534)],
    },
    {
        'hisn': 73, 'tabs': ['prayer'], 'group': 'fajr', 'count': 1, 'when': 'after_fajr',
        'recite': [AR(HISN(73), 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً', 'مُتَقَبَّلاً', inside=H('ibnmajah', 925))],
        'meaning': {
            'en': X(HISN(73), 'en', 'O Allah, I ask You for knowledge', 'deeds which are acceptable.'),
            'fr': MINE('Ô Allah ! Je Te demande une science utile, une subsistance bonne et des œuvres acceptées.'),
        },
        'primary': H('ibnmajah', 925),
        'when_ar': [X(H('ibnmajah', 925), 'ar', 'إِذَا صَلَّى الصُّبْحَ حِينَ يُسَلِّمُ')],
        'about': {
            'en': X(H('ibnmajah', 925), 'en', 'It was narrated from Umm Salamah', 'he would say'),
            'fr': MINE("Lorsque le Prophète ﷺ priait la prière du matin (Subh), au moment du salut final, il disait : …"),
        },
        'refs': [H('ibnmajah', 925)],
    },
    # ================================================ during the night (chapter 28, "in a night")
    {
        'hisn': 101, 'tabs': ['night'], 'group': 'night', 'count': 1, 'when': 'night',
        'name': 'baqarah_end',
        'recite': [Q(2, 285, 286)],
        'meaning': 'quran',
        'primary': HE(6274),
        'when_ar': [X(HE(6274), 'ar', 'فِي لَيْلَةٍ')],
        'about': {
            'en': X(HE(6274), 'en', 'Whoever recites the last two verses', 'they will suffice him.'),
            'fr': X(HE(6274), 'fr', 'Quiconque récite', 'ils lui suffiront.'),
        },
        'notes': [{
            'label': {'en': 'In Hisn al-Muslim', 'fr': 'Dans Hisn al-Muslim'},
            'en': MINE('Hisn al-Muslim lists it with the sleep adhkar; the hadith says «فِي لَيْلَةٍ», "in a night".'),
            'fr': MINE("Hisn al-Muslim le place avec les adhkar du coucher ; le hadith dit «فِي لَيْلَةٍ», « dans une nuit »."),
        }],
        'refs': [H('bukhari', 5009), H('muslim', 1880)],
    },
    # ================================================ going to bed (chapter 28)
    {
        'hisn': 99, 'tabs': ['night'], 'group': 'bed', 'count': 3, 'when': 'bed',
        'name': 'muawwidhat_bed',
        'recite': [BASMALA, Q(112, 1, 4), BASMALA, Q(113, 1, 5), BASMALA, Q(114, 1, 6)],
        'meaning': 'quran',
        'primary': HE(5879),
        'when_ar': [X(H('bukhari', 5017), 'ar', 'كَانَ إِذَا أَوَى إِلَى فِرَاشِهِ كُلَّ لَيْلَةٍ')],
        'count_ar': X(H('bukhari', 5017), 'ar', 'يَفْعَلُ ذَلِكَ ثَلاَثَ مَرَّاتٍ'),
        'about': {
            'en': X(HE(5879), 'en', 'Whenever the Prophet', 'He would do this three times.'),
            'fr': X(HE(5879), 'fr', 'Chaque nuit, lorsque', 'il répétait cela trois fois.'),
        },
        'refs': [H('bukhari', 5017)],
    },
    {
        'hisn': 100, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'name': 'ayat_kursi_bed',
        'recite': [Q(2, 255, 255)],
        'meaning': 'quran',
        'primary': H('bukhari', 2311),
        'when_ar': [X(H('bukhari', 2311), 'ar', 'إِذَا أَوَيْتَ إِلَى فِرَاشِكَ فَاقْرَأْ آيَةَ الْكُرْسِيِّ')],
        'about': {
            'en': X(H('bukhari', 2311), 'en', 'Whenever you go to bed, recite', 'no satan will come near you till morning.'),
            'fr': MINE("Lorsque tu te mets au lit, récite le Verset du Trône jusqu'à la fin du verset : un gardien de la part d'Allah ne cessera d'être auprès de toi, et aucun diable ne s'approchera de toi jusqu'au matin."),
        },
        'notes': [
            {
                'label': {'en': 'The Prophet ﷺ said', 'fr': 'Le Prophète ﷺ a dit'},
                'ar': X(H('bukhari', 2311), 'ar', 'صَدَقَكَ وَهُوَ كَذُوبٌ'),
                'en': X(H('bukhari', 2311), 'en', 'He really spoke the truth', 'absolute liar.'),
                'fr': MINE("Il t'a dit la vérité, alors qu'il est un grand menteur."),
            },
            {
                'label': {'en': 'Chain', 'fr': 'Chaîne'},
                'en': MINE("Al-Bukhari quotes this hadith without giving his full chain (mu'allaq): he says \"'Uthman ibn al-Haytham said\"."),
                'fr': MINE("Al-Bukhârî cite ce hadith sans donner sa chaîne complète (mu'allaq) : il dit « 'Uthmân ibn al-Haytham a dit »."),
            },
        ],
        'refs': [H('bukhari', 2311)],
    },
    {
        'hisn': 102, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(H('bukhari', 6320), 'بِاسْمِكَ رَبِّ وَضَعْتُ جَنْبِي', 'عِبَادَكَ الصَّالِحِينَ')],
        'meaning': {
            'en': X(HE(6034), 'en', 'In Your Name, O my Lord', 'Your righteous slaves.'),
            'fr': X(HE(6034), 'fr', 'C’est en Ton nom', 'Tes serviteurs vertueux !'),
        },
        'primary': HE(6034),
        'when_ar': [X(H('bukhari', 6320), 'ar', 'إِذَا أَوَى أَحَدُكُمْ إِلَى فِرَاشِهِ')],
        'about': {
            'en': X(HE(6034), 'en', 'When any one of you goes to his bed', 'after he had left it.'),
            'fr': X(HE(6034), 'fr', 'Lorsque l’un d', 'succédé sur celle-ci.'),
        },
        'refs': [H('bukhari', 6320), H('muslim', 6892)],
    },
    {
        'hisn': 103, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(H('muslim', 6888), 'اللَّهُمَّ خَلَقْتَ نَفْسِي', 'أَسْأَلُكَ الْعَافِيَةَ')],
        'meaning': {
            'en': X(H('muslim', 6888), 'en', 'O Allah, Thou created my being', 'I beg of Thee safety.'),
            'fr': MINE("Ô Allah ! Tu as créé mon âme et c'est Toi qui la reprends ; à Toi sa mort et sa vie. Si Tu la fais vivre, protège-la, et si Tu la fais mourir, pardonne-lui. Ô Allah ! Je Te demande la préservation."),
        },
        'primary': H('muslim', 6888),
        'when_ar': [X(H('muslim', 6888), 'ar', 'إِذَا أَخَذَ مَضْجَعَهُ')],
        'about': {
            'en': X(H('muslim', 6888), 'en', "A person said to him", "from Allah's Messenger (ﷺ)"),
            'fr': MINE("'Abdullâh ibn 'Umar ordonna à un homme de dire ceci en se couchant. On lui demanda : « L'as-tu entendu de 'Umar ? » Il répondit : « De quelqu'un de meilleur que 'Umar : du Messager d'Allah ﷺ. »"),
        },
        'refs': [H('muslim', 6888)],
    },
    {
        'hisn': 104, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(HISN(104), 'اللَّهُمَّ قِنِي عَذَابَكَ', 'عِبَادَكَ', inside=H('abudawud', 5045))],
        'meaning': {
            'en': X(HISN(104), 'en', 'O Allah, protect me from Your punishment', 'servants are resurrected.'),
            'fr': MINE('Ô Allah ! Préserve-moi de Ton châtiment le jour où Tu ressusciteras Tes serviteurs.'),
        },
        'primary': H('abudawud', 5045),
        'when_ar': [X(H('abudawud', 5045), 'ar', 'كَانَ إِذَا أَرَادَ أَنْ يَرْقُدَ', 'تَحْتَ خَدِّهِ')],
        'about': {
            'en': X(H('abudawud', 5045), 'en', 'When the Messenger of Allah (ﷺ) wanted to go to sleep', 'and would then say'),
            'fr': MINE("Lorsque le Messager d'Allah ﷺ voulait dormir, il plaçait sa main droite sous sa joue puis disait : …"),
        },
        'notes': [{
            'label': {'en': 'Count', 'fr': 'Nombre'},
            'albani': H('abudawud', 5045),
            'en': MINE('Hisn al-Muslim says three times. Al-Albani graded this hadith sahih except the words "three times", and wrote that "three times" was printed in Sahih al-Jami\' 4656 by mistake. It is counted once here.'),
            'fr': MINE("Hisn al-Muslim dit trois fois. Al-Albânî a jugé ce hadith sahih sauf les mots « trois fois », et a écrit que « trois fois » figure dans Sahîh al-Jâmi' 4656 par erreur. Il est compté une fois ici."),
        }],
        'refs': [H('abudawud', 5045), H('tirmidhi', 3399)],
    },
    {
        'hisn': 105, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(HISN(105), 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', inside=H('bukhari', 6324))],
        'meaning': {
            'en': X(H('bukhari', 6324), 'en', 'With Your name, O Allah, I die and I live'),
            'fr': MINE("C'est en Ton nom, ô Allah, que je meurs et que je vis."),
        },
        'primary': H('bukhari', 6324),
        'when_ar': [X(H('bukhari', 6324), 'ar', 'إِذَا أَرَادَ أَنْ يَنَامَ')],
        'about': {
            'en': X(H('bukhari', 6324), 'en', 'Whenever the Prophet (ﷺ) intended to go to bed', 'he would recite'),
            'fr': MINE('Lorsque le Prophète ﷺ voulait dormir, il disait : …'),
        },
        'refs': [H('bukhari', 6324), H('muslim', 6887)],
    },
    {
        'hisn': 106, 'tabs': ['night'], 'group': 'bed', 'when': 'bed',
        'name': 'tasbih_fatimah',
        'recite': [
            AR(HISN(106), 'سُبْحَانَ اللَّهِ', n=33, own=True),
            AR(HISN(106), 'الْحَمْدُ لِلَّهِ', n=33, own=True),
            AR(HISN(106), 'اللَّهُ أَكْبَرُ', n=34, own=True),
        ],
        'meaning': {
            'en': X(HE(6076), 'en', '‘Subhān Allah', 'thirty-four times'),
            'fr': MINE('Gloire et pureté à Allah (33 fois), louange à Allah (33 fois), Allah est le plus Grand (34 fois).'),
        },
        'primary': HE(6076),
        'when_ar': [X(HE(6076), 'ar', 'إِذَا أَخَذْتُمَا مَضَاجِعَكُمَا', 'إِلَى فِرَاشِكُمَا')],
        'count_ar': X(H('bukhari', 3705), 'ar', 'تُكَبِّرَا أَرْبَعًا وَثَلاَثِينَ', 'وَتَحْمَدَا ثَلاَثَةً وَثَلاَثِينَ'),
        'about': {
            'en': X(HE(6076), 'en', 'This is better for you than a servant.'),
            'fr': MINE('Cela est meilleur pour vous qu’un serviteur.'),
        },
        'refs': [H('bukhari', 6318), H('bukhari', 3705), H('muslim', 6915)],
    },
    {
        'hisn': 107, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(H('muslim', 6889), 'اللَّهُمَّ رَبَّ السَّمَوَاتِ', 'وَأَغْنِنَا مِنَ الْفَقْرِ')],
        'meaning': {
            'en': X(HE(6335), 'en', 'O Allah, Lord of the heavens', 'relieve us of poverty.'),
            'fr': X(HE(6335), 'fr', 'Ô Allah ! Seigneur des Cieux', 'affranchis-nous de la pauvreté !'),
        },
        'primary': HE(6335),
        'when_ar': [X(H('muslim', 6889), 'ar', 'إِذَا أَرَادَ أَحَدُنَا أَنْ يَنَامَ', 'عَلَى شِقِّهِ الأَيْمَنِ')],
        'about': {
            'en': X(HE(6335), 'en', 'Abu Sālih used to order us', 'and then say'),
            'fr': X(HE(6335), 'fr', 'Lorsque l’un d’entre nous voulait dormir', 'qu’il dise'),
        },
        'refs': [H('muslim', 6889), H('muslim', 6891)],
    },
    {
        'hisn': 108, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(H('muslim', 6894), 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا', 'وَلاَ مُئْوِيَ')],
        'meaning': {
            'en': X(HE(5882), 'en', 'Praise be to Allah Who gave us food', 'to give them shelter.'),
            'fr': X(HE(5882), 'fr', 'Louange à Allah qui nous a nourris', 'ou les abriter !'),
        },
        'primary': HE(5882),
        'when_ar': [X(H('muslim', 6894), 'ar', 'كَانَ إِذَا أَوَى إِلَى فِرَاشِهِ قَالَ')],
        'about': {
            'en': MINE('When he ﷺ went to bed, he would say: …'),
            'fr': X(HE(5882), 'fr', 'lorsque le Prophète', 'il disait'),
        },
        'refs': [H('muslim', 6894)],
    },
    {
        'hisn': 109, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(H('tirmidhi', 3392), 'اللَّهُمَّ عَالِمَ الْغَيْبِ', 'الشَّيْطَانِ وَشِرْكِهِ')],
        'meaning': {
            'en': X(H('tirmidhi', 3392), 'en', 'O Allah Knower of the Unseen', 'Shaitan and his Shirk'),
            'fr': MINE("Ô Allah ! Connaisseur de l'invisible et du visible, Créateur des cieux et de la terre, Seigneur et Maître de toute chose, j'atteste qu'il n'y a de divinité [digne d'adoration] que Toi. Je cherche protection auprès de Toi contre le mal de mon âme, et contre le mal du diable et de son polythéisme."),
        },
        'primary': H('tirmidhi', 3392),
        'when_ar': [X(H('tirmidhi', 3392), 'ar', 'قُلْهُ إِذَا أَصْبَحْتَ وَإِذَا أَمْسَيْتَ وَإِذَا أَخَذْتَ مَضْجَعَكَ')],
        'about': {
            'en': X(H('tirmidhi', 3392), 'en', 'Say it when you reach morning, and evening, and when you go to bed.'),
            'fr': MINE('Dis-le quand tu te retrouves au matin, quand tu te retrouves au soir, et quand tu te couches.'),
        },
        'refs': [H('tirmidhi', 3392), H('abudawud', 5067)],
    },
    {
        'hisn': 110, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'name': 'mulk_sajdah',
        'recite': [AR(HISN(110), 'يَقْرَأُ', 'بِيَدِهِ الْمُلْكُ', own=True)],
        'surahs': [32, 67],
        'meaning': {
            'en': X(HISN(110), 'en', 'The Prophet', '(chapter 67).'),
            'fr': MINE('Le Prophète ﷺ ne dormait pas avant d’avoir récité la sourate as-Sajda (32) et la sourate al-Mulk (67).'),
        },
        'primary': H('tirmidhi', 3404),
        'when_ar': [X(H('tirmidhi', 3404), 'ar', 'لاَ يَنَامُ حَتَّى يَقْرَأَ')],
        'about': {
            'en': X(H('tirmidhi', 3404), 'en', 'The Prophet would not sleep', 'Tabarak.'),
            'fr': MINE('Le Prophète ﷺ ne dormait pas avant d’avoir récité Tanzîl as-Sajda et Tabârak.'),
        },
        'notes': [{
            'label': {'en': 'Virtue of Surat al-Mulk', 'fr': 'Mérite de la sourate al-Mulk'},
            'en': X(H('tirmidhi', 2891), 'en', 'Indeed there is a Surah', 'Biyadihil-Mulk'),
            'fr': MINE("Il y a dans le Coran une sourate de trente versets qui a intercédé pour un homme jusqu'à ce qu'il soit pardonné : c'est la sourate Tabârak (al-Mulk)."),
        }],
        'refs': [H('tirmidhi', 3404), H('tirmidhi', 2891)],
    },
    {
        'hisn': 111, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [AR(HISN(111), 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي', 'الَّذِي أَرْسَلْتَ', inside=H('bukhari', 6313))],
        'meaning': {
            'en': X(HISN(111), 'en', 'O Allah, I submit my soul unto You', 'whom You have sent.'),
            'fr': MINE("Ô Allah ! Je Te soumets mon âme, je Te confie mon affaire, je tourne mon visage vers Toi et je m'adosse à Toi, par désir [de Ta récompense] et par crainte [de Toi]. Il n'y a de refuge ni de salut contre Toi qu'auprès de Toi. J'ai cru en Ton Livre que Tu as fait descendre et en Ton Prophète que Tu as envoyé."),
        },
        'primary': H('bukhari', 6313),
        'when_ar': [X(H('bukhari', 247), 'ar', 'إِذَا أَتَيْتَ مَضْجَعَكَ فَتَوَضَّأْ', 'عَلَى شِقِّكَ الأَيْمَنِ'), X(H('bukhari', 247), 'ar', 'وَاجْعَلْهُنَّ آخِرَ مَا تَتَكَلَّمُ بِهِ')],
        'about': {
            'en': X(H('bukhari', 6313), 'en', 'And if you should die then', 'religion of Islam'),
            'fr': MINE('Si tu meurs [cette nuit-là], tu mourras sur la fitra (l’islam).'),
        },
        'notes': [{
            'face': True,
            'label': {'en': 'How', 'fr': 'Comment'},
            'en': J(X(H('bukhari', 247), 'en', 'Whenever you go to bed perform ablution', 'lie on your right side'), '…', X(H('bukhari', 247), 'en', 'Let the aforesaid words be your last utterance', '(before sleep).')),
            'fr': MINE('Lorsque tu te mets au lit, fais tes ablutions comme pour la prière, puis couche-toi sur le côté droit. Fais que ce soient tes dernières paroles.'),
        }],
        'refs': [H('bukhari', 6313), H('bukhari', 247), H('muslim', 6882)],
    },
    # ================================================ turning over at night (chapter 29)
    {
        'hisn': 112, 'tabs': ['night'], 'group': 'turning', 'count': 1, 'when': 'turning',
        'recite': [AR(HISN(112), 'لاَ إِلَهَ إِلاَّ اللَّهُ الْوَاحِدُ', 'الْعَزيزُ الْغَفَّارُ', inside=EXT('turning'))],
        'meaning': {
            'en': X(HISN(112), 'en', 'None has the right to be worshipped except Allah, The One', 'The Oft-Forgiving.'),
            'fr': MINE("Il n'y a de divinité [digne d'adoration] qu'Allah, l'Unique, le Dominateur suprême, Seigneur des cieux, de la terre et de ce qui est entre eux, le Tout-Puissant, Celui qui pardonne abondamment."),
        },
        'primary': EXT('turning'),
        'when_ar': [X(EXT('turning'), 'ar', 'كان إذا تضور من الليل')],
        'about': {
            'en': MINE('When he ﷺ turned over [in bed] during the night, he would say: …'),
            'fr': MINE("Lorsqu'il ﷺ se retournait [dans son lit] pendant la nuit, il disait : …"),
        },
        'refs': [EXT('turning')],
    },
]

# When to say the morning and the evening adhkar: Ibn al-Qayyim's words, and
# the hadith that names the two times.
TIMING = {
    'scholar': {
        'cite': {'en': 'Ibn al-Qayyim, al-Wabil as-Sayyib, chapter 1', 'fr': 'Ibn al-Qayyim, al-Wâbil as-Sayyib, chapitre 1'},
        'title': 'في ذكر طرفي النهار',
        'quotes': ['وهما ما بين الصبح وطلوع الشمس، وما بين العصر والغروب.',
                   ('وهذا تفسير ما جاء في الأحاديث:', 'وأن محل هذه الأذكار بعد الصبح وبعد العصر.')],
        'en': ['They are: what is between the dawn prayer and sunrise, and what is between \'Asr and sunset.',
               'This explains what comes in the hadith, "whoever says such and such in the morning and in the evening": what is meant is before sunrise and before sunset, and the place of these adhkar is after the dawn prayer and after \'Asr.'],
        'fr': ["Ce sont : ce qui est entre la prière de l'aube et le lever du soleil, et ce qui est entre le 'asr et le coucher du soleil.",
               "Ceci explique ce qui vient dans les hadiths, « celui qui dit telle chose au matin et au soir » : ce qui est visé est avant le lever du soleil et avant son coucher, et le moment de ces adhkar est après la prière de l'aube et après le 'asr."],
    },
    'hadith': {
        'src': H('abudawud', 3667),
        'ar': [X(H('abudawud', 3667), 'ar', 'مِنْ صَلاَةِ الْغَدَاةِ حَتَّى تَطْلُعَ الشَّمْسُ'),
               X(H('abudawud', 3667), 'ar', 'مِنْ صَلاَةِ الْعَصْرِ إِلَى أَنْ تَغْرُبَ الشَّمْسُ')],
        'en': X(H('abudawud', 3667), 'en', 'That I sit in the company', 'till the sun sets is dearer to me than that I emancipate four slaves'),
        'fr': MINE("Que je m'assoie avec des gens qui évoquent Allah, depuis la prière du matin jusqu'au lever du soleil, m'est plus cher que d'affranchir quatre [esclaves] des descendants d'Ismâ'îl ; et que je m'assoie avec des gens qui évoquent Allah, depuis la prière du 'asr jusqu'au coucher du soleil, m'est plus cher que d'affranchir quatre [esclaves]."),
    },
}

# Hisn al-Muslim items left out: al-Albani graded the hadith weak.
EXCLUDED = [
    {'hisn': 80, 'refs': [H('abudawud', 5069), H('abudawud', 5078)]},
    {'hisn': 81, 'refs': [H('abudawud', 5073)]},
    {'hisn': 83, 'refs': [H('abudawud', 5081)]},
    {'hisn': 87, 'refs': [H('abudawud', 5072), H('tirmidhi', 3389), H('ibnmajah', 3870)]},
    {'hisn': 89, 'refs': [H('abudawud', 5084)]},
    {'hisn': 98, 'refs': [], 'note': {
        'en': "at-Tabarani. Al-Albani first graded it hasan (Sahih al-Jami' 5357), then weak (as-Silsila ad-Da'ifa 5788).",
        'fr': "At-Tabarânî. Al-Albânî l'a d'abord jugé hasan (Sahîh al-Jâmi' 5357), puis faible (as-Silsila ad-Da'îfa 5788).",
        'url': 'https://islamqa.info/ar/answers/130213',
    }},
]


# ---------------------------------------------------------------- build

def grade_of(ruling):
    """The grade al-Albani opens his ruling with."""
    text = re.sub(r'^\(.*?\)\s*', '', ruling.strip())
    for arabic, name in (('حسن صحيح', 'Hasan Sahih'), ('صحيح', 'Sahih'), ('حسن', 'Hasan'), ('ضعيف جدا', 'Very Daif'),
                         ('ضعيف', 'Daif'), ('موضوع', 'Mawdu'), ('منكر', 'Munkar'), ('شاذ', 'Shadh')):
        if text.startswith(arabic):
            return name
    return None


def acceptable(grade):
    return bool(grade) and grade.lower().split()[0] in ('sahih', 'hasan')


class Builder:
    def __init__(self, hadith, he, hisn, albani, jami, wabil):
        self.hadith, self.he, self.hisn, self.albani, self.jami, self.wabil = hadith, he, hisn, albani, jami, wabil
        self.checks = {'inside': 0, 'own': 0, 'counts': 0, 'rulings': 0, 'vowels': 0}

    # ---- sources

    def tag(self, source):
        kind = source[0]
        if kind == 'h':
            return f'hadith:{source[1]}:{source[2]}'
        return f'{kind}:{source[1]}'

    def source_text(self, source, lang, where):
        kind = source[0]
        if kind == 'h':
            return self.hadith.get(source[1], source[2])[lang]
        if kind == 'he':
            row = self.he.get(source[1])
            if lang not in row:
                raise BuildError(f'{where}: HadeethEnc {source[1]} has no {lang}')
            return clean(row[lang])
        if kind == 'hisn':
            return clean(self.hisn.get(source[1])[lang])
        if kind == 'sj':
            return self.jami.get(source[1])[0]
        if kind == 'ext':
            if lang != 'ar':
                raise BuildError(f'{where}: external texts are Arabic only')
            entry = EXTERNAL[source[1]]
            return self.jami.get(entry['jami'])[0] if 'jami' in entry else entry['ar']
        raise BuildError(f'{where}: unknown source {source}')

    def text(self, spec, where):
        """Return {'text', 'src'} for a text spec."""
        kind = spec[0]
        if kind == 'mine':
            return {'text': spec[1], 'src': 'mine'}
        if kind == 'join':
            parts = [p if p == '…' else self.text(p, where) for p in spec[1]]
            srcs = [p['src'] for p in parts if p != '…']
            # a page-written lead-in may introduce a quoted excerpt
            real = {s for s in srcs if s != 'mine'}
            if len(real) > 1:
                raise BuildError(f'{where}: joined excerpts come from different sources {real}')
            return {'text': ' '.join(p if p == '…' else p['text'] for p in parts), 'src': real.pop() if real else 'mine',
                    **({'lead': 'mine'} if 'mine' in srcs and real else {})}
        if kind == 'w':
            return {'text': self.source_text(spec[1], spec[2], where), 'src': self.tag(spec[1])}
        if kind == 'x':
            return {'text': cut(self.source_text(spec[1], spec[2], where), spec[3], spec[4], where), 'src': self.tag(spec[1])}
        raise BuildError(f'{where}: bad text spec {spec!r}')

    # ---- recited text and its checks

    def recite(self, segs, where):
        out = []
        for seg in segs:
            if seg['kind'] == 'quran':
                out.append({'quran': seg['ayat']})
                continue
            if seg['kind'] == 'basmala':
                out.append({'basmala': True})
                continue
            source = seg['source']
            ar = cut(self.source_text(source, 'ar', where), seg['start'], seg['end'], where)
            entry = {'ar': ar, 'src': self.tag(source)}
            if seg['n']:
                entry['n'] = seg['n']
            # 1. the words are inside an authentic hadith
            if seg['own']:
                if source[0] != 'hisn':
                    raise BuildError(f'{where}: only Hisn al-Muslim text can be declared as its own presentation')
                entry['own'] = True
                self.checks['own'] += 1
            else:
                container = seg['inside'] or source
                if container[0] == 'hisn':
                    raise BuildError(f'{where}: {ar[:30]}… comes from Hisn al-Muslim: name the hadith that contains it')
                hay = letters(self.source_text(container, 'ar', where))
                if letters(ar) not in hay:
                    raise BuildError(f'{where}: not found word for word in {self.tag(container)}: {ar}')
                if seg['inside']:
                    entry['inside'] = self.tag(container)
                self.checks['inside'] += 1
            # 4. the reader gets the vowel marks
            if vowel_ratio(ar) < 0.6:
                raise BuildError(f'{where}: text to recite has few vowel marks ({vowel_ratio(ar):.2f}): {ar}')
            self.checks['vowels'] += 1
            out.append(entry)
        return out

    # ---- references

    def ref(self, source, where):
        if source[0] == 'ext':
            e = EXTERNAL[source[1]]
            if not acceptable(e['grade']):
                raise BuildError(f'{where}: {source[1]} graded {e["grade"]}')
            out = {'label': e['cite'], 'grade': e['grade'], 'grader': 'al-Albani', 'where': e['where'], 'url': e['url']}
            if 'jami' in e:
                arabic = self.jami.get(e['jami'])[1]
                if grade_of(arabic) != e['grade']:
                    raise BuildError(f"{where}: Sahih al-Jami' {e['jami']} says {arabic!r}, not {e['grade']}")
                out['ruling'] = arabic
            return out
        book, n = source[1], source[2]
        h = self.hadith.get(book, n)
        out = {'label': f'{BOOK_NAMES[book]} {h["number"]}', 'url': hadith_link(h), 'book': book}
        if book in ('bukhari', 'muslim'):
            out['grade'] = 'Sahih'
            out['grader'] = 'sahihayn'
            return out
        ruling = self.albani.ruling(book, n)
        if ruling is None:
            raise BuildError(f'{where}: {book} {n} has no ruling by al-Albani in his edition; cite another reference')
        grade = grade_of(ruling)
        decision = REVIEWED.get((book, n))
        flagged = [w for w in RESERVATION if w in ruling.replace('انظر', '')]
        if flagged and not decision:
            raise BuildError(f'{where}: {book} {n}: al-Albani adds a reservation {flagged}: {ruling}')
        if decision == 'chain':
            grade = 'Hasan Isnaad'
        if decision == 'hasan':
            grade = 'Hasan'
        if not acceptable(grade):
            raise BuildError(f'{where}: {out["label"]} graded {grade}: {ruling}')
        out['grade'] = grade
        out['grader'] = 'al-Albani'
        out['ruling'] = ruling
        self.checks['rulings'] += 1
        return out

    def primary(self, source):
        tag = self.tag(source)
        if source[0] == 'ext':
            e = EXTERNAL[source[1]]
            return {'ar': self.source_text(source, 'ar', tag), 'arSrc': tag, 'url': e['url'], 'excerpt': True}
        if source[0] == 'he':
            row = self.he.get(source[1])
            out = {'ar': clean(row['ar']), 'arSrc': tag, 'url': row['link'].get('ar')}
            for lang in ('en', 'fr'):
                if lang in row:
                    out[lang] = {'text': clean(row[lang]), 'src': tag, 'url': row['link'][lang]}
                    if row.get(f'{lang}_explanation'):
                        out[f'{lang}Explain'] = {'text': clean(row[f'{lang}_explanation']), 'src': tag, 'url': row['link'][lang]}
            return out
        h = self.hadith.get(source[1], source[2])
        return {'ar': h['ar'], 'arSrc': tag, 'url': hadith_link(h),
                'en': {'text': h['en'], 'src': tag, 'url': hadith_link(h)}}

    # ---- one dhikr

    def item(self, spec):
        where = f'Hisn {spec["hisn"]}'
        if spec['when'] not in WHEN or any(t not in TABS for t in spec['tabs']):
            raise BuildError(f'{where}: unknown time or tab')
        out = {
            'id': f'h{spec["hisn"]}',
            'hisn': spec['hisn'],
            'hisnUrl': f'https://sunnah.com/hisn:{spec["hisn"]}',
            'tabs': spec['tabs'],
            'group': spec.get('group'),
            'when': spec['when'],
            'name': spec.get('name'),
            'recite': self.recite(spec['recite'], where),
        }
        steps = [seg.get('n') for seg in out['recite'] if 'ar' in seg]
        if any(steps):
            if not all(steps) or 'count' in spec:
                raise BuildError(f'{where}: give either a count or a number on every phrase')
            total = sum(steps)
        else:
            out['count'] = total = spec['count']
        if 'recite_evening' in spec:
            out['reciteEvening'] = self.recite(spec['recite_evening'], where)
        if spec['meaning'] == 'quran':
            out['meaning'] = 'quran'
        else:
            out['meaning'] = {lang: self.text(spec['meaning'][lang], where) for lang in ('en', 'fr')}
        if 'meaning_evening' in spec:
            out['meaningEvening'] = {lang: self.text(spec['meaning_evening'][lang], where) for lang in ('en', 'fr')}
        out['whenAr'] = [{'ar': t['text'], 'src': t['src']} for t in (self.text(s, where) for s in spec['when_ar'])]
        # 3. a count above one needs the words of a hadith
        if total > 1:
            if 'count_ar' not in spec:
                raise BuildError(f'{where}: said {total} times but no hadith words give the count')
            t = self.text(spec['count_ar'], where)
            out['countAr'] = {'ar': t['text'], 'src': t['src']}
            self.checks['counts'] += 1
        out['about'] = {lang: self.text(spec['about'][lang], where) for lang in ('en', 'fr')}
        notes = []
        for note in spec.get('notes', []):
            entry = {'label': note['label'], 'en': self.text(note['en'], where), 'fr': self.text(note['fr'], where)}
            if 'ar' in note:
                t = self.text(note['ar'], where)
                entry['ar'] = {'ar': t['text'], 'src': t['src']}
            if 'albani' in note:
                book, n = note['albani'][1], note['albani'][2]
                h = self.hadith.get(book, n)
                entry['ar'] = {'ar': self.albani.ruling(book, n), 'src': f'albani:{book}:{n}'}
                entry['arLabel'] = {'en': f"Al-Albani's words ({BOOK_NAMES[book]} {h['number']})", 'fr': f"Les mots d'al-Albânî ({BOOK_NAMES[book]} {h['number']})"}
            if 'weak_ref' in note:
                book, n = note['weak_ref'][1], note['weak_ref'][2]
                ruling = self.albani.ruling(book, n)
                if acceptable(grade_of(ruling)):
                    raise BuildError(f'{where}: {book} {n} is called weak in a note but al-Albani says {ruling}')
                entry['ar'] = {'ar': ruling, 'src': f'albani:{book}:{n}'}
                h = self.hadith.get(book, n)
                entry['arLabel'] = {'en': f"Al-Albani's words ({BOOK_NAMES[book]} {h['number']})", 'fr': f"Les mots d'al-Albânî ({BOOK_NAMES[book]} {h['number']})"}
            for key in ('tabs', 'face'):
                if key in note:
                    entry[key] = note[key]
            notes.append(entry)
        if notes:
            out['notes'] = notes
        out['hadith'] = self.primary(spec['primary'])
        out['refs'] = [self.ref(r, where) for r in spec['refs']]
        if 'surahs' in spec:
            out['surahs'] = spec['surahs']
        return out

    def excluded(self, spec):
        out = {'hisn': spec['hisn'], 'hisnUrl': f'https://sunnah.com/hisn:{spec["hisn"]}', 'refs': []}
        for r in spec['refs']:
            h = self.hadith.get(r[1], r[2])
            ruling = self.albani.ruling(r[1], r[2])
            grade = grade_of(ruling)
            if acceptable(grade):
                raise BuildError(f'excluded {spec["hisn"]}: {r} is {grade}: {ruling}')
            out['refs'].append({'label': f'{BOOK_NAMES[r[1]]} {h["number"]}', 'grade': grade, 'ruling': ruling, 'url': hadith_link(h)})
        if 'note' in spec:
            out['note'] = spec['note']
        return out

    def timing(self):
        s = TIMING['scholar']
        quotes = []
        for q in s['quotes']:
            start, end = (q, q) if isinstance(q, str) else q
            quotes.append(cut(self.wabil.text, start, end, 'al-Wabil as-Sayyib'))
        if s['title'] not in self.wabil.text:
            raise BuildError('al-Wabil as-Sayyib: chapter title not found')
        hd = TIMING['hadith']
        return {
            'scholar': {
                'cite': s['cite'],
                'title': s['title'],
                'quotes': [{'ar': q, 'src': 'wabil'} for q in quotes],
                'en': [{'text': t, 'src': 'mine'} for t in s['en']],
                'fr': [{'text': t, 'src': 'mine'} for t in s['fr']],
                'url': SOURCES['wabil']['url'],
            },
            'hadith': {
                'ar': [{'ar': t['text'], 'src': t['src']} for t in (self.text(x, 'times') for x in hd['ar'])],
                'en': self.text(hd['en'], 'times'),
                'fr': self.text(hd['fr'], 'times'),
                'ref': self.ref(hd['src'], 'times'),
            },
        }

    def src_table(self, data):
        """Label and link for every source tag used in the data, so the page can
        say under each text exactly where it was copied from."""
        tags = set()

        def walk(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ('src', 'arSrc', 'inside') and isinstance(value, str):
                        tags.add(value)
                    else:
                        walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(data)
        table = {}
        for tag in sorted(tags):
            kind, _, rest = tag.partition(':')
            if tag == 'mine':
                continue
            if kind == 'hadith':
                book, _, n = rest.partition(':')
                h = self.hadith.get(book, n)
                table[tag] = {'label': f'{BOOK_NAMES[book]} {h["number"]}', 'url': hadith_link(h), 'site': 'sunnah.com'}
            elif kind == 'he':
                row = self.he.get(rest)
                table[tag] = {'label': f'HadeethEnc {rest}', 'url': row['link'], 'site': 'HadeethEnc.com'}
            elif kind == 'hisn':
                # sunnah.com shows the same book and number (Arabic); its English
                # is a different translation, so the English links to the copy.
                copy = SOURCES['hisn']['copy'].replace('/tree/', '/blob/')
                table[tag] = {'label': f'Hisn al-Muslim {rest}', 'url': f'https://sunnah.com/hisn:{rest}',
                              'enUrl': f'{copy}/data/en.json', 'site': 'hisnmuslim.com'}
            elif kind == 'ext':
                e = EXTERNAL[rest]
                table[tag] = {'label': e['cite'], 'url': e['url'], 'where': e['where']}
            elif kind == 'albani':
                book, _, n = rest.partition(':')
                h = self.hadith.get(book, n)
                table[tag] = {'label': f"al-Albani, Sahih wa Da'if {BOOK_NAMES[book]} {h['number']}", 'url': SOURCES['albani']['url']}
            elif tag == 'wabil':
                table[tag] = {'label': SOURCES['wabil']['name'], 'url': SOURCES['wabil']['url']}
            else:
                raise BuildError(f'unknown source tag {tag!r}')
        return table


def main(argv):
    if len(argv) != 8:
        print(__doc__)
        return 2
    b = Builder(Hadith(argv[1]), HadeethEnc(argv[2]), Hisn(argv[3]), Albani(argv[4]), Jami(argv[5]), Wabil(argv[6]))
    data = {
        'version': 2,
        'about': 'Built by tools/adhkar/build.py. Texts are copied unchanged from the sources; "src": "mine" marks translations written for this page.',
        'sources': SOURCES,
        'timing': b.timing(),
        'items': [b.item(s) for s in ITEMS],
        'excluded': [b.excluded(s) for s in EXCLUDED],
    }
    ids = [it['id'] for it in data['items']]
    if len(ids) != len(set(ids)):
        raise BuildError('duplicate Hisn al-Muslim number')
    data['srcs'] = b.src_table(data)
    with open(argv[7], 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    c = b.checks
    print(f'{len(data["items"])} adhkar, {len(data["excluded"])} left out -> {argv[7]}')
    print(f'checks: {c["inside"]} texts found word for word in their hadith, {c["own"]} declared as Hisn al-Muslim\'s presentation, '
          f'{c["counts"]} counts backed by hadith words, {c["rulings"]} rulings of al-Albani read, {c["vowels"]} texts with vowel marks')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv))
    except BuildError as e:
        print('BUILD ERROR:', e)
        sys.exit(1)
