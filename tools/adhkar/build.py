#!/usr/bin/env python3
"""Build data/adhkar/adhkar.json for the adhkar page (adhkar.html).

Every Arabic text, translation, grade and link in the output is copied
unchanged from the pinned sources below. Excerpts are cut from a source text
with a start and an end marker, and the build stops if a marker is missing, so
nothing can be retyped by hand. The only texts not copied from a source are the
French (and a few English) lines marked "mine": translations written for this
page because no published one was found. The page labels them as such.

Quran passages are not copied here: the page loads them at runtime from the
same pinned quran-json files as the Quran reader.

Usage:
  python3 tools/adhkar/build.py HADITH_DIR HADEETHENC_DIR HISN_DIR OUT_JSON

  HADITH_DIR      fawazahmed0/hadith-api @ df57907: full editions
                  ara-<book>.json and eng-<book>.json (the files the site's
                  per-hadith URLs are split from)
  HADEETHENC_DIR  the official HadeethEnc.com Excel files
                  HadeethEnc.com_ar-v1.8.0.xlsx, _en-v1.25.0.xlsx, _fr-v1.17.0.xlsx
                  (byte-for-byte copies in Younes12345698/hadeethenc-mirror @ 429f7bd)
  HISN_DIR        data/ar.json and data/en.json of YousefAsalya/Islamic-Pro-azkar-API
                  @ d793023 (the hisnmuslim.com API, Hisn al-Muslim by
                  Sa'id ibn Wahf al-Qahtani, with the book's numbering)
"""

import json
import os
import sys
import unicodedata

import openpyxl

SOURCES = {
    'hadith': {
        'name': 'fawazahmed0/hadith-api',
        'commit': 'df57907be35291c91ad6a6691180e22ca9920784',
        'url': 'https://github.com/fawazahmed0/hadith-api/tree/df57907be35291c91ad6a6691180e22ca9920784',
        'note': 'Arabic text, sunnah.com English translations and al-Albani grades',
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
}

BOOK_NAMES = {
    'bukhari': 'Sahih al-Bukhari',
    'muslim': 'Sahih Muslim',
    'abudawud': 'Sunan Abi Dawud',
    'tirmidhi': "Jami' at-Tirmidhi",
    'nasai': "Sunan an-Nasa'i",
    'ibnmajah': 'Sunan Ibn Majah',
}


class BuildError(Exception):
    pass


def nfc(s):
    # Canonical form only (e.g. the order of shadda and fatha); the letters
    # and marks themselves are unchanged.
    return unicodedata.normalize('NFC', s)


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


def inner(text, where):
    """Hisn al-Muslim wraps each dhikr in (( ))."""
    i = text.find('((')
    j = text.rfind('))')
    if i < 0 or j < 0:
        raise BuildError(f'{where}: no (( )) in Hisn text')
    return text[i + 2:j].strip()


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
        albani = [g['grade'] for g in ar.get('grades', []) if g.get('name') == 'Al-Albani']
        ref = ar.get('reference') or {}
        number = ar.get('arabicnumber') or n
        return {
            'book': book,
            'n': n,
            'number': display_number(number),
            'ref': f"{ref.get('book')}/{ref.get('hadith')}",
            'ar': ar['text'],
            'en': en['text'] if en else '',
            'albani': albani[0] if albani else None,
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


# ---------------------------------------------------------------- the list
#
# Order inside each tab = the order of Hisn al-Muslim (chapters 27, 28, 29).
# Kept only when al-Albani graded the hadith sahih or hasan (or it is in the
# Sahihayn). Left out: see EXCLUDED.
#
# Text references used below:
#   ('hisn', n)                 Hisn al-Muslim item n (Arabic / English)
#   ('h', book, n)              hadith-api (Arabic / sunnah.com English)
#   ('he', id)                  HadeethEnc (Arabic / English / French)
#   ('ext', key)                a text quoted from a web page, see EXT
#   ('mine', text)              translation written for this page
#
# A text entry is either ('mine', text) or (ref, lang, start, end) for an
# excerpt, or (ref, lang) for the whole text.

EXT = {
    'ubayy': {
        'ar': 'مَنْ قالَها حِينَ يُمسِي أُجِيرَ مِنَّا حتَى يُصْبِحَ … ومَن قالَها حينَ يصبحُ أُجِيرَ مِنَّا حتى يُمسِي',
        'cite': "Ubayy ibn Ka'b, the jinn and the dates: al-Nasa'i (al-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/562)",
        'grade': 'Sahih',
        'where': 'Sahih al-Targhib 662',
        'url': 'https://surahquran.com/Hadith-100968.html',
    },
    'fatimah': {
        'ar': 'أن تقولي إذا أصبحتِ وإذا أمسيتِ',
        'cite': "Anas: the Prophet's advice to Fatimah: al-Nasa'i (al-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/545)",
        'grade': 'Hasan',
        'where': 'Sahih al-Targhib 1/273 (no. 661), «إسناده حسن»',
        'url': 'https://kalemtayeb.com/safahat/item/115307',
    },
    'fitrah': {
        'ar': 'كان إذا أصبحَ و إذا أَمْسَى قال : أَصْبَحْنا على فِطْرَةِ الإسلامِ و كَلِمَةِ الإِخْلاصِ ، و دِينِ نبيِّنا محمدٍ ، و مِلَّةِ أَبينا إبراهيمَ حَنِيفًا مسلمًا و ما كان مِنَ المُشْرِكِينَ',
        'cite': "'Abd al-Rahman ibn Abza: Ahmad (al-Musnad 3/406), Ibn al-Sunni ('Amal al-Yawm wa al-Layla 34)",
        'grade': 'Sahih',
        'where': "Sahih al-Jami' 4674",
        'url': 'https://surahquran.com/Hadith-96702.html',
    },
    'tahlil10': {
        'ar': 'من قال إذا أصبح : لا إله إلا اللهُ وحده لا شريك له ، له الملكُ ، و له الحمدُ ، و هو على كلِّ شيءٍ قديرٌ ( عشرَ مراتٍ ) ،',
        'cite': "Abu Ayyub al-Ansari: Ahmad, al-Nasa'i ('Amal al-Yawm wa al-Layla 24)",
        'grade': 'Hasan Sahih',
        'where': 'Sahih al-Targhib 474',
        'url': 'https://surahquran.com/Hadith-97535.html',
    },
    'turning': {
        'ar': 'كان إذا تضور من الليل قال: لا إله إلا الله الواحد القهار رب السموات والأرض وما بينهما العزيز الغفار',
        'cite': "'A'ishah: al-Nasa'i (al-Sunan al-Kubra), al-Hakim (al-Mustadrak 1/540), Ibn Hibban, Ibn al-Sunni",
        'grade': 'Sahih',
        'where': "Sahih al-Jami' 4693, al-Silsila al-Sahiha 2066",
        'url': 'https://en.tohed.com/hadith/sahih-al-jami-al-saghir/4693/',
    },
}

# Times, in the wording of the hadith: key -> label
WHEN = ('morning_evening', 'morning', 'evening', 'day', 'day_night', 'night', 'bed', 'turning', 'after_fajr')

ITEMS = [
    # ------------------------------------------------ morning and evening (Hisn 27)
    {
        'hisn': 75, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'name': 'ayat_kursi',
        'recite': [('hisn_cut', 75, 'أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ', 'الرَّجِيمِ'), ('quran', 2, 255, 255)],
        'meaning': 'quran',
        'primary': ('ext', 'ubayy'),
        'when_ar': [('ext', 'ubayy')],
        'about': {
            'en': ('mine', 'Whoever says it in the evening is protected from us [the jinn] until the morning, and whoever says it in the morning is protected from us until the evening.'),
            'fr': ('mine', "Celui qui la dit le soir est protégé de nous [les djinns] jusqu'au matin, et celui qui la dit le matin est protégé de nous jusqu'au soir."),
        },
        'refs': [('ext', 'ubayy')],
    },
    {
        'hisn': 76, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'name': 'muawwidhat',
        'recite': [('basmala', 76), ('quran', 112, 1, 4), ('basmala', 76), ('quran', 113, 1, 5), ('basmala', 76), ('quran', 114, 1, 6)],
        'meaning': 'quran',
        'primary': ('he', '6082'),
        'when_ar': [(('he', '6082'), 'ar', 'حِينَ تُمْسِي', 'ثَلَاثَ مَرَّاتٍ')],
        'about': {
            'en': (('he', '6082'), 'en', '{Say:', 'protection from everything.'),
            'fr': (('he', '6082'), 'fr', '{" Dis', 'pour tout !'),
        },
        'refs': [('h', 'abudawud', 5082), ('h', 'tirmidhi', 3575)],
    },
    {
        'hisn': 77, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 77)],
        'recite_evening': [
            (('h', 'muslim', 6908), 'ar', 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ', 'لاَ شَرِيكَ لَهُ'),
            (('h', 'muslim', 6908), 'ar', 'لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ', 'وَعَذَابٍ فِي الْقَبْرِ'),
        ],
        'meaning': {
            'en': (('hisn', 77), 'en', 'We have reached the morning', 'punishment in the grave.'),
            'fr': ('mine', "Nous nous retrouvons au matin, ainsi que la royauté, appartenant à Allah ; les louanges sont pour Allah, il n'est de divinité [digne d'adoration] excepté Allah, Lui Seul, Il n'a point d'associé. À Lui la royauté, à Lui les louanges et Il est capable de toute chose. Ô Seigneur ! Je Te demande le meilleur de ce qui se trouve dans ce jour et le meilleur de ce qui vient après. Et je cherche protection auprès de Toi contre le mal de ce qui se trouve dans ce jour et le mal de ce qui vient après. Ô Seigneur ! Je cherche protection auprès de Toi contre la paresse et les maux de la vieillesse. Ô Seigneur ! Je cherche protection auprès de Toi contre le châtiment du Feu et le châtiment de la tombe."),
        },
        'meaning_evening': {
            'en': [(('he', '3008'), 'en', 'The evening has reached', 'alone without any partner.'),
                   (('he', '3008'), 'en', 'To Him belongs the dominion', 'torment in the grave.')],
            'fr': [(('he', '3008'), 'fr', 'Nous nous retrouvons au soir', 'point d’associé.'),
                   (('he', '3008'), 'fr', 'A Lui la royauté', 'châtiment de la tombe.')],
        },
        'primary': ('he', '3008'),
        'when_ar': [(('h', 'muslim', 6908), 'ar', 'إِذَا أَمْسَى قَالَ', 'إِذَا أَمْسَى قَالَ'),
                    (('h', 'muslim', 6908), 'ar', 'وَإِذَا أَصْبَحَ قَالَ ذَلِكَ أَيْضًا', 'وَإِذَا أَصْبَحَ قَالَ ذَلِكَ أَيْضًا')],
        'about': {
            'en': (('he', '3008'), 'en', 'In the evening, the Prophet', 'used to say'),
            'fr': (('he', '3008'), 'fr', 'Lorsque le Prophète', 'il disait'),
        },
        'refs': [('h', 'muslim', 6908)],
    },
    {
        'hisn': 78, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 78)],
        'recite_evening': [('hisn_bracket', 78, 'وإذا أمسى قال: ')],
        'meaning': {
            'en': (('he', '5490'), 'en', 'O Allah, by You we have reached the morning', 'to You is the Resurrection.'),
            'fr': ('mine', "Ô Allah ! C'est par Toi que nous nous retrouvons au matin, par Toi que nous nous retrouvons au soir, par Toi que nous vivons, par Toi que nous mourons, et vers Toi est la résurrection."),
        },
        'meaning_evening': {
            'en': [(('hisn', 78), 'en', 'O Allah, by Your leave we have reached the evening', 'unto You is our return.')],
            'fr': [('mine', "Ô Allah ! C'est par Toi que nous nous retrouvons au soir, par Toi que nous nous retrouvons au matin, par Toi que nous vivons, par Toi que nous mourons, et vers Toi est le retour.")],
        },
        'primary': ('he', '5490'),
        'when_ar': [(('he', '5490'), 'ar', 'إِذَا أَصْبَحَ', 'إِذَا أَصْبَحَ'), (('he', '5490'), 'ar', 'وَإِذَا أَمْسَى قَالَ', 'وَإِذَا أَمْسَى قَالَ')],
        'about': {
            'en': (('he', '5490'), 'en', 'Upon reaching the morning, he used to say', 'Upon reaching the morning, he used to say'),
            'fr': ('mine', "Il disait cela lorsqu'il se retrouvait au matin, et il disait la formule du soir lorsqu'il se retrouvait au soir."),
        },
        'refs': [('h', 'abudawud', 5068), ('h', 'tirmidhi', 3391), ('h', 'ibnmajah', 3868)],
    },
    {
        'hisn': 79, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'day_night',
        'name': 'sayyid_istighfar',
        'recite': [('hisn_inner', 79)],
        'meaning': {
            'en': (('hisn', 79), 'en', 'O Allah, You are my Lord', 'none can forgive sin except You.'),
            'fr': ('mine', "Ô Allah ! Tu es mon Seigneur, il n'y a de divinité [digne d'adoration] que Toi. Tu m'as créé et je suis Ton serviteur. Je reste fidèle à Ton engagement et à Ta promesse autant que je le peux. Je cherche protection auprès de Toi contre le mal de ce que j'ai fait. Je reconnais devant Toi Ton bienfait envers moi, et je reconnais mon péché. Pardonne-moi donc, car nul ne pardonne les péchés à part Toi."),
        },
        'primary': ('he', '5503'),
        'when_ar': [(('he', '5503'), 'ar', 'وَمَنْ قَالَهَا مِنَ النَّهَارِ', 'وَمَنْ قَالَهَا مِنَ النَّهَارِ'), (('he', '5503'), 'ar', 'وَمَنْ قَالَهَا مِنَ اللَّيْلِ', 'وَمَنْ قَالَهَا مِنَ اللَّيْلِ')],
        'about': {
            'en': (('he', '5503'), 'en', 'And whoever says this during the day', 'from the people of Paradise."'),
            'fr': ('mine', "Celui qui la dit pendant la journée en étant convaincu de son contenu, puis meurt ce jour-là avant le soir, fait partie des gens du Paradis ; et celui qui la dit pendant la nuit en étant convaincu de son contenu, puis meurt avant le matin, fait partie des gens du Paradis."),
        },
        'refs': [('h', 'bukhari', 6306)],
    },
    {
        'hisn': 82, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'recite': [('hisn_inner', 82)],
        'meaning': {
            'en': [(('hisn', 82), 'en', 'O Allah, grant my body health', 'worshipped except You.'),
                   (('hisn', 82), 'en', 'O Allah, I take refuge with You from disbelief', 'worshipped except You.')],
            'fr': ('mine', "Ô Allah ! Accorde la santé à mon corps. Ô Allah ! Accorde la santé à mon ouïe. Ô Allah ! Accorde la santé à ma vue. Il n'y a de divinité [digne d'adoration] que Toi. Ô Allah ! Je cherche protection auprès de Toi contre la mécréance et la pauvreté, et je cherche protection auprès de Toi contre le châtiment de la tombe. Il n'y a de divinité [digne d'adoration] que Toi."),
        },
        'primary': ('h', 'abudawud', 5090),
        'when_ar': [(('h', 'abudawud', 5090), 'ar', 'تُعِيدُهَا ثَلاَثًا حِينَ تُصْبِحُ', 'وَثَلاَثًا حِينَ تُمْسِي')],
        'about': {
            'en': (('h', 'abudawud', 5090), 'en', 'You repeat them three times in the morning', 'I like to follow his practice.'),
            'fr': ('mine', "'Abd ar-Rahmân ibn Abî Bakrah dit à son père : « Je t'entends les répéter trois fois le matin et trois fois le soir. » Il répondit : « J'ai entendu le Messager d'Allah ﷺ invoquer par ces paroles, et j'aime suivre sa sunna. »"),
        },
        'refs': [('h', 'abudawud', 5090)],
    },
    {
        'hisn': 84, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 84)],
        'meaning': {
            'en': (('hisn', 84), 'en', 'O Allah, I ask You for pardon', 'swallowed up by the earth.'),
            'fr': ('mine', "Ô Allah ! Je Te demande le pardon et la préservation dans ce monde et dans l'au-delà. Ô Allah ! Je Te demande le pardon et la préservation dans ma religion, ma vie d'ici-bas, ma famille et mes biens. Ô Allah ! Couvre mes défauts et rassure-moi dans mes frayeurs. Ô Allah ! Protège-moi par devant, par derrière, à ma droite, à ma gauche et au-dessus de moi, et je cherche refuge auprès de Ta grandeur contre le fait d'être pris par surprise par en dessous."),
        },
        'primary': ('he', '5485'),
        'when_ar': [(('he', '5485'), 'ar', 'حِينَ يُمْسِي وَحِينَ يُصْبِحُ', 'حِينَ يُمْسِي وَحِينَ يُصْبِحُ')],
        'about': {
            'en': (('he', '5485'), 'en', 'The Messenger of Allah', 'in the evening and the morning'),
            'fr': ('mine', "Le Messager d'Allah ﷺ ne délaissait jamais ces invocations, le soir et le matin."),
        },
        'refs': [('h', 'abudawud', 5074), ('h', 'ibnmajah', 3871)],
    },
    {
        'hisn': 85, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 85)],
        'meaning': {
            'en': (('hisn', 85), 'en', 'O Allah, Knower of the unseen and the seen', 'upon another Muslim.'),
            'fr': (('he', '3006'), 'fr', 'Ô Allah ! Créateur des cieux', 'causer à un musulman.'),
        },
        'primary': ('he', '3006'),
        'when_ar': [(('he', '3006'), 'ar', 'قلها إذا أصبحت', 'مَضْجَعَك')],
        'about': {
            'en': (('he', '3006'), 'en', 'Recite them in the morning', 'when you go to bed.'),
            'fr': (('he', '3006'), 'fr', 'Dis-le le matin', 'quand tu te couches'),
        },
        'refs': [('h', 'tirmidhi', 3392), ('h', 'abudawud', 5067)],
    },
    {
        'hisn': 86, 'tabs': ['morning', 'evening'], 'count': 3, 'when': 'morning_evening',
        'recite': [('hisn_inner', 86)],
        'meaning': {
            'en': (('he', '6093'), 'en', 'In the name of Allah, with Whose name', 'the All-Knowing'),
            'fr': ('mine', "Au nom d'Allah, avec le nom duquel rien ne peut nuire, ni sur la terre ni dans le ciel, et Il est Celui qui entend tout, l'Omniscient."),
        },
        'primary': ('he', '6093'),
        'when_ar': [(('h', 'tirmidhi', 3388), 'ar', 'فِي صَبَاحِ كُلِّ يَوْمٍ وَمَسَاءِ كُلِّ لَيْلَةٍ', 'فِي صَبَاحِ كُلِّ يَوْمٍ وَمَسَاءِ كُلِّ لَيْلَةٍ')],
        'about': {
            'en': (('he', '6093'), 'en', 'Whoever says three times', 'until the evening.'),
            'fr': ('mine', "Celui qui la dit trois fois ne sera pas frappé par un malheur soudain jusqu'au matin, et celui qui la dit trois fois le matin ne sera pas frappé par un malheur soudain jusqu'au soir."),
        },
        'refs': [('h', 'abudawud', 5088), ('h', 'tirmidhi', 3388), ('h', 'ibnmajah', 3869)],
    },
    {
        'hisn': 88, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 88)],
        'meaning': {
            'en': (('hisn', 88), 'en', 'O Ever Living', 'the blink of an eye.'),
            'fr': ('mine', "Ô Vivant ! Ô Toi qui subsistes par Toi-même et fais subsister toute chose ! C'est par Ta miséricorde que je demande secours : arrange pour moi toutes mes affaires et ne me confie pas à moi-même, ne serait-ce que le temps d'un clin d'œil."),
        },
        'primary': ('ext', 'fatimah'),
        'when_ar': [('ext', 'fatimah')],
        'about': {
            'en': ('mine', 'The Prophet ﷺ told Fatimah: "That you say, when you reach the morning and when you reach the evening: …"'),
            'fr': ('mine', "Le Prophète ﷺ dit à Fâtimah : « Que tu dises, quand tu te retrouves au matin et quand tu te retrouves au soir : … »"),
        },
        'refs': [('ext', 'fatimah')],
    },
    {
        'hisn': 90, 'tabs': ['morning', 'evening'], 'count': 1, 'when': 'morning_evening',
        'recite': [('hisn_inner', 90)],
        'recite_evening_note': ('hisn_bracket', 90, 'وإذا أمسى قال: '),
        'meaning': {
            'en': (('hisn', 90), 'en', 'We rise upon the fitrah of Islam', 'associate others with Allah.'),
            'fr': ('mine', "Nous nous retrouvons au matin sur la saine nature (fitra) de l'islam, sur la parole de la sincérité, sur la religion de notre Prophète Muhammad ﷺ et sur la voie de notre père Ibrâhîm, monothéiste pur, soumis [à Allah], et qui n'était pas du nombre des associateurs."),
        },
        'evening_note': {
            'en': (('hisn', 90), 'en', 'Note: for the evening', 'instead of asbahna.'),
            'fr': ('mine', 'Le soir, on dit « amsaynâ » (nous nous retrouvons au soir) au lieu de « asbahnâ ».'),
        },
        'primary': ('ext', 'fitrah'),
        'when_ar': [('ext_cut', 'fitrah', 'كان إذا أصبحَ', 'أَمْسَى قال')],
        'about': {
            'en': ('mine', 'When morning came and when evening came, he ﷺ would say: …'),
            'fr': ('mine', "Lorsqu'il se retrouvait au matin et lorsqu'il se retrouvait au soir, il ﷺ disait : …"),
        },
        'refs': [('ext', 'fitrah')],
    },
    {
        'hisn': 91, 'tabs': ['morning', 'evening'], 'count': 100, 'when': 'morning_evening',
        'recite': [('hisn_inner', 91)],
        'meaning': {
            'en': (('hisn', 91), 'en', 'How perfect Allah is and I praise Him.', 'How perfect Allah is and I praise Him.'),
            'fr': ('mine', 'Gloire et pureté à Allah, et par Sa louange.'),
        },
        'primary': ('h', 'muslim', 6843),
        'when_ar': [(('h', 'muslim', 6843), 'ar', 'حِينَ يُصْبِحُ وَحِينَ يُمْسِي', 'حِينَ يُصْبِحُ وَحِينَ يُمْسِي')],
        'about': {
            'en': (('h', 'muslim', 6843), 'en', 'He who recites in the morning', 'more than these words'),
            'fr': ('mine', "Celui qui dit le matin et le soir « Subhâna Llâhi wa bi-hamdih » cent fois, personne ne viendra le Jour de la Résurrection avec quelque chose de meilleur que ce qu'il apportera, sauf quelqu'un qui aura dit la même chose ou davantage."),
        },
        'refs': [('h', 'muslim', 6843)],
    },
    {
        'hisn': 92, 'tabs': ['morning', 'evening'], 'count': 10, 'when': 'morning_evening',
        'count_note': {
            'en': ('hisn_en_tail', 92, '[ten times or once if lazy]'),
            'fr': ('mine', "10 fois, ou une seule fois en cas de paresse (Hisn al-Muslim)."),
        },
        'recite': [('hisn_cut', 92, 'لاَ إِلَهَ إِلاَّ اللَّهُ', 'قَدِيرٌ')],
        'meaning': {
            'en': (('hisn', 92), 'en', 'None has the right to be worshipped', 'over all things omnipotent.'),
            'fr': ('mine', "Il n'y a de divinité [digne d'adoration] qu'Allah, Seul, sans associé. À Lui la royauté et à Lui la louange, et Il est capable de toute chose."),
        },
        'primary': ('h', 'abudawud', 5077),
        'when_ar': [(('h', 'abudawud', 5077), 'ar', 'مَنْ قَالَ إِذَا أَصْبَحَ', 'مَنْ قَالَ إِذَا أَصْبَحَ'), (('h', 'abudawud', 5077), 'ar', 'وَإِنْ قَالَهَا إِذَا أَمْسَى', 'وَإِنْ قَالَهَا إِذَا أَمْسَى')],
        'about': {
            'en': (('h', 'abudawud', 5077), 'en', 'If anyone says in the morning', 'till the morning.'),
            'fr': ('mine', "Celui qui la dit le matin aura l'équivalent [de la récompense] de l'affranchissement d'un esclave parmi les descendants d'Ismâ'îl ; dix bonnes actions lui seront inscrites, dix mauvaises actions lui seront effacées, il sera élevé de dix degrés et il sera protégé du diable jusqu'au soir. Et s'il la dit le soir, il aura la même chose jusqu'au matin."),
        },
        'refs': [('h', 'abudawud', 5077), ('h', 'ibnmajah', 3867), ('ext', 'tahlil10')],
    },
    {
        'hisn': 94, 'tabs': ['morning'], 'count': 3, 'when': 'morning',
        'recite': [('hisn_inner', 94)],
        'meaning': {
            'en': (('hisn', 94), 'en', 'How perfect Allah is and I praise Him by the number', 'the ink of His words.'),
            'fr': ('mine', "Gloire et pureté à Allah, et par Sa louange, autant que le nombre de Ses créatures, autant qu'il Lui plaît, autant que le poids de Son Trône et autant que l'encre de Ses paroles."),
        },
        'primary': ('he', '5508'),
        'when_ar': [(('he', '5508'), 'ar', 'بُكْرَةً حِينَ صَلَّى الصُّبْحَ', 'بُكْرَةً حِينَ صَلَّى الصُّبْحَ')],
        'about': {
            'en': (('he', '5508'), 'en', 'I said four words three times after I had left you', 'they would outweigh them'),
            'fr': ('mine', "J'ai dit après toi quatre paroles, trois fois ; si on les pesait contre tout ce que tu as dit depuis ce matin, elles l'emporteraient."),
        },
        'refs': [('h', 'muslim', 6913)],
    },
    {
        'hisn': 95, 'tabs': ['morning'], 'count': 1, 'when': 'after_fajr',
        'recite': [('hisn_inner', 95)],
        'meaning': {
            'en': (('hisn', 95), 'en', 'O Allah, I ask You for knowledge', 'deeds which are acceptable.'),
            'fr': ('mine', 'Ô Allah ! Je Te demande une science utile, une subsistance bonne et des œuvres acceptées.'),
        },
        'primary': ('h', 'ibnmajah', 925),
        'when_ar': [(('h', 'ibnmajah', 925), 'ar', 'إِذَا صَلَّى الصُّبْحَ حِينَ يُسَلِّمُ', 'إِذَا صَلَّى الصُّبْحَ حِينَ يُسَلِّمُ')],
        'about': {
            'en': (('h', 'ibnmajah', 925), 'en', 'It was narrated from Umm Salamah', 'he would say'),
            'fr': ('mine', "Lorsque le Prophète ﷺ priait la prière du matin (Subh), au moment du salut final, il disait : …"),
        },
        'refs': [('h', 'ibnmajah', 925)],
    },
    {
        'hisn': 97, 'tabs': ['evening'], 'count': 3, 'when': 'evening',
        'recite': [('hisn_inner', 97)],
        'meaning': {
            'en': (('hisn', 97), 'en', 'I take refuge in Allah', 'the evil He has created.'),
            'fr': ('mine', "Je cherche refuge auprès des paroles parfaites d'Allah contre le mal de ce qu'Il a créé."),
        },
        'primary': ('h', 'muslim', 6880),
        'when_ar': [(('h', 'muslim', 6880), 'ar', 'حِينَ أَمْسَيْتَ', 'حِينَ أَمْسَيْتَ')],
        'about': {
            'en': (('h', 'muslim', 6880), 'en', 'Had you recited these words in the evening', 'would not have done any harm to you'),
            'fr': ('mine', "Si tu avais dit, en arrivant au soir : « Je cherche refuge auprès des paroles parfaites d'Allah contre le mal de ce qu'Il a créé », il [le scorpion] ne t'aurait pas nui."),
        },
        'count_source': (('h', 'tirmidhi', '3604.02'), 'en', 'Whoever says three times when he reaches the evening', 'shall harm him that night.'),
        'refs': [('h', 'muslim', 6880), ('h', 'ibnmajah', 3518), ('h', 'tirmidhi', '3604.02')],
        'grade_override': {'tirmidhi 3604.02': ('Sahih', "Sahih al-Tirmidhi 3/187, as cited in Hisn al-Muslim")},
    },
    # ------------------------------------------------ any time of the day
    {
        'hisn': 93, 'tabs': ['day'], 'count': 100, 'when': 'day',
        'hisn_note': {
            'en': ('mine', 'Hisn al-Muslim lists it with the morning adhkar («مائة مرة إذا أصبح»); the hadith says «فِي يَوْمٍ», "in a day".'),
            'fr': ('mine', "Hisn al-Muslim le place avec les adhkar du matin («مائة مرة إذا أصبح») ; le hadith dit «فِي يَوْمٍ», « dans une journée »."),
        },
        'recite': [('hisn_inner', 93)],
        'meaning': {
            'en': (('hisn', 93), 'en', 'None has the right to be worshipped', 'over all things omnipotent.'),
            'fr': ('mine', "Il n'y a de divinité [digne d'adoration] qu'Allah, Seul, sans associé. À Lui la royauté et à Lui la louange, et Il est capable de toute chose."),
        },
        'primary': ('he', '65905'),
        'when_ar': [(('he', '65905'), 'ar', 'فِي يَوْمٍ مِائَةَ مَرَّةٍ', 'فِي يَوْمٍ مِائَةَ مَرَّةٍ'), (('he', '65905'), 'ar', 'يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ', 'يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ')],
        'about': {
            'en': (('he', '65905'), 'en', 'Whoever says a hundred times in a day', 'someone who says more than that.'),
            'fr': ('mine', "Celui qui la dit cent fois dans une journée aura l'équivalent de l'affranchissement de dix esclaves ; cent bonnes actions lui seront inscrites, cent mauvaises actions lui seront effacées, et ce sera pour lui une protection contre le diable ce jour-là jusqu'au soir ; et personne n'apportera mieux que ce qu'il a apporté, sauf quelqu'un qui en aura fait davantage."),
        },
        'refs': [('h', 'bukhari', 3293), ('h', 'muslim', 6842)],
    },
    {
        'hisn': 96, 'tabs': ['day'], 'count': 100, 'when': 'day',
        'recite': [('hisn_inner', 96)],
        'meaning': {
            'en': (('he', '4808'), 'en', 'I ask Allah for forgiveness and repent to Him', 'I ask Allah for forgiveness and repent to Him'),
            'fr': (('he', '4808'), 'fr', 'Je demande certes pardon à Allah et me repens à Lui', 'Je demande certes pardon à Allah et me repens à Lui'),
        },
        'primary': ('he', '4808'),
        'when_ar': [(('h', 'muslim', 6858), 'ar', 'فِي الْيَوْمِ مِائَةَ مَرَّةٍ', 'فِي الْيَوْمِ مِائَةَ مَرَّةٍ')],
        'about': {
            'en': (('he', '4808'), 'en', 'By Allah! I ask Allah', 'seventy times a day.'),
            'fr': (('he', '4808'), 'fr', 'Par Allah ! Je demande', 'dans la journée.'),
        },
        'count_source': (('h', 'muslim', 6858), 'en', 'I seek forgiveness from Allah a hundred times a day', 'I seek forgiveness from Allah a hundred times a day'),
        'refs': [('h', 'bukhari', 6307), ('h', 'muslim', 6858)],
    },
    # ------------------------------------------------ night (Hisn 28: "at night" wording)
    {
        'hisn': 101, 'tabs': ['night'], 'group': 'night', 'count': 1, 'when': 'night',
        'name': 'baqarah_end',
        'hisn_note': {
            'en': ('mine', 'Hisn al-Muslim lists it with the sleep adhkar; the hadith says «فِي لَيْلَةٍ», "in a night".'),
            'fr': ('mine', "Hisn al-Muslim le place avec les adhkar du coucher ; le hadith dit «فِي لَيْلَةٍ», « dans une nuit »."),
        },
        'recite': [('quran', 2, 285, 286)],
        'meaning': 'quran',
        'primary': ('he', '6274'),
        'when_ar': [(('he', '6274'), 'ar', 'فِي لَيْلَةٍ', 'فِي لَيْلَةٍ')],
        'about': {
            'en': (('he', '6274'), 'en', 'Whoever recites the last two verses', 'they will suffice him.'),
            'fr': (('he', '6274'), 'fr', 'Quiconque récite', 'ils lui suffiront.'),
        },
        'refs': [('h', 'bukhari', 5009), ('h', 'muslim', 1880)],
    },
    # ------------------------------------------------ going to bed (Hisn 28)
    {
        'hisn': 99, 'tabs': ['night'], 'group': 'bed', 'count': 3, 'when': 'bed',
        'name': 'muawwidhat_bed',
        'recite': [('basmala', 99), ('quran', 112, 1, 4), ('basmala', 99), ('quran', 113, 1, 5), ('basmala', 99), ('quran', 114, 1, 6)],
        'meaning': 'quran',
        'primary': ('he', '5879'),
        'when_ar': [(('he', '5879'), 'ar', 'كان إذا أَوَى إلى فِرَاشِهِ كل ليلة', 'كان إذا أَوَى إلى فِرَاشِهِ كل ليلة')],
        'about': {
            'en': (('he', '5879'), 'en', 'Whenever the Prophet', 'He would do this three times.'),
            'fr': (('he', '5879'), 'fr', 'Chaque nuit, lorsque', 'il répétait cela trois fois.'),
        },
        'refs': [('h', 'bukhari', 5017)],
    },
    {
        'hisn': 100, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'name': 'ayat_kursi_bed',
        'recite': [('quran', 2, 255, 255)],
        'meaning': 'quran',
        'primary': ('h', 'bukhari', 2311),
        'when_ar': [(('h', 'bukhari', 2311), 'ar', 'إِذَا أَوَيْتَ إِلَى فِرَاشِكَ فَاقْرَأْ آيَةَ الْكُرْسِيِّ', 'إِذَا أَوَيْتَ إِلَى فِرَاشِكَ فَاقْرَأْ آيَةَ الْكُرْسِيِّ')],
        'about': {
            'en': (('h', 'bukhari', 2311), 'en', 'Whenever you go to bed, recite', 'no satan will come near you till morning.'),
            'fr': ('mine', "Lorsque tu te mets au lit, récite le Verset du Trône jusqu'à la fin du verset : un gardien de la part d'Allah ne cessera d'être auprès de toi, et aucun diable ne s'approchera de toi jusqu'au matin."),
        },
        'confirm': {
            'en': (('h', 'bukhari', 2311), 'en', 'He really spoke the truth', 'absolute liar.'),
            'fr': ('mine', "Il t'a dit la vérité, alors qu'il est un grand menteur."),
        },
        'muallaq': True,
        'refs': [('h', 'bukhari', 2311)],
    },
    {
        'hisn': 102, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 102)],
        'meaning': {
            'en': (('he', '6034'), 'en', 'In Your Name, O my Lord', 'Your righteous slaves.'),
            'fr': (('he', '6034'), 'fr', 'C’est en Ton nom', 'Tes serviteurs vertueux !'),
        },
        'primary': ('he', '6034'),
        'when_ar': [(('he', '6034'), 'ar', 'إذا أوى أحدكم إلى فراشه', 'إذا أوى أحدكم إلى فراشه')],
        'about': {
            'en': (('he', '6034'), 'en', 'When any one of you goes to his bed', 'after he had left it.'),
            'fr': (('he', '6034'), 'fr', 'Lorsque l’un d', 'succédé sur celle-ci.'),
        },
        'refs': [('h', 'bukhari', 6320), ('h', 'muslim', 6892)],
    },
    {
        'hisn': 103, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 103)],
        'meaning': {
            'en': (('hisn', 103), 'en', 'O Allah, verily You have created my soul', 'grant me good health.'),
            'fr': ('mine', "Ô Allah ! C'est Toi qui as créé mon âme et c'est Toi qui la reprends ; à Toi sa mort et sa vie. Si Tu la fais vivre, protège-la, et si Tu la fais mourir, pardonne-lui. Ô Allah ! Je Te demande la préservation."),
        },
        'primary': ('h', 'muslim', 6888),
        'when_ar': [(('h', 'muslim', 6888), 'ar', 'إِذَا أَخَذَ مَضْجَعَهُ', 'إِذَا أَخَذَ مَضْجَعَهُ')],
        'about': {
            'en': (('h', 'muslim', 6888), 'en', "Abdullah b. 'Umar commanded a person", 'from Allah\'s Messenger (ﷺ)'),
            'fr': ('mine', "'Abdullâh ibn 'Umar ordonna à un homme de dire ceci en se couchant. On lui demanda : « L'as-tu entendu de 'Umar ? » Il répondit : « De quelqu'un de meilleur que 'Umar : du Messager d'Allah ﷺ. »"),
        },
        'refs': [('h', 'muslim', 6888)],
    },
    {
        'hisn': 104, 'tabs': ['night'], 'group': 'bed', 'count': 3, 'when': 'bed',
        'recite': [('hisn_inner', 104)],
        'meaning': {
            'en': (('hisn', 104), 'en', 'O Allah, protect me from Your punishment', 'servants are resurrected.'),
            'fr': ('mine', 'Ô Allah ! Préserve-moi de Ton châtiment le jour où Tu ressusciteras Tes serviteurs.'),
        },
        'primary': ('h', 'abudawud', 5045),
        'when_ar': [(('h', 'abudawud', 5045), 'ar', 'كَانَ إِذَا أَرَادَ أَنْ يَرْقُدَ', 'تَحْتَ خَدِّهِ'), (('h', 'abudawud', 5045), 'ar', 'ثَلاَثَ مِرَارٍ', 'ثَلاَثَ مِرَارٍ')],
        'about': {
            'en': (('h', 'abudawud', 5045), 'en', 'When the Messenger of Allah (ﷺ) wanted to go to sleep', 'would then say three times'),
            'fr': ('mine', "Lorsque le Messager d'Allah ﷺ voulait dormir, il plaçait sa main droite sous sa joue puis disait trois fois : …"),
        },
        'refs': [('h', 'abudawud', 5045), ('h', 'tirmidhi', 3399)],
    },
    {
        'hisn': 105, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 105)],
        'meaning': {
            'en': (('h', 'bukhari', 6324), 'en', 'With Your name, O Allah, I die and I live', 'With Your name, O Allah, I die and I live'),
            'fr': ('mine', "C'est en Ton nom, ô Allah, que je meurs et que je vis."),
        },
        'primary': ('h', 'bukhari', 6324),
        'when_ar': [(('h', 'bukhari', 6324), 'ar', 'إِذَا أَرَادَ أَنْ يَنَامَ', 'إِذَا أَرَادَ أَنْ يَنَامَ')],
        'about': {
            'en': (('h', 'bukhari', 6324), 'en', 'Whenever the Prophet (ﷺ) intended to go to bed', 'he would recite'),
            'fr': ('mine', 'Lorsque le Prophète ﷺ voulait dormir, il disait : …'),
        },
        'refs': [('h', 'bukhari', 6324), ('h', 'muslim', 6887)],
    },
    {
        'hisn': 106, 'tabs': ['night'], 'group': 'bed', 'count': [33, 33, 34], 'when': 'bed',
        'name': 'tasbih_fatimah',
        'recite': [('hisn_inner', 106)],
        'meaning': {
            'en': (('he', '6076'), 'en', '‘Subhān Allah', 'thirty-four times'),
            'fr': ('mine', 'Gloire et pureté à Allah (33 fois), louange à Allah (33 fois), Allah est le plus Grand (34 fois).'),
        },
        'primary': ('he', '6076'),
        'when_ar': [(('he', '6076'), 'ar', 'إِذَا أَخَذْتُمَا مَضَاجِعَكُمَا', 'إِلَى فِرَاشِكُمَا')],
        'about': {
            'en': (('he', '6076'), 'en', 'This is better for you than a servant.', 'This is better for you than a servant.'),
            'fr': ('mine', 'Cela est meilleur pour vous qu’un serviteur.'),
        },
        'refs': [('h', 'bukhari', 6318), ('h', 'bukhari', 3705), ('h', 'muslim', 6915)],
    },
    {
        'hisn': 107, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 107)],
        'meaning': {
            'en': (('he', '6335'), 'en', 'O Allah, Lord of the heavens', 'relieve us of poverty.'),
            'fr': (('he', '6335'), 'fr', 'Ô Allah ! Seigneur des Cieux', 'affranchis-nous de la pauvreté !'),
        },
        'primary': ('he', '6335'),
        'when_ar': [(('he', '6335'), 'ar', 'إذا أراد أحدُنا أن ينامَ', 'على شِقِّه الأيمن')],
        'about': {
            'en': (('he', '6335'), 'en', 'Abu Sālih used to order us', 'and then say'),
            'fr': (('he', '6335'), 'fr', 'Lorsque l’un d’entre nous voulait dormir', 'qu’il dise'),
        },
        'refs': [('h', 'muslim', 6889), ('h', 'muslim', 6891)],
    },
    {
        'hisn': 108, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 108)],
        'meaning': {
            'en': (('he', '5882'), 'en', 'Praise be to Allah Who gave us food', 'to give them shelter.'),
            'fr': (('he', '5882'), 'fr', 'Louange à Allah qui nous a nourris', 'ou les abriter !'),
        },
        'primary': ('he', '5882'),
        'when_ar': [(('he', '5882'), 'ar', 'كان إذا أوى إلى فراشه', 'كان إذا أوى إلى فراشه')],
        'about': {
            'en': ('mine', 'When he ﷺ went to bed, he would say: …'),
            'fr': (('he', '5882'), 'fr', 'lorsque le Prophète', 'il disait'),
        },
        'refs': [('h', 'muslim', 6894)],
    },
    {
        'hisn': 109, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 109)],
        'meaning': {
            'en': (('hisn', 109), 'en', 'O Allah, Knower of the seen and the unseen', 'upon another Muslim.'),
            'fr': (('he', '3006'), 'fr', 'Ô Allah ! Créateur des cieux', 'causer à un musulman.'),
        },
        'primary': ('he', '3006'),
        'when_ar': [(('he', '3006'), 'ar', 'وإذا أخذْتَ مَضْجَعَك', 'وإذا أخذْتَ مَضْجَعَك')],
        'about': {
            'en': (('he', '3006'), 'en', 'Recite them in the morning', 'when you go to bed.'),
            'fr': (('he', '3006'), 'fr', 'Dis-le le matin', 'quand tu te couches'),
        },
        'refs': [('h', 'abudawud', 5067), ('h', 'tirmidhi', 3392)],
    },
    {
        'hisn': 110, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'name': 'mulk_sajdah',
        'recite': [('hisn_inner', 110)],
        'surahs': [32, 67],
        'meaning': {
            'en': (('hisn', 110), 'en', 'The Prophet', '(chapter 67).'),
            'fr': ('mine', 'Le Prophète ﷺ ne dormait pas avant d’avoir récité la sourate as-Sajda (32) et la sourate al-Mulk (67).'),
        },
        'primary': ('h', 'tirmidhi', 3404),
        'when_ar': [(('h', 'tirmidhi', 3404), 'ar', 'لاَ يَنَامُ حَتَّى يَقْرَأَ', 'لاَ يَنَامُ حَتَّى يَقْرَأَ')],
        'about': {
            'en': (('h', 'tirmidhi', 3404), 'en', 'The Prophet would not sleep', 'Tabarak.'),
            'fr': ('mine', 'Le Prophète ﷺ ne dormait pas avant d’avoir récité Tanzîl as-Sajda et Tabârak.'),
        },
        'virtue': {
            'src': ('h', 'tirmidhi', 2891),
            'en': (('h', 'tirmidhi', 2891), 'en', 'Indeed there is a Surah', 'Biyadihil-Mulk'),
            'fr': ('mine', "Il y a dans le Coran une sourate de trente versets qui a intercédé pour un homme jusqu'à ce qu'il soit pardonné : c'est la sourate Tabârak (al-Mulk)."),
        },
        'refs': [('h', 'tirmidhi', 3404), ('h', 'tirmidhi', 2891)],
    },
    {
        'hisn': 111, 'tabs': ['night'], 'group': 'bed', 'count': 1, 'when': 'bed',
        'recite': [('hisn_inner', 111)],
        'meaning': {
            'en': (('hisn', 111), 'en', 'O Allah, I submit my soul unto You', 'whom You have sent.'),
            'fr': ('mine', "Ô Allah ! Je Te soumets mon âme, je Te confie mon affaire, je tourne mon visage vers Toi et je m'adosse à Toi, par désir [de Ta récompense] et par crainte [de Toi]. Il n'y a de refuge ni de salut contre Toi qu'auprès de Toi. J'ai cru en Ton Livre que Tu as fait descendre et en Ton Prophète que Tu as envoyé."),
        },
        'primary': ('h', 'bukhari', 6313),
        'when_ar': [(('h', 'bukhari', 247), 'ar', 'إِذَا أَتَيْتَ مَضْجَعَكَ فَتَوَضَّأْ', 'عَلَى شِقِّكَ الأَيْمَنِ'), (('h', 'bukhari', 247), 'ar', 'وَاجْعَلْهُنَّ آخِرَ مَا تَتَكَلَّمُ بِهِ', 'وَاجْعَلْهُنَّ آخِرَ مَا تَتَكَلَّمُ بِهِ')],
        'about': {
            'en': (('h', 'bukhari', 6313), 'en', 'And if you should die then', 'religion of Islam'),
            'fr': ('mine', 'Si tu meurs [cette nuit-là], tu mourras sur la fitra (l’islam).'),
        },
        'practice': {
            'en': [(('h', 'bukhari', 247), 'en', 'Whenever you go to bed perform ablution', 'lie on your right side'), '…', (('h', 'bukhari', 247), 'en', 'Let the aforesaid words be your last utterance', '(before sleep).')],
            'fr': ('mine', 'Lorsque tu te mets au lit, fais tes ablutions comme pour la prière, puis couche-toi sur le côté droit. Fais que ce soient tes dernières paroles.'),
        },
        'refs': [('h', 'bukhari', 6313), ('h', 'bukhari', 247), ('h', 'muslim', 6882)],
    },
    # ------------------------------------------------ turning over at night (Hisn 29)
    {
        'hisn': 112, 'tabs': ['night'], 'group': 'turning', 'count': 1, 'when': 'turning',
        'recite': [('hisn_inner', 112)],
        'meaning': {
            'en': (('hisn', 112), 'en', 'None has the right to be worshipped except Allah, The One', 'The Oft-Forgiving.'),
            'fr': ('mine', "Il n'y a de divinité [digne d'adoration] qu'Allah, l'Unique, le Dominateur suprême, Seigneur des cieux, de la terre et de ce qui est entre eux, le Tout-Puissant, Celui qui pardonne abondamment."),
        },
        'primary': ('ext', 'turning'),
        'when_ar': [('ext_cut', 'turning', 'كان إذا تضور من الليل', 'كان إذا تضور من الليل')],
        'about': {
            'en': ('mine', 'When he ﷺ turned over [in bed] during the night, he would say: …'),
            'fr': ('mine', "Lorsqu'il ﷺ se retournait [dans son lit] pendant la nuit, il disait : …"),
        },
        'refs': [('ext', 'turning')],
    },
]

TIMES_EVIDENCE = {
    'src': ('h', 'abudawud', 3667),
    'ar': [(('h', 'abudawud', 3667), 'ar', 'مِنْ صَلاَةِ الْغَدَاةِ حَتَّى تَطْلُعَ الشَّمْسُ', 'مِنْ صَلاَةِ الْغَدَاةِ حَتَّى تَطْلُعَ الشَّمْسُ'),
           (('h', 'abudawud', 3667), 'ar', 'مِنْ صَلاَةِ الْعَصْرِ إِلَى أَنْ تَغْرُبَ الشَّمْسُ', 'مِنْ صَلاَةِ الْعَصْرِ إِلَى أَنْ تَغْرُبَ الشَّمْسُ')],
    'en': (('h', 'abudawud', 3667), 'en', 'That I sit in the company', 'till the sun sets is dearer to me than that I emancipate four slaves'),
    'fr': ('mine', "Que je m'assoie avec des gens qui évoquent Allah, depuis la prière du matin jusqu'au lever du soleil, m'est plus cher que d'affranchir quatre [esclaves] des descendants d'Ismâ'îl ; et que je m'assoie avec des gens qui évoquent Allah, depuis la prière du 'asr jusqu'au coucher du soleil, m'est plus cher que d'affranchir quatre [esclaves]."),
}

# Hisn al-Muslim items of chapter 27 left out: al-Albani graded the hadith weak.
EXCLUDED = [
    {'hisn': 80, 'refs': [('h', 'abudawud', 5069), ('h', 'abudawud', 5078)]},
    {'hisn': 81, 'refs': [('h', 'abudawud', 5073)]},
    {'hisn': 83, 'refs': [('h', 'abudawud', 5081)]},
    {'hisn': 87, 'refs': [('h', 'abudawud', 5072), ('h', 'tirmidhi', 3389), ('h', 'ibnmajah', 3870)]},
    {'hisn': 89, 'refs': [('h', 'abudawud', 5084)]},
    {'hisn': 98, 'refs': [], 'albani': {
        'en': "al-Tabarani. Al-Albani first graded it hasan (Sahih al-Jami' 5357), then weakened it (al-Silsila al-Da'ifa 5788).",
        'fr': "At-Tabarânî. Al-Albânî l'a d'abord jugé hasan (Sahîh al-Jâmi' 5357), puis faible (as-Silsila ad-Da'îfa 5788).",
        'url': 'https://islamqa.info/ar/answers/130213',
    }},
]


# ---------------------------------------------------------------- build

class Builder:
    def __init__(self, hadith, he, hisn):
        self.hadith, self.he, self.hisn = hadith, he, hisn

    def source_text(self, ref, lang, where):
        kind = ref[0]
        if kind == 'h':
            h = self.hadith.get(ref[1], ref[2])
            return h[lang]
        if kind == 'he':
            row = self.he.get(ref[1])
            if lang not in row:
                raise BuildError(f'{where}: HadeethEnc {ref[1]} has no {lang}')
            return row[lang]
        if kind == 'hisn':
            return self.hisn.get(ref[1])[lang]
        raise BuildError(f'{where}: unknown ref {ref}')

    def text(self, spec, where):
        """Return {'text', 'src'} for a text spec."""
        if spec[0] == 'mine':
            return {'text': spec[1], 'src': 'mine'}
        if spec[0] == 'hisn_en_tail':
            full = self.hisn.get(spec[1])['en']
            if spec[2] not in full:
                raise BuildError(f'{where}: {spec[2]!r} not in Hisn {spec[1]} English')
            return {'text': spec[2], 'src': src_label(('hisn', spec[1]))}
        ref, lang = spec[0], spec[1]
        full = self.source_text(ref, lang, where)
        if len(spec) == 2:
            return {'text': full, 'src': src_label(ref)}
        return {'text': cut(full, spec[2], spec[3], where), 'src': src_label(ref)}

    def joined(self, spec, where):
        # A list joins several excerpts of one source. A bare '…' in the list
        # marks words of the source left out between two excerpts.
        if isinstance(spec, list):
            parts = [p if p == '…' else self.text(p, where) for p in spec]
            texts = [p if p == '…' else p['text'] for p in parts]
            srcs = {p['src'] for p in parts if p != '…'}
            if len(srcs) != 1:
                raise BuildError(f'{where}: joined excerpts come from different sources {srcs}')
            return {'text': ' '.join(texts), 'src': srcs.pop()}
        return self.text(spec, where)

    def recite(self, segs, where):
        out = []
        for seg in segs:
            kind = seg[0]
            if kind == 'quran':
                out.append({'quran': [seg[1], seg[2], seg[3]]})
            elif kind == 'basmala':
                full = self.hisn.get(seg[1])['ar']
                out.append({'ar': cut(full, 'بسم الله الرحمن الرحيم', 'بسم الله الرحمن الرحيم', where), 'src': src_label(('hisn', seg[1]))})
            elif kind == 'hisn_inner':
                out.append({'ar': inner(self.hisn.get(seg[1])['ar'], where), 'src': src_label(('hisn', seg[1]))})
            elif kind == 'hisn_cut':
                out.append({'ar': cut(self.hisn.get(seg[1])['ar'], seg[2], seg[3], where), 'src': src_label(('hisn', seg[1]))})
            elif kind == 'hisn_bracket':
                full = self.hisn.get(seg[1])['ar']
                i = full.find('[' + seg[2])
                if i < 0:
                    i = full.find('[ ' + seg[2])
                if i < 0:
                    raise BuildError(f'{where}: no bracket {seg[2]!r}')
                j = full.find(']', i)
                body = full[i + 1:j].strip()
                out.append({'ar': body[len(seg[2]):].strip() if body.startswith(seg[2]) else body, 'src': src_label(('hisn', seg[1]))})
            else:
                t = self.text(seg, where)
                out.append({'ar': t['text'], 'src': t['src']})
        return out

    def when_ar(self, specs, where):
        out = []
        for spec in specs:
            if spec[0] == 'ext':
                out.append({'ar': EXT[spec[1]]['ar'], 'src': ext_label(spec[1])})
            elif spec[0] == 'ext_cut':
                out.append({'ar': cut(EXT[spec[1]]['ar'], spec[2], spec[3], where), 'src': ext_label(spec[1])})
            else:
                t = self.text(spec, where)
                out.append({'ar': t['text'], 'src': t['src']})
        return out

    def ref(self, spec, overrides=None):
        if spec[0] == 'ext':
            e = EXT[spec[1]]
            return {'label': e['cite'], 'grade': e['grade'], 'grader': 'al-Albani', 'where': e['where'], 'url': e['url']}
        h = self.hadith.get(spec[1], spec[2])
        key = f'{spec[1]} {spec[2]}'
        out = {'label': f'{BOOK_NAMES[spec[1]]} {h["number"]}', 'url': hadith_link(h), 'book': spec[1]}
        if overrides and key in overrides:
            out['grade'], out['where'] = overrides[key]
            out['grader'] = 'al-Albani'
        elif spec[1] in ('bukhari', 'muslim'):
            out['grade'] = 'Sahih'
            out['grader'] = 'sahihayn'
        else:
            if not h['albani']:
                raise BuildError(f'{key}: no al-Albani grade in the dataset')
            out['grade'] = h['albani']
            out['grader'] = 'al-Albani'
        return out

    def src_table(self, data):
        """Label and link for every source tag used in the data, so the page can
        say under each text exactly where it was copied from."""
        tags = set()

        def walk(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ('src', 'arSrc') and isinstance(value, str):
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
                e = EXT[rest]
                table[tag] = {'label': e['cite'], 'url': e['url'], 'where': e['where']}
            else:
                raise BuildError(f'unknown source tag {tag!r}')
        return table

    def primary(self, spec):
        if spec[0] == 'ext':
            e = EXT[spec[1]]
            return {'ar': e['ar'], 'arSrc': ext_label(spec[1]), 'url': e['url'], 'excerpt': True}
        if spec[0] == 'he':
            row = self.he.get(spec[1])
            out = {'ar': row['ar'], 'arSrc': src_label(spec), 'url': row['link'].get('ar')}
            for lang in ('en', 'fr'):
                if lang in row:
                    out[lang] = {'text': row[lang], 'src': src_label(spec), 'url': row['link'][lang]}
                    if row.get(f'{lang}_explanation'):
                        out[f'{lang}Explain'] = {'text': row[f'{lang}_explanation'], 'src': src_label(spec), 'url': row['link'][lang]}
            return out
        h = self.hadith.get(spec[1], spec[2])
        return {'ar': h['ar'], 'arSrc': src_label(spec), 'url': hadith_link(h),
                'en': {'text': h['en'], 'src': src_label(spec), 'url': hadith_link(h)}}

    def item(self, spec):
        where = f'Hisn {spec["hisn"]}'
        out = {
            'id': f'h{spec["hisn"]}',
            'hisn': spec['hisn'],
            'hisnUrl': f'https://sunnah.com/hisn:{spec["hisn"]}',
            'tabs': spec['tabs'],
            'group': spec.get('group'),
            'count': spec['count'],
            'when': spec['when'],
            'name': spec.get('name'),
            'recite': self.recite(spec['recite'], where),
        }
        assert spec['when'] in WHEN, where
        if 'recite_evening' in spec:
            out['reciteEvening'] = self.recite(spec['recite_evening'], where)
        if 'recite_evening_note' in spec:
            out['reciteEveningNote'] = self.recite([spec['recite_evening_note']], where)[0]
        if spec['meaning'] == 'quran':
            out['meaning'] = 'quran'
        else:
            out['meaning'] = {lang: self.joined(spec['meaning'][lang], where) for lang in ('en', 'fr')}
        if 'meaning_evening' in spec:
            out['meaningEvening'] = {}
            for lang in ('en', 'fr'):
                parts = [self.text(p, where) for p in spec['meaning_evening'][lang]]
                out['meaningEvening'][lang] = {'text': ' '.join(p['text'] for p in parts), 'src': parts[0]['src']}
        for key in ('evening_note', 'hisn_note', 'count_note', 'confirm', 'practice'):
            if key in spec:
                out[camel(key)] = {lang: self.joined(spec[key][lang], where) for lang in ('en', 'fr')}
        if 'count_source' in spec:
            out['countSource'] = self.text(spec['count_source'], where)
        out['whenAr'] = self.when_ar(spec['when_ar'], where)
        out['about'] = {lang: self.text(spec['about'][lang], where) for lang in ('en', 'fr')}
        out['hadith'] = self.primary(spec['primary'])
        out['refs'] = [self.ref(r, spec.get('grade_override')) for r in spec['refs']]
        if 'surahs' in spec:
            out['surahs'] = spec['surahs']
        if 'virtue' in spec:
            v = spec['virtue']
            out['virtue'] = {lang: self.text(v[lang], where) for lang in ('en', 'fr')}
            out['virtue']['ref'] = self.ref(v['src'])
        if spec.get('muallaq'):
            out['muallaq'] = True
        # every kept hadith must be sahih/hasan by al-Albani or in the Sahihayn
        for r in out['refs']:
            if r['grader'] == 'al-Albani' and not acceptable(r['grade']):
                raise BuildError(f'{where}: {r["label"]} graded {r["grade"]}')
        return out

    def excluded(self, spec):
        out = {'hisn': spec['hisn'], 'hisnUrl': f'https://sunnah.com/hisn:{spec["hisn"]}', 'refs': []}
        for r in spec['refs']:
            h = self.hadith.get(r[1], r[2])
            if acceptable(h['albani'] or ''):
                raise BuildError(f'excluded {spec["hisn"]}: {r} is {h["albani"]}')
            out['refs'].append({'label': f'{BOOK_NAMES[r[1]]} {h["number"]}', 'grade': h['albani'], 'url': hadith_link(h)})
        if 'albani' in spec:
            out['note'] = spec['albani']
        return out


def acceptable(grade):
    g = grade.lower()
    return g.startswith('sahih') or g.startswith('hasan')


def camel(key):
    a, *rest = key.split('_')
    return a + ''.join(w.title() for w in rest)


def src_label(ref):
    if ref[0] == 'h':
        return f'hadith:{ref[1]}:{ref[2]}'
    if ref[0] == 'he':
        return f'he:{ref[1]}'
    if ref[0] == 'hisn':
        return f'hisn:{ref[1]}'
    raise BuildError(f'no label for {ref}')


def ext_label(key):
    return f'ext:{key}'


def main(argv):
    if len(argv) != 5:
        print(__doc__)
        return 2
    hadith = Hadith(argv[1])
    he = HadeethEnc(argv[2])
    hisn = Hisn(argv[3])
    b = Builder(hadith, he, hisn)
    data = {
        'about': 'Built by tools/adhkar/build.py. Texts are copied unchanged from the sources; "src": "mine" marks translations written for this page.',
        'sources': SOURCES,
        'ext': {k: {kk: v for kk, v in e.items() if kk != 'ar'} for k, e in EXT.items()},
        'times': {
            'ar': b.when_ar(TIMES_EVIDENCE['ar'], 'times'),
            'en': b.text(TIMES_EVIDENCE['en'], 'times'),
            'fr': b.text(TIMES_EVIDENCE['fr'], 'times'),
            'ref': b.ref(TIMES_EVIDENCE['src']),
        },
        'items': [b.item(s) for s in ITEMS],
        'excluded': [b.excluded(s) for s in EXCLUDED],
    }
    data['srcs'] = b.src_table(data)
    with open(argv[4], 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(data["items"])} adhkar, {len(data["excluded"])} left out -> {argv[4]}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv))
    except BuildError as e:
        print('BUILD ERROR:', e)
        sys.exit(1)
