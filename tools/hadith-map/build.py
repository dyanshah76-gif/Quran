"""Build data/hadith/<surah>.json: for each ayah, the authentic hadith that quote or name it.

Inputs (pinned, read from a local folder given as the first argument):
  fawazahmed0/hadith-api @ df57907be35291c91ad6a6691180e22ca9920784
    editions/ara-<book>.json  Arabic text (Quran quotes are marked with { } in most books)
    editions/eng-<book>.json  grades (al-Albani's, taken by hadith-api from al-maktaba.org)
  fawazahmed0/quran-api @ 93e6f649
    editions/ara-quransimple.json  plain-spelling Quran text, used only for matching
Output: one file per surah in the folder given as the second argument.

Which hadith are kept:
  Sahih al-Bukhari and Sahih Muslim: every numbered narration. Left out: Muslim's introduction
  (book 0) and the extra unnumbered narrations that the dataset numbers like 774.2.
  Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah: only when al-Albani's grade is exactly one of OK_ALBANI.
  Grades that only judge the chain ("... Isnaad"), statements of Companions or Successors
  ("... Muquf", "... Maqtu"), "Sahih Hadith", "Sahih Matn" and every weak grade are left out.

When a hadith is linked to an ayah:
  1. A passage between { } that matches, word for word, a passage found in exactly one ayah
     (or in one ayah of a surah that the same hadith quotes elsewhere).
  2. Without { }: a run of at least 5 words found in exactly one ayah, and
     - introduced or followed by a quoting word (nazala, anzala, qara'a, tala, iqra'u, al-ayah), or
     - at least 8 words long or introduced by qawl/qawlihi/ta'ala, AND the same words are not a
       formula: words that recur in hadith but are never marked as a quote with { } anywhere
       in the six books (e.g. "lahu al-mulk wa lahu al-hamd ..." of the dhikr), or
     - directly continuing a quote already accepted.
  3. The hadith names the ayah: "ayat al-kursi" -> 2:255; "the two ayat at the end of
     Surat al-Baqarah" / "khawatim Surat al-Baqarah" -> 2:285-286.
  4. MANUAL below, each with its reason.
Matching ignores only vowel marks and letter-shape variants; no word of any text is changed.
"""
import json, re, sys, os
from collections import defaultdict

SRC = sys.argv[1]
OUT = sys.argv[2]
BOOKS = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah']
OK_ALBANI = {'Sahih', 'Hasan', 'Hasan Sahih', 'Sahih Mutawatir', 'Sahih Lighairihi'}
BASM = 'بسم الله الرحمن الرحيم'
MIN_GRAM = 5
LONG = 8
STRONG = re.compile(r'^[وف]?(?:نزلت|انزل|نزل|قرا|يقرا|فقرا|تلا|يتلو|اقروا|اقرووا)$|^(?:الايه|الايات)$')
WEAK = re.compile(r'^[وفبل]?(?:قوله|قول)$|^تعالي$')
NAMED = {
    'ايه الكرسي': [(2, 255)],
    'الايتين من اخر سوره البقره': [(2, 285), (2, 286)],
    'الايتان من اخر سوره البقره': [(2, 285), (2, 286)],
    'خواتيم سوره البقره': [(2, 285), (2, 286)],
}
# (book, dataset number): (ayat, reason)
MANUAL = {
    ('muslim', 1885): ([(2, 255)], 'Muslim 810: Ubayy names the greatest ayah by its opening words, '
                       'which also begin 3:2; Muslim\'s chapter is "The virtue of Surat al-Kahf and Ayat al-Kursi" '
                       '(sunnah.com/muslim/6/313).'),
}


def norm(t):
    t = re.sub(r'[ً-ٰٟۖ-ۭـ‌-‏‪-‮]', '', t)
    t = re.sub('[أإآٱ]', 'ا', t).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي').replace('ء', '')
    t = re.sub(r'[^ء-ي ]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


quran = json.load(open(os.path.join(SRC, 'ara-quransimple.json')))['quran']
assert len(quran) == 6236
AYAT = []
for v in quran:
    t = norm(v['text'])
    if v['verse'] == 1 and v['chapter'] not in (1, 9) and t.startswith(BASM + ' '):
        t = t[len(BASM) + 1:]
    AYAT.append(((v['chapter'], v['verse']), t))
GRAM = defaultdict(set)
for k, t in AYAT:
    w = t.split()
    for i in range(len(w) - MIN_GRAM + 1):
        GRAM[tuple(w[i:i + MIN_GRAM])].add(k)

# every hadith text of the six books (all grades), to tell quotes from formulas
ALL_TEXT, ALL_BRACED = [], []
for book in BOOKS:
    for h in json.load(open(os.path.join(SRC, f'ara-{book}.json')))['hadiths']:
        ALL_TEXT.append(' ' + norm(h['text']) + ' ')
        ALL_BRACED.append(' | '.join(' ' + norm(m) + ' ' for m in re.findall(r'\{([^{}]+)\}', h['text'])))
GRAM_HADITH = defaultdict(set)
for i, t in enumerate(ALL_TEXT):
    w = t.split()
    for j in range(len(w) - MIN_GRAM + 1):
        g = tuple(w[j:j + MIN_GRAM])
        if g in GRAM:
            GRAM_HADITH[g].add(i)
_formula_cache = {}


def is_formula(words):
    """True when these words recur in hadith (more than 3 times) but are never marked as a
    Quran quote with { } anywhere in the six books: a formula such as a dhikr, not a quote."""
    key = ' '.join(words)
    if key in _formula_cache:
        return _formula_cache[key]
    ids = GRAM_HADITH.get(tuple(words[:MIN_GRAM]), set())
    pad = ' ' + key + ' '
    in_text = sum(1 for i in ids if pad in ALL_TEXT[i])
    in_braces = sum(1 for i in ids if pad in ALL_BRACED[i])
    res = in_braces == 0 and in_text - in_braces > 3
    _formula_cache[key] = res
    return res


def ayat_containing(q):
    pad = ' ' + q + ' '
    return [k for k, t in AYAT if pad in ' ' + t + ' ']


def brace_links(text):
    quotes = [norm(m) for m in re.findall(r'\{([^{}]+)\}', text)]
    cands = [ayat_containing(q) for q in quotes if len(q.split()) >= 2]
    found = {c[0] for c in cands if len(c) == 1}
    surahs = {k[0] for k in found}
    for c in cands:
        if len(c) > 1:
            same = [k for k in c if k[0] in surahs]
            if len(same) == 1:
                found.add(same[0])
    return found


def text_links(text):
    w = norm(text).split()
    runs = []  # [ayah, start, end_exclusive]: consecutive unique 5-grams of one ayah
    for i in range(len(w) - MIN_GRAM + 1):
        s = GRAM.get(tuple(w[i:i + MIN_GRAM]))
        if not s or len(s) != 1:
            continue
        k = next(iter(s))
        if runs and runs[-1][0] == k and runs[-1][2] >= i + MIN_GRAM - 1:
            runs[-1][2] = i + MIN_GRAM
        else:
            runs.append([k, i, i + MIN_GRAM])
    ok = [False] * len(runs)
    for j, (k, a, b) in enumerate(runs):
        before, after = w[max(0, a - 6):a], w[b:b + 3]
        if any(STRONG.match(x) for x in before) or any(x in ('الايه', 'الايات') for x in after):
            ok[j] = True
        elif (b - a >= LONG or any(WEAK.match(x) for x in before)) and not is_formula(w[a:b]):
            ok[j] = True
    changed = True
    while changed:  # a quote that runs on directly from an accepted one
        changed = False
        for j in range(len(runs)):
            if ok[j]:
                continue
            for jj in (j - 1, j + 1):
                if 0 <= jj < len(runs) and ok[jj]:
                    gap = runs[j][1] - runs[jj][2] if jj < j else runs[jj][1] - runs[j][2]
                    if gap <= 2:
                        ok[j] = changed = True
                        break
    return {runs[j][0] for j in range(len(runs)) if ok[j]}


def named_links(text):
    t = ' ' + norm(text) + ' '
    out = set()
    for phrase, ayat in NAMED.items():
        if ' ' + phrase + ' ' in t:
            out.update(ayat)
    return out


def muslim_label(arabicnumber):
    x = str(arabicnumber)
    if '.' in x:
        whole, frac = x.split('.')
        frac = int(frac)
        return whole if frac == 0 else whole + chr(ord('a') + frac - 1)
    return x


per_ayah = defaultdict(list)
stats = {}
for book in BOOKS:
    ar = json.load(open(os.path.join(SRC, f'ara-{book}.json')))['hadiths']
    en = {h['hadithnumber']: h for h in json.load(open(os.path.join(SRC, f'eng-{book}.json')))['hadiths']}
    kept = linked = 0
    for h in ar:
        n = h['hadithnumber']
        ref = h['reference']
        if not float(n).is_integer():
            continue
        n = int(n)
        if book == 'muslim' and ref['book'] == 0:
            continue
        grade = None
        if book not in ('bukhari', 'muslim'):
            g = [x['grade'].strip() for x in en.get(n, {}).get('grades', []) if x['name'] == 'Al-Albani']
            if len(g) != 1 or g[0] not in OK_ALBANI:
                continue
            grade = g[0]
        kept += 1
        links = brace_links(h['text']) | text_links(h['text']) | named_links(h['text'])
        if (book, n) in MANUAL:
            links |= set(MANUAL[(book, n)][0])
        if not links:
            continue
        linked += 1
        label = muslim_label(h['arabicnumber']) if book == 'muslim' else str(n)
        rec = {'b': book, 'n': n, 'no': label, 'ref': f"{ref['book']}/{ref['hadith']}"}
        if grade:
            rec['g'] = grade
        for k in links:
            per_ayah[k].append(rec)
    stats[book] = {'authentic kept': kept, 'linked to an ayah': linked}

order = {b: i for i, b in enumerate(BOOKS)}
os.makedirs(OUT, exist_ok=True)
total = 0
for s in range(1, 115):
    ayat = {}
    for (ss, a), recs in sorted(per_ayah.items()):
        if ss != s:
            continue
        recs = sorted({(r['b'], r['n']): r for r in recs}.values(), key=lambda r: (order[r['b']], r['n']))
        ayat[str(a)] = recs
        total += len(recs)
    with open(os.path.join(OUT, f'{s}.json'), 'w', encoding='utf-8') as f:
        json.dump({'surah': s, 'ayat': ayat}, f, ensure_ascii=False, separators=(',', ':'))
print(json.dumps(stats, indent=1))
print('ayat with at least one hadith:', len(per_ayah), ' links:', total)
