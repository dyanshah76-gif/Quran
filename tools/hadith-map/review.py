#!/usr/bin/env python3
"""Second pass over data/hadith: read al-Albani's own words for every Sunan hadith.

tools/hadith-map/build.py takes al-Albani's grades from fawazahmed0/hadith-api,
which keeps one word ("Sahih", "Hasan") and drops whatever al-Albani adds after
it. This pass reads his full rulings (fawazahmed0/hadith @ e4e7f39,
"Scripts/uncleaned grades", copied from al-maktaba.org books 1755, 782, 783,
810) and:

  - removes a hadith when his reservation touches its link with the ayah;
  - copies his Arabic ruling into the entry ("q") when he accepts the hadith
    except some words, so the reader sees the reservation;
  - stops if a ruling carries a reservation that is not listed below.

Usage: python3 tools/hadith-map/review.py ALBANI_DIR data/hadith
"""
import glob, json, os, re, sys

FILES = {'abudawud': '1755gradings.txt', 'tirmidhi': '782gradings.txt', 'nasai': '783gradings.txt', 'ibnmajah': '810gradings.txt'}
START = re.compile(r'^\[?(\d+)\]? \| ?(.*)$')

# Read one by one on 9 November 2026.
REMOVE = {
    ('nasai', 3216),  # «صحيح، إن كان الحسن سمعه من سعد، موقوف»: conditional, and a Companion's words
    ('nasai', 5643),  # «صحيح … دون تلاوة الآية، وكأنها مدرجة»: the ayah itself is not established in it
}
ANNOTATE = {
    ('abudawud', 507), ('abudawud', 1260), ('abudawud', 2214), ('abudawud', 2599), ('abudawud', 2891), ('abudawud', 3984),
    ('abudawud', 4338), ('ibnmajah', 1627), ('nasai', 932), ('nasai', 1172), ('nasai', 4007), ('nasai', 4991), ('tirmidhi', 3116),
}
# Words that signal a reservation. "صحيح بما قبله / بما بعده" (sound through the
# narration before or after it) is not one.
WORDS = ['دون', 'لكن', 'سوى', 'ضعيف', 'منكر', 'شاذ', 'موضوع', 'مدرج', 'موقوف', 'مقطوع', 'مرسل', 'زيادة', 'خطأ', 'غلط', 'باطل',
         'مضطرب', 'وهم', 'أصح', 'ملاحظة', 'المحفوظ', 'باللفظ', 'بلفظ', 'إن كان']
# Rulings that contain one of these words without it being a reservation on
# the hadith shown (the word is part of a book title or of a cross-reference).
FINE = {('ibnmajah', 1849)}  # «(زيادة زيد بن أخزم) صحيح بما قبله»: he grades the addition sahih


def load(folder):
    out = {}
    for book, name in FILES.items():
        table, cur = {}, None
        for line in open(os.path.join(folder, name), encoding='utf-8'):
            line = line.rstrip('\n')
            m = START.match(line)
            if m:
                cur = int(m.group(1))
                text = m.group(2).replace('تحقيق الألباني:', '').strip()
                table.setdefault(cur, [])
                if text not in table[cur]:
                    table[cur].append(text)
            elif cur is not None and line.strip():
                table[cur][-1] += ' ' + line.strip()
        out[book] = table
    return out


def main(albani_dir, data_dir):
    rulings = load(albani_dir)
    seen, removed, annotated, unknown = set(), set(), set(), []
    for path in sorted(glob.glob(os.path.join(data_dir, '*.json'))):
        data = json.load(open(path, encoding='utf-8'))
        for ayah, entries in list(data['ayat'].items()):
            keep = []
            for e in entries:
                key = (e['b'], e['n'])
                if e['b'] not in FILES:
                    keep.append(e)
                    continue
                seen.add(key)
                if key in REMOVE:
                    removed.add(key)
                    continue
                found = rulings[e['b']].get(e['n'])
                if not found:
                    raise SystemExit(f'{key}: no ruling by al-Albani found')
                text = ' // '.join(found)
                body = re.sub(r'صحيح بما (قبله|بعده)', '', text)
                flagged = [w for w in WORDS if w in body]
                if key in ANNOTATE:
                    e['q'] = text
                    annotated.add(key)
                elif flagged and key not in FINE:
                    unknown.append((key, flagged, text))
                keep.append(e)
            if keep:
                data['ayat'][ayah] = keep
            else:
                del data['ayat'][ayah]
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(seen)} Sunan hadith read; removed {len(removed)}, annotated {len(annotated)}')
    missing = (REMOVE - removed) | (ANNOTATE - annotated)
    if missing:
        print('listed but not in the data:', sorted(missing))
    if unknown:
        for key, flagged, text in unknown:
            print('UNREVIEWED', key, flagged, text)
        raise SystemExit(1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
