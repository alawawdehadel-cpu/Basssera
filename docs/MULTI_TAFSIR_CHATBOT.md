# Multi-Source Tafsir Assistant

How the بصيرة assistant answers from **three** local tafsir sources — تفسير
السعدي، تفسير ابن كثير، تفسير الطبري — with no generative AI and no backend.
Every answer is a verbatim excerpt of bundled data or an honest "not found".

---

## 1. Existing architecture (unchanged core)

The live assistant is `app/(tabs)/assistant.tsx` → `useAssistant` →
`sanitizeInput` → `searchAnswer` → `buildChatAnswer` → rendered cards. The
retrieval brain is `src/utils/chatbotSearch.ts`. Intent classification
(`intentDetector.ts`) still runs first and still decides FATWA / HADITH /
SURAH_INFO / QURAN_STATS / WORD_LOCATION / WORD_MEANING / TOPIC_AYAHS /
AYAH_SEARCH / TAFSIR_EXPLANATION / GENERAL_TAFSIR_SEARCH / UNKNOWN. None of
those handlers changed — the multi-source layer is **added in front of** the
old single-source tafsir path, gated so it only fires for concrete
tafsir-passage questions.

> The `src/components/chat/*` components and `useChat` are legacy and not wired
> into the app; the changes here target the live assistant surface.

## 2. New multi-source architecture

```
sanitizeInput
  → detectIntent                     (unchanged; routes fatwa/hadith/structured)
  → searchAnswer(query, groups, lang, options)
        ├─ handleMultiSourceTafsir    ← NEW, runs before single-source routing
        │     analyzeTafsirQuestion   (tafsir/tafsirQuestionAnalyzer.ts)
        │       detectRequestedSources / detectComparison  (tafsirSourceDetector.ts)
        │       resolve reference via verified mushaf       (tafsir/quranReference.ts)
        │     retrieveTafsirMatches   (tafsir/tafsirSearch.ts, per-source index)
        │  → SearchResult { tafsirMatches[], comparison, resolvedContext }
        └─ (else) existing pipeline unchanged
  → buildChatAnswer                   (one labeled card per source)
  → assistant.tsx                     (SourceSelector + TafsirSourceCard)
```

## 3. Dataset file locations

| Source | id | File | Size | Records |
|---|---|---|---|---|
| تفسير السعدي | `al_saadi` | `src/data/tafseer_saadi.json` | ~10.1 MB | 6236 |
| تفسير ابن كثير | `ibn_kathir` | `src/data/tafseer_ibn_kathir.json` | ~90.0 MB | 6236 |
| تفسير الطبري | `al_tabari` | `src/data/tafseer_tabari.json` | ~62.8 MB | 6236 |

Total ≈ **162.8 MB** of bundled JSON (see Performance).

## 4. Detected JSON structure

All three sources currently ship in the **same canonical shape** (confirmed by
`npm run inspect:tafsir`):

```jsonc
{
  "surah": 1, "surah_name": "الفاتحة", "surah_transliteration": "Al-Fatihah",
  "surah_type": "meccan", "ayah_start": 1, "ayah_end": 1,
  "ayahs": [{ "number": 1, "text": "..." }],
  "ayah_text": "...", "explanation": "<verbatim tafsir>"
}
```

## 5. Adapters (`src/utils/tafsirAdapters.ts`)

`adaptSaadiData` / `adaptIbnKathirData` / `adaptTabariData` all delegate to one
tolerant normalizer that probes alternative field names
(`surah_number`/`surahNumber`, `ayah`/`verse`/`verse_number`,
`tafsir`/`content`/`text`, …) so a future third-party file in a different shape
still maps into the canonical `TafseerGroup` **without rewriting any text**.
Each adapter validates (surah 1–114, `ayah_start > 0`, `ayah_end ≥ ayah_start`,
non-empty explanation), drops malformed records (counted), de-duplicates by
`surah:start-end`, and reports `AdaptStats`. Dev builds log invalid/duplicate
counts.

## 6. Source selection

Precedence, resolved in `chatbotSearch.resolveSources`:

1. **Sources named in the question** override everything for that message
   (`"ماذا قال ابن كثير…"` → `ibn_kathir` only).
2. Otherwise the **UI selection** (`SourceSelector`: الجميع / السعدي / ابن كثير
   / الطبري, default الجميع).
3. Otherwise **all three**.

Detection lives in `tafsir/tafsirSourceDetector.ts` (aliases incl. تيسير الكريم
الرحمن، جامع البيان، and "all" phrases like التفاسير الثلاثة). It tolerates the
glued «و» in «الطبري والسعدي».

## 7. Intent analysis (`tafsir/tafsirQuestionAnalyzer.ts`)

Produces a `TafsirQuestionAnalysis` with intent ∈ `exact_ayah` | `ayah_range` |
`named_ayah` | `quran_phrase` | `surah_tafsir` | `topic_search` |
`compare_tafsir` | `follow_up` | `unsupported`, plus resolved surah/ayah,
requested sources, comparison/summary/simplification flags, confidence, and a
`needsClarification` reason. It **never invents** a surah/ayah — unresolved
references return a clarification.

## 8. Exact-ayah / range retrieval

`tafsir/tafsirSearch.ts` builds and caches one **surah → groups** index per
source. For a range it returns every overlapping group; results are sorted by
source (request order) → surah → ayah. A requested source with no overlapping
passage yields a `notFound` marker — never another source's text.

Supported reference forms: `الآية 255`, `البقرة 255`, `2:255`, `من 1 إلى 5`,
`الآيتان 1 و2`, `أول خمس آيات`, `آخر آيتين`, ordinals (`الآية الأولى`), and named
ayahs (`آية الكرسي`، `آية النور`، `آية الدين`، `خواتيم سورة البقرة`) via
`namedAyahs.ts`.

## 9. Comparison without generative AI

`قارن / الفرق بين / التفاسير الثلاثة` sets `comparison`. The engine returns each
selected source's **attributed, verbatim** passage side by side. It **never**
asserts agreement or difference — the header explicitly says the texts are
attributed "دون إصدار حكم بالاتفاق أو الاختلاف". The reader draws the
conclusion.

## 10. Quran-phrase resolution

`"قوله تعالى إن مع العسر يسرا"` is resolved against the **verified mushaf**
(`quran.json`, via `tafsir/quranReference.ts`), never guessed from tafsir text.
One match → that ayah; several matches → a clarification listing candidates.

## 11. Follow-up context

`useAssistant` keeps a reference-only `TafsirConversationContext`
(surah/ayah/sources/comparison — **no tafsir text**). `"وماذا قال الطبري؟"`
keeps the previous ayah and switches source; `"اختصرها"` keeps everything and
returns a labeled «مقتطف مختصر» (deterministic extract, full text one tap away).
A non-tafsir answer clears the context so it never leaks into an unrelated
question.

## 12. Data validation & inspection

```bash
npm run inspect:tafsir    # shape + field mapping + sizes
npm run validate:tafsir   # totals, valid/invalid, duplicates, surah coverage
npm run test:tafsir       # 31 deterministic engine assertions (real TS code)
npm run typecheck         # tsc --noEmit
```

Latest run: **6236 valid / 0 invalid / 0 duplicate / 114 surahs** for each of
the three sources; **31/31** engine tests pass; typecheck clean.

## 13. Performance

- Sources are **lazily parsed**: `dataLoader.ts` uses per-source `require()`
  loaders, so selecting a single source never parses the other two (~90 MB +
  ~63 MB stay untouched). Each source is adapted+indexed **once** and cached;
  React state never holds tafsir records.
- Bundle size is the real constraint: ~163 MB of JSON is large for a single JS
  bundle. If a target device struggles, run `npm run build:tafsir-chunks` to
  emit `src/data/tafsir-chunks/<sourceId>/<surah>.json` (+ manifest) and switch
  the loader to require only the needed `(source, surah)` chunk. This keeps the
  app fully offline and Expo-Go compatible; no SQLite and no backend are
  introduced.

## 14. Adding a fourth tafsir later

1. Drop `src/data/tafseer_<x>.json` in.
2. Add its id to `TafsirSourceId` and a row to `TAFSIR_SOURCES`
   (`utils/tafsirSources.ts`).
3. Add a `require` loader row in `dataLoader.ts` and an `adapt<X>Data` (or reuse
   `adaptBySource`).
4. Add aliases in `tafsirSourceDetector.ts` and the file to the validation
   scripts. The UI selector, search, comparison, and follow-up pick it up
   automatically.

## 15. Known limitations

- Comparison is **attributive only** by design (no synthesized verdict).
- Named-ayah and phrase resolution cover common cases; obscure nicknames fall
  back to clarification rather than a guess.
- The full datasets are bundled; very memory-constrained devices may need the
  chunking path (§13).
- English replies reuse Arabic source data; tafsir text itself is Arabic.
