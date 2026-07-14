# تفسير السعدي — Tafseer Chatbot

A clean, professional, Islamic-style **retrieval chatbot**. It answers **only** from local data files — Tafseer As-Saʿdi (تيسير الكريم الرحمن) plus an optional curated Q&A file.

> **This is not a general AI chatbot.** There is no OpenAI/Claude API, no internet search, and no generated religious knowledge anywhere in the code. If the answer is not in the data, the bot says so clearly.

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4
- Local JSON data only — no backend, no external APIs

## Install & run

```bash
npm install
npm run dev
```

Then open the printed URL (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Where to put your data

There are **two** data sources:

### 1. The tafseer dataset (main source)

```
public/data/tafseer_saadi.json
```

An array of grouped tafseer entries. To replace it, drop in a new file with the same shape:

```json
[
  {
    "surah": 1,
    "surah_name": "الفاتحة",
    "surah_transliteration": "Al-Fatihah",
    "surah_type": "meccan",
    "ayah_start": 1,
    "ayah_end": 7,
    "ayahs": [{ "number": 1, "text": "بِسْمِ اللَّهِ..." }],
    "ayah_text": "full ayah range text…",
    "explanation": "the tafseer text…"
  }
]
```

It lives in `public/` (not `src/`) on purpose: the ~9 MB file is fetched lazily by the browser and never bundled into the JavaScript payload. Malformed entries are silently skipped instead of crashing the app.

### 2. The curated Q&A file (optional extras)

```
src/data/chatbotData.json
```

Use it for hand-written Q&A pairs (topics, definitions, FAQ). Expected format:

```json
[
  {
    "id": "1",
    "question": "What is patience in Islam?",
    "answer": "Patience is an important value in Islam...",
    "keywords": ["patience", "sabr", "صبر"],
    "references": [
      {
        "type": "quran",
        "surah": "Al-Baqarah",
        "ayah": "153",
        "text": "O you who believe, seek help through patience and prayer..."
      }
    ],
    "language": "en"
  }
]
```

`references[].type` can be `"quran"`, `"hadith"`, `"book"` or `"other"`. The current file contains only 2–3 safe placeholder examples — replace them with your real data.

## How the chatbot decides answers

All logic lives in [`src/utils/chatbotSearch.ts`](src/utils/chatbotSearch.ts). For every question:

1. **Normalize** the text (`src/utils/textNormalizer.ts`): strip tashkeel and Quranic marks, unify `أ إ آ ٱ → ا`, `ة → ه`, `ى → ي`, convert Arabic-Indic digits, lowercase Latin, collapse whitespace.
2. **Exact question match** against the curated Q&A file.
3. **Analytics questions** (`src/utils/quranAnalytics.ts`) — see below.
4. **Surah/ayah reference detection** — recognizes Arabic names (`سورة البقرة آية ١٥٣`), transliterations (`al-baqarah 153`, `baqarah`), and `2:255`-style numeric references, then returns the tafseer passage covering that ayah. A surah name without an ayah returns the surah's first passage with a hint to specify an ayah.
5. **Scored Q&A keyword match** (question / keywords / answer, weighted).
6. **Scored full-text search** across the tafseer (verse text weighted higher than explanation text, with exact-phrase bonuses). At least half of the meaningful query tokens must appear.
7. **Fallback** — if no result clears the score threshold, the bot answers honestly that it could not find an answer in the provided data. Unintelligible input gets a "please rephrase" reply instead.

Every tafseer answer shows the ayah range and full verse text in a reference card.

## Quran text analytics

Counting questions are answered by scanning the mushaf text in the dataset — pure computation, never generated knowledge. Supported (Arabic and English):

| Question type | Examples |
| --- | --- |
| Word occurrences | «كم مرة ذكرت كلمة الله؟» — "How many times is «الله» mentioned?" |
| Scoped to a surah | «كم مرة وردت كلمة الرحمن في سورة مريم» |
| Diacritics | «كم شدة في القرآن» (also فتحة، ضمة، كسرة، سكون، تنوين، مدة، همزة) |
| Letters | «كم حرف الألف في القرآن» |
| Dataset totals | «كم آية في القرآن»، «كم سورة»، «كم كلمة»، «كم حرف» |

Counting rules (always stated inside the answer):

- Word counts run on the normalized text and report **standalone** occurrences and occurrences **attached to particles / inside other words** separately, including elided-lam forms (`الله ← لله`, `الرحمن ← للرحمن`).
- Diacritic counts run on the raw mushaf text (sukun counts both glyph forms `ْ` and `ۡ`).
- Whole-Quran word counts include a per-surah "top surahs" bar chart.
- Every analytics answer carries a note that figures are computed from this dataset's text and may differ slightly from published Quran-statistics references depending on counting methodology.

Sanity checks against classical tallies: the dataset holds 114 surahs and 6,236 ayahs; «الرحمن» counts 57 in the whole Quran and 16 in Surah Maryam — all matching the well-known reference numbers.

## Safety & reliability

- Input is sanitized (`src/utils/inputSanitizer.ts`): control/invisible characters removed, 500-char limit, empty messages blocked.
- No `dangerouslySetInnerHTML` anywhere — React escapes all rendered text.
- Client-side rate limiting (min 0.9 s between sends, max 8 messages / 15 s).
- Chat history persists to `localStorage` (capped at 80 messages); "clear chat" wipes it.
- Full RTL support; the UI is bilingual (Arabic default, English toggle in the header) and each message auto-detects its direction.
- Bot answers stream in letter by letter with a blinking cursor (`src/hooks/useTypewriter.ts`). The reveal is time-based (~1–6 s regardless of length), references fade in after the text completes, clicking the bubble skips to the full answer, and restored history renders instantly without animation.

## Project structure

```
src/
  components/
    chat/   ChatWindow, ChatMessage, ChatInput, SuggestedQuestions, TypingIndicator
    ui/     Button, Card, EmptyState, Alert
  data/     chatbotData.json        (curated Q&A — replace with your data)
  hooks/    useChat.ts              (state, rate limiting, localStorage)
  types/    chat.types.ts, data.types.ts
  utils/    textNormalizer.ts, chatbotSearch.ts, inputSanitizer.ts,
            dataLoader.ts, strings.ts (bilingual UI copy)
public/
  data/     tafseer_saadi.json      (main dataset — replace with your data)
```
