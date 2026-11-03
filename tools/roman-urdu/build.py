"""Unofficial Roman Urdu transcription of Muhammad Junagarhi's Urdu translation.

The Urdu text (Tanzil, via fawazahmed0/quran-api) is the only authority: every
output verse is that verse's Urdu, word by word, written in Latin letters.
Spellings come from quranraj.com's Roman Urdu edition of the same translation,
learned word by word only where a Roman word clearly matches the Urdu word
(consonant skeletons compared). Words never matched get a spelling from
manual.json (written by hand) or, failing that, a letter-by-letter rule.

Usage: python3 -I build2.py <quran-api checkout> <out dir> [manual.json]
"""
import collections
import difflib
import json
import os
import random
import re
import sys
import unicodedata

SRC, OUT = sys.argv[1], sys.argv[2]
MANUAL = {}
if len(sys.argv) > 3 and os.path.exists(sys.argv[3]):
    with open(sys.argv[3], encoding='utf-8') as f:
        MANUAL = json.load(f)

def load(name):
    with open(os.path.join(SRC, 'editions', f'{name}.min.json'), encoding='utf-8') as f:
        data = json.load(f)
    rows = data['quran'] if 'quran' in data else data
    return {(r['chapter'], r['verse']): r['text'] for r in rows}

URDU = load('urd-muhammadjunagar')
ROMAN = load('urd-muhammadjunagar-la')

PUNCT = {'،': ',', '۔': '.', '؟': '?', '!': '!', ':': ':', '(': '(', ')': ')', '﴾': '(', '﴿': ')',
         '“': '"', '”': '"', '"': '"', '؛': ';', ',': ',', '.': '.'}
MARKS = re.compile('[ً-ٰٟٴ]')

def norm(word):
    w = unicodedata.normalize('NFKC', word)
    w = MARKS.sub('', w)
    return (w.replace('ي', 'ی').replace('ى', 'ی').replace('ك', 'ک').replace('ه', 'ہ')
             .replace('ة', 'ۃ').replace('‌', '').replace('‍', ''))

def tokens_ur(text):
    """-> list of [lead, word, trail]"""
    out = []
    for raw in text.split():
        for i, part in enumerate(re.split(r'([،۔؟!؛﴾﴿()])', raw)):
            if not part:
                continue
            if part in PUNCT and part not in '﴾(' and out:
                out[-1][2] += PUNCT[part]
                continue
            lead = trail = ''
            while part and part[0] in PUNCT:
                lead += PUNCT[part[0]]; part = part[1:]
            while part and part[-1] in PUNCT:
                trail = PUNCT[part[-1]] + trail; part = part[:-1]
            if part:
                out.append([lead, part, trail])
            elif lead and not trail:
                out.append([lead, '', ''])  # opening bracket waiting for its word
            elif out:
                out[-1][2] += lead + trail
    # opening brackets that were split off attach to the next word
    merged = []
    for tok in out:
        if merged and merged[-1][1] == '' and merged[-1][0]:
            tok = [merged[-1][0] + tok[0], tok[1], tok[2]]
            merged[-1] = tok
        else:
            merged.append(tok)
    out = merged
    # stray letters left by typing slips in the source ("غنیمتو ں", "ا نہیں")
    fixed = []
    for i, tok in enumerate(out):
        if norm(tok[1]) == 'ں' and fixed:
            fixed[-1][1] += tok[1]; fixed[-1][2] += tok[2]
            continue
        fixed.append(tok)
    out = []
    i = 0
    while i < len(fixed):
        tok = fixed[i]
        if norm(tok[1]) == 'ا' and i + 1 < len(fixed) and not tok[2]:
            nxt = fixed[i + 1]
            out.append([tok[0] + nxt[0], tok[1] + nxt[1], nxt[2]])
            i += 2
            continue
        out.append(tok)
        i += 1
    return out

def tokens_ro(text):
    words = []
    for raw in re.split(r'[\s]+', text.replace('.', ' . ').strip()):
        core = raw.strip('()[]{}.,;:!?"\'“”‘’–—')
        if core:
            words.append(core)
    return words

UR_SK = {'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ط': 't', 'ث': 's', 'س': 's', 'ص': 's', 'ج': 'j',
         'چ': 'c', 'ح': 'h', 'ہ': 'h', 'ھ': 'h', 'ۃ': 'h', 'خ': 'x', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
         'ز': 'z', 'ض': 'z', 'ظ': 'z', 'ژ': 'z', 'ر': 'r', 'ڑ': 'r', 'ش': 'S', 'غ': 'G', 'ف': 'f',
         'ق': 'k', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n'}

def sk_ur(word):
    w = norm(word).replace('کھ', 'خ').replace('گھ', 'غ').replace('چھ', 'چ')
    s = ''.join(UR_SK.get(ch, '') for ch in w)
    return re.sub(r'(.)\1+', r'\1', s)

def sk_ro(word):
    w = word.lower()
    w = w.replace('sh', 'S').replace('ch', 'c').replace('kh', 'x').replace('gh', 'G').replace('q', 'k')
    w = re.sub(r'[^bcdfghjklmnprstzSxG]', '', w)
    return re.sub(r'(.)\1+', r'\1', w)

def sim(a, b):
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()

def align(ur_words, ro_words):
    """Needleman-Wunsch over word skeletons; returns matched (ur, ro) pairs."""
    n, m = len(ur_words), len(ro_words)
    su = [sk_ur(w) for w in ur_words]
    sr = [sk_ro(w) for w in ro_words]
    gap = -0.4
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        score[i][0] = i * gap; back[i][0] = 'u'
    for j in range(1, m + 1):
        score[0][j] = j * gap; back[0][j] = 'r'
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim(su[i - 1], sr[j - 1])
            best, move = score[i - 1][j - 1] + (s * 2 - 1), 'm'
            if score[i - 1][j] + gap > best:
                best, move = score[i - 1][j] + gap, 'u'
            if score[i][j - 1] + gap > best:
                best, move = score[i][j - 1] + gap, 'r'
            score[i][j], back[i][j] = best, move
    pairs = []
    i, j = n, m
    while i > 0 or j > 0:
        move = back[i][j]
        if move == 'm':
            s = sim(su[i - 1], sr[j - 1])
            if s >= 0.67 and len(su[i - 1]) > 0:
                pairs.append((ur_words[i - 1], ro_words[j - 1]))
            elif len(su[i - 1]) == 0 and len(sk_ro(ro_words[j - 1])) == 0:
                pairs.append((ur_words[i - 1], ro_words[j - 1]))  # vowel-only words like "او"
            i, j = i - 1, j - 1
        elif move == 'u':
            i -= 1
        else:
            j -= 1
    return pairs

def learn(keys):
    table = collections.defaultdict(collections.Counter)
    for k in keys:
        ur = [w for _, w, _ in tokens_ur(URDU[k])]
        ro = tokens_ro(ROMAN.get(k, ''))
        if not ur or not ro:
            continue
        for u, r in align(ur, ro):
            table[norm(u)][r.lower()] += 1
    return table

LETTERS = {'ا': 'a', 'آ': 'aa', 'أ': 'a', 'إ': 'i', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
           'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r',
           'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': '',
           'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n',
           'و': 'o', 'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'ay', 'ۃ': 'h', 'ؤ': 'o', 'ئ': 'i'}

def fallback(word):
    return ''.join(LETTERS.get(ch, '') for ch in norm(word))

def known(table, key):
    return key in MANUAL or key in table

def best(table, key):
    cands = table[key].most_common()
    target = sk_ur(key)
    exact = [r for r, _ in cands if sk_ro(r) == target]
    return exact[0] if exact else cands[0][0]

def lookup(table, key):
    return MANUAL[key] if key in MANUAL else best(table, key)

FREQ = collections.Counter()

def spell(table, word, stats):
    key = norm(word)
    if key in MANUAL:
        stats['manual'] += 1
        return MANUAL[key]
    # "و" written onto the next word ("وزمین" = "و زمین"): split when the rest is
    # a more common word than the joined form
    rest = key[1:]
    if key.startswith('و') and len(rest) > 1 and known(table, rest) and FREQ[rest] > FREQ[key]:
        stats['split'] += 1
        return 'o ' + lookup(table, rest)
    if key in table:
        stats['learned'] += 1
        return best(table, key)
    if key.isdigit():
        return key
    # words written together in the source: "وآسمان", "اوراس", "ہےاور"
    if key.startswith('و') and len(key) > 2 and known(table, key[1:]):
        stats['split'] += 1
        return 'o ' + lookup(table, key[1:])
    for cut in range(len(key) - 1, 0, -1):
        left, right = key[:cut], key[cut:]
        if known(table, left) and known(table, right):
            stats['split'] += 1
            return lookup(table, left) + ' ' + lookup(table, right)
    stats['fallback'] += 1
    stats['unknown'][key] += 1
    return fallback(word)

def romanize(table, text, stats):
    toks = tokens_ur(text)
    # words broken by a stray space in the source ("پڑ تے", "نو ح", "کرد یئے")
    merged = []
    for tok in toks:
        if merged and not merged[-1][2] and not tok[0] and not known(table, norm(tok[1])):
            joined = norm(merged[-1][1] + tok[1])
            if known(table, joined):
                merged[-1] = [merged[-1][0], merged[-1][1] + tok[1], tok[2]]
                continue
        merged.append(tok)
    parts = []
    for i, (lead, word, trail) in enumerate(merged):
        nxt = norm(merged[i + 1][1]) if i + 1 < len(merged) else ''
        if norm(word) == 'تو' and nxt == 'نے' and not trail:
            spelled = 'tu'  # "تو نے" = "you did"
        else:
            spelled = spell(table, word, stats)
        parts.append(f'{lead}{spelled}{trail}')
    out = ' '.join(p for p in parts if p.strip())
    out = re.sub(r'\s{2,}', ' ', out)
    out = re.sub(r'\s+([,.;:!?)])', r'\1', out)
    out = re.sub(r'\(\s+', '(', out)
    out = re.sub(r'\ballah\b', 'Allah', out)
    out = re.sub(r'([.?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), out)
    return out[:1].upper() + out[1:]

def new_stats():
    return {'learned': 0, 'manual': 0, 'split': 0, 'fallback': 0, 'unknown': collections.Counter()}

# The letters of 13:1 are typed apart in the source ("ا ل م رٰ").
SPECIAL = {(13, 1): ('ا ل م رٰ', 'المر')}

keys = sorted(URDU)
for _k in keys:
    for _, _w, _ in tokens_ur(URDU[_k]):
        FREQ[norm(_w)] += 1

# held-out check: learn from 90 %, compare with quranraj on the other 10 %
random.seed(11)
pool = keys[:]
random.shuffle(pool)
held, train = pool[: len(pool) // 10], pool[len(pool) // 10:]
table = learn(train)
agree = total = 0
for k in held:
    for u, r in align([w for _, w, _ in tokens_ur(URDU[k])], tokens_ro(ROMAN.get(k, ''))):
        total += 1
        agree += spell(table, u, new_stats()).lower() == r.lower()
print(f'held-out: {agree}/{total} matched words spelled as quranraj = {agree / max(total, 1):.1%}')

table = learn(keys)
stats = new_stats()
os.makedirs(OUT, exist_ok=True)
by_surah = collections.defaultdict(list)
for k in keys:
    text = URDU[k]
    if k in SPECIAL:
        text = text.replace(*SPECIAL[k], 1)
    by_surah[k[0]].append((k[1], romanize(table, text, stats)))
count = 0
for s, rows in sorted(by_surah.items()):
    rows.sort()
    assert [a for a, _ in rows] == list(range(1, len(rows) + 1))
    count += len(rows)
    with open(os.path.join(OUT, f'{s}.json'), 'w', encoding='utf-8') as f:
        json.dump({'surah': s, 'verses': [t for _, t in rows]}, f, ensure_ascii=False, separators=(',', ':'))
words = stats['learned'] + stats['manual'] + stats['fallback']
words += stats['split']
print(f'surahs {len(by_surah)}, verses {count}; words: learned {stats["learned"]}, manual {stats["manual"]}, '
      f'split {stats["split"]}, fallback {stats["fallback"]} ({stats["fallback"] / words:.2%}); '
      f'unique unknown words: {len(stats["unknown"])}')
with open(os.path.join(os.path.dirname(OUT), 'unknown.json'), 'w', encoding='utf-8') as f:
    json.dump(stats['unknown'].most_common(), f, ensure_ascii=False, indent=0)
