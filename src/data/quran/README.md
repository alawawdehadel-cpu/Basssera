# Quran data files in this folder

This folder holds two **separate, independent** datasets. Do not merge
them or use one in place of the other.

## `quran.json` — flat ayah list (6236 rows)

One row per ayah: `textUthmani`, `textSimple`, `textNormalized`, plus
`surahNumber`, `ayahNumber`, `juz`, `page` (the printed-mushaf page the
ayah *starts* on), `hizbQuarter`, `sajda`.

This is enough to:
- display ayahs grouped by surah ("Surah Mode" reader),
- search Quran text,
- know which page an ayah *begins* on.

It is **not** enough to reconstruct a real 604-page Mushaf layout,
because a single `page` number per ayah cannot tell you:
- how many lines are on the page,
- which words/ayahs fall on which of those lines,
- where a line breaks mid-ayah,
- centering/justification per line,
- where a surah-name banner or ﷽ (bismillah) line sits on the page.

Two ayahs sharing `page: 42` gives no information about their relative
line position — that line-by-line layout is a fixed, published fact
about the standard Madani Mushaf typesetting, not something that can be
derived or approximated from ayah boundaries alone.

## `mushaf-pages.json` — page/line layout (604 pages)

Shape consumed by `src/utils/mushafLayout.ts`:

```json
[
  {
    "pageNumber": 1,
    "juz": 1,
    "surahs": ["الفاتحة"],
    "lines": [
      {
        "lineNumber": 1,
        "text": "بِسْمِ اللَّهِ الرَّحْمَ�ٰنِ الرَّحِيمِ",
        "words": [
          { "textUthmani": "بِسْمِ", "surahNumber": 1, "ayahNumber": 1, "wordNumber": 1 },
          { "textUthmani": "اللَّهِ", "surahNumber": 1, "ayahNumber": 1, "wordNumber": 2 }
        ]
      }
    ]
  }
]
```

**This file currently ships empty (`[]`).** The Mushaf-mode reader
(`app/quran/mushaf/[pageNumber].tsx`) detects that and shows:

> "بيانات تخطيط صفحات المصحف غير مضافة بعد."

instead of guessing a layout. This is intentional — per the app's core
rule, Quran text is never generated, invented, or approximated. Manually
splitting `quran.json` into 15-line pages would silently produce a
layout that does not match the real printed Mushaf, which is worse than
showing nothing.

### How to fill this file in correctly

Use `scripts/fetchMushafLayout.js`. It is a ready-to-run fetch/transform
script, not a guesser:

```bash
node scripts/fetchMushafLayout.js
# or
npm run build:mushaf
```

By default it calls the public Quran.com Content API v4
(`https://api.quran.com/api/v4`), which returns real per-word
`line_number`/`page_number` fields taken directly from the Madani
Mushaf typesetting — no key required. To use a different licensed
page-layout provider (e.g. the Quran Foundation Page Layout API),
override the endpoint:

```bash
MUSHAF_LAYOUT_API_BASE=https://your-provider/api \
MUSHAF_LAYOUT_API_KEY=your-key \
node scripts/fetchMushafLayout.js
```

The script performs **no OCR**, **no manual line-splitting**, and
**no invented line breaks** — it is a pure pass-through mapper from the
source API's response shape into the shape above. If you point it at a
different provider, update only the `mapApiPageToMushafPage()`
function's request/response mapping; leave the "no invented data" rule
in the header comment intact.

If the API is unreachable or not configured, the script prints setup
instructions and **exits without writing anything** — it never falls
back to fabricating a layout from `quran.json`.

After running it, `getMushafValidation()` in `mushafLayout.ts` will
report `status: 'ready'` once all 604 pages are present (or `'partial'`
if only some are, in which case missing pages still show the
not-added-yet message individually, page by page).
