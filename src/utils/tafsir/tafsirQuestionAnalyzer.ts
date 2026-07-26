import type { TafsirSourceId } from '../../types/data.types';
import { normalizeText } from '../textNormalizer';
import { resolveNamedAyahRange } from '../namedAyahs';
import {
  detectComparison,
  detectRequestedSources,
  detectSimplificationRequest,
  detectSummaryRequest,
} from './tafsirSourceDetector';
import {
  detectSurahNumber,
  resolveQuranPhrase,
  surahAyahCount,
  surahDisplayName,
} from './quranReference';

/**
 * ============================================================
 *  Tafsir question analyzer.
 *
 *  Extends (never replaces) the existing intent pipeline: after the app's
 *  detectIntent() has already classified a question as tafsir-shaped, THIS
 *  module works out the specifics the multi-source engine needs — the exact
 *  surah/ayah(s), any quoted phrase or named ayah, which source(s) were
 *  requested, and whether it's a comparison / summary / follow-up.
 *
 *  It is deterministic and retrieval-only: it resolves references against
 *  the verified mushaf, and it NEVER invents surah/ayah numbers. When a
 *  reference can't be pinned down safely it returns needsClarification with
 *  a reason instead of guessing.
 * ============================================================
 */

export type TafsirQuestionIntent =
  | 'exact_ayah'
  | 'ayah_range'
  | 'named_ayah'
  | 'quran_phrase'
  | 'surah_tafsir'
  | 'topic_search'
  | 'compare_tafsir'
  | 'follow_up'
  | 'unsupported';

export interface TafsirQuestionAnalysis {
  originalText: string;
  normalizedText: string;

  intent: TafsirQuestionIntent;

  surahNumber: number | null;
  surahName: string | null;

  ayahStart: number | null;
  ayahEnd: number | null;
  /**
   * True when the user asked for a WHOLE surah's tafsir ("تفسير سورة الكهف").
   * ayahStart/ayahEnd are then resolved to the surah's full range [1, count],
   * so retrieval covers every verse — never just verse 1.
   */
  fullSurah: boolean;

  namedAyah: string | null;
  quotedPhrase: string | null;

  /** Sources the QUESTION explicitly named (may be empty — caller falls back). */
  requestedSources: TafsirSourceId[];
  /** True when the question asked for all/the three tafsirs. */
  asksForAllSources: boolean;

  compareSources: boolean;
  asksForSummary: boolean;
  asksForSimplification: boolean;

  confidence: number;
  needsClarification: boolean;
  clarificationReason?: string;
  /** Extra candidate refs when a phrase was ambiguous (for a clarify list). */
  phraseCandidates?: { surah: number; ayah: number }[];
}

/**
 * Minimal, safe conversation memory carried between messages. Only references
 * and source selection — never full tafsir text. Reset when a new, unrelated
 * question arrives (see isFollowUp / analyzeTafsirQuestion).
 */
export interface TafsirConversationContext {
  lastSurahNumber: number | null;
  lastSurahName: string | null;
  lastAyahStart: number | null;
  lastAyahEnd: number | null;
  lastSources: TafsirSourceId[];
  lastWasComparison: boolean;
}

/* ------------------------------------------------------------------ */
/* Small Arabic count-word helpers (for "أول خمس آيات", "آخر آيتين")     */
/* ------------------------------------------------------------------ */

const COUNT_WORDS: Record<string, number> = {
  ايه: 1,
  ايتين: 2,
  ايتان: 2,
  ثلاث: 3,
  اربع: 4,
  خمس: 5,
  ست: 6,
  سبع: 7,
  ثمان: 8,
  ثماني: 8,
  تسع: 9,
  عشر: 10,
};

/** Reads a count from a digit or a small Arabic number word after a cue. */
function countAfter(normQuery: string, cues: RegExp): number | null {
  const m = normQuery.match(cues);
  if (!m) return null;
  const rest = normQuery.slice(m.index! + m[0].length).trim();
  const digit = rest.match(/^\d+/);
  if (digit) return Number(digit[0]);
  const word = rest.split(' ')[0];
  return COUNT_WORDS[word] ?? null;
}

/* ------------------------------------------------------------------ */
/* Reference / range extraction                                        */
/* ------------------------------------------------------------------ */

interface RangeParse {
  ayahStart: number | null;
  ayahEnd: number | null;
}

/** Ordinal words → ayah number, for «الآية الأولى/الثانية…». */
const ORDINAL_WORDS: Record<string, number> = {
  الاولي: 1,
  الاول: 1,
  الثانيه: 2,
  الثاني: 2,
  الثالثه: 3,
  الثالث: 3,
  الرابعه: 4,
  الرابع: 4,
  الخامسه: 5,
  الخامس: 5,
  السادسه: 6,
  السابعه: 7,
};

function ordinalAyah(normQuery: string): number | null {
  if (!/ايه|اية|الايه/.test(normQuery)) return null;
  for (const [word, n] of Object.entries(ORDINAL_WORDS)) {
    if (` ${normQuery} `.includes(` ${word} `)) return n;
  }
  return null;
}

/** Parse an explicit ayah or ayah range out of the query, given its surah. */
function parseAyahRange(normQuery: string, surah: number | null): RangeParse {
  // "(من) X إلى/حتى/ل/– Y" — «من» is optional so «الآيات 1 إلى 3» parses too.
  // normalizeText already mapped ى→ي, so «إلى»/«الى»→«الي», «حتى»→«حتي».
  const fromTo = normQuery.match(/(?:من\s+)?(\d+)\s*(?:الي|حتي|ل|–|—|-)\s*(\d+)/);
  if (fromTo) {
    const a = Number(fromTo[1]);
    const b = Number(fromTo[2]);
    return { ayahStart: Math.min(a, b), ayahEnd: Math.max(a, b) };
  }

  // "أول N آيات" — first N ayahs of the surah.
  const firstN = countAfter(normQuery, /اول\s+/);
  if (firstN && /ايات|ايه/.test(normQuery)) {
    return { ayahStart: 1, ayahEnd: firstN };
  }

  // "آخر N آيات" / "آخر آيتين" — last N ayahs (needs the surah's ayah count).
  if (/اخر/.test(normQuery) && surah) {
    const lastN = countAfter(normQuery, /اخر\s+/);
    const total = surahAyahCount(surah);
    if (lastN && total) {
      return { ayahStart: Math.max(1, total - lastN + 1), ayahEnd: total };
    }
  }

  // Two bare numbers joined by "و" → "الآيتان 1 و2".
  const twoNums = normQuery.match(/(\d+)\s*و\s*(\d+)/);
  if (twoNums) {
    const a = Number(twoNums[1]);
    const b = Number(twoNums[2]);
    return { ayahStart: Math.min(a, b), ayahEnd: Math.max(a, b) };
  }

  // Ordinal single ayah — "الآية الأولى/الثانية…".
  const ord = ordinalAyah(normQuery);
  if (ord !== null) return { ayahStart: ord, ayahEnd: ord };

  return { ayahStart: null, ayahEnd: null };
}

/** All standalone numbers in the query (surah:ayah handled separately). */
function bareNumbers(normQuery: string): number[] {
  return (normQuery.match(/\d+/g) ?? []).map(Number);
}

/* ------------------------------------------------------------------ */
/* Phrase extraction (for "قوله تعالى ...")                             */
/* ------------------------------------------------------------------ */

const PHRASE_FILLERS = new Set(
  [
    'ما', 'تفسير', 'فسر', 'اشرح', 'شرح', 'معنى', 'معني', 'ماذا', 'قال', 'في',
    'قوله', 'تعالى', 'تعالي', 'اية', 'ايه', 'الايه', 'اية', 'من', 'سوره',
    'قارن', 'بين', 'السعدي', 'الطبري', 'ابن', 'كثير', 'التفاسير', 'الثلاثه',
    'عن', 'و', 'ال', 'لخص', 'اختصر', 'بسط', 'وضح',
  ].map((w) => normalizeText(w)),
);

function extractQuotedPhrase(normQuery: string): string {
  return normQuery
    .split(' ')
    .filter((w) => w.length > 1 && !PHRASE_FILLERS.has(w) && !/^\d+$/.test(w))
    .join(' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Follow-up detection                                                 */
/* ------------------------------------------------------------------ */

/** Short, reference-less phrasings that clearly continue the previous turn. */
const FOLLOWUP_RE =
  /^(و?ماذا قال|واعرض|اعرض ايضا|و?ايضا|اضف|اختصرها|بسطها|وضحها|و?الطبري|و?السعدي|و?ابن كثير)/;

function looksLikeFollowUp(
  normQuery: string,
  hasOwnReference: boolean,
  namedRequested: TafsirSourceId[],
): boolean {
  if (hasOwnReference) return false;
  // Naming a source with no reference of its own, right after a prior answer,
  // is a follow-up ("وماذا قال الطبري؟", "اعرض الطبري أيضًا").
  if (namedRequested.length > 0 && normQuery.split(' ').length <= 5) return true;
  return FOLLOWUP_RE.test(normQuery);
}

/* ------------------------------------------------------------------ */
/* Public analyzer                                                     */
/* ------------------------------------------------------------------ */

const TOPIC_RE = /ايات\s*عن|هات\s*ايات|قصه|ماذا\s*يقول\s*القران\s*عن/;

/**
 * Analyzes a tafsir question into a structured, deterministic result.
 * @param rawText  sanitized user text
 * @param context  previous-turn reference context (for follow-ups), or null
 */
export function analyzeTafsirQuestion(
  rawText: string,
  context?: TafsirConversationContext | null,
): TafsirQuestionAnalysis {
  const normalizedText = normalizeText(rawText);

  const requested = detectRequestedSources(normalizedText);
  const requestedSources = requested.sources;
  const asksForAllSources = requested.all;
  const compareSources = detectComparison(normalizedText);
  const asksForSummary = detectSummaryRequest(normalizedText);
  const asksForSimplification = detectSimplificationRequest(normalizedText);

  const base: TafsirQuestionAnalysis = {
    originalText: rawText,
    normalizedText,
    intent: 'unsupported',
    surahNumber: null,
    surahName: null,
    ayahStart: null,
    ayahEnd: null,
    fullSurah: false,
    namedAyah: null,
    quotedPhrase: null,
    requestedSources,
    asksForAllSources,
    compareSources,
    asksForSummary,
    asksForSimplification,
    confidence: 0,
    needsClarification: false,
  };

  // 1) Named ayah (e.g. «آية الكرسي», «خواتيم سورة البقرة»).
  const named = resolveNamedAyahRange(normalizedText);
  if (named) {
    if (named.ambiguous) {
      return {
        ...base,
        intent: 'named_ayah',
        namedAyah: named.name,
        needsClarification: true,
        clarificationReason: 'ambiguous_named_ayah',
        confidence: 0.4,
      };
    }
    return {
      ...base,
      intent: named.ayahStart === named.ayahEnd ? 'named_ayah' : 'ayah_range',
      namedAyah: named.name,
      surahNumber: named.surah,
      surahName: surahDisplayName(named.surah),
      ayahStart: named.ayahStart,
      ayahEnd: named.ayahEnd,
      confidence: 0.95,
      compareSources,
    };
  }

  // 2) Explicit surah + ayah / range.
  const surahByName = detectSurahNumber(normalizedText);
  const nums = bareNumbers(normalizedText);

  // "2:255" style.
  const colon = normalizedText.match(/(\d+)\s*[:：]\s*(\d+)/);
  let surahNumber = surahByName;
  let ayahStart: number | null = null;
  let ayahEnd: number | null = null;

  if (colon) {
    surahNumber = surahNumber ?? Number(colon[1]);
    if (Number(colon[1]) >= 1 && Number(colon[1]) <= 114) {
      surahNumber = Number(colon[1]);
    }
    ayahStart = Number(colon[2]);
    ayahEnd = ayahStart;
  } else if (surahNumber) {
    const range = parseAyahRange(normalizedText, surahNumber);
    if (range.ayahStart !== null) {
      ayahStart = range.ayahStart;
      ayahEnd = range.ayahEnd ?? range.ayahStart;
    } else if (nums.length >= 1) {
      // A single ayah number alongside a named surah.
      ayahStart = nums[0];
      ayahEnd = nums[0];
    }
  }

  // (A named ayah already returned above, so only surah/colon refs remain.)
  const hasOwnReference = surahNumber !== null || colon !== null;

  // 3) Follow-up: no reference of its own, continues the previous turn.
  if (
    context &&
    context.lastSurahNumber !== null &&
    looksLikeFollowUp(normalizedText, hasOwnReference, requestedSources)
  ) {
    return {
      ...base,
      intent: 'follow_up',
      surahNumber: context.lastSurahNumber,
      surahName: context.lastSurahName,
      ayahStart: context.lastAyahStart,
      ayahEnd: context.lastAyahEnd,
      // A newly named source overrides the prior selection; otherwise the
      // previous turn's sources carry over (e.g. «اختصرها» keeps them).
      requestedSources: requestedSources.length > 0 ? requestedSources : context.lastSources,
      compareSources: compareSources || context.lastWasComparison,
      confidence: 0.85,
    };
  }

  // 4) Explicit reference resolved.
  if (surahNumber !== null) {
    if (ayahStart !== null) {
      const isRange = ayahEnd !== null && ayahEnd !== ayahStart;
      return {
        ...base,
        intent: compareSources ? 'compare_tafsir' : isRange ? 'ayah_range' : 'exact_ayah',
        surahNumber,
        surahName: surahDisplayName(surahNumber),
        ayahStart,
        ayahEnd: ayahEnd ?? ayahStart,
        confidence: 0.9,
      };
    }
    // Surah named, no ayah → WHOLE-surah tafsir request. Resolve the scope to
    // the surah's full range so retrieval returns every verse, not just the
    // first passage. The scope is the single source of truth for all sources.
    const count = surahAyahCount(surahNumber);
    return {
      ...base,
      intent: compareSources ? 'compare_tafsir' : 'surah_tafsir',
      surahNumber,
      surahName: surahDisplayName(surahNumber),
      ayahStart: count ? 1 : null,
      ayahEnd: count ?? null,
      fullSurah: count !== null,
      confidence: 0.7,
    };
  }

  // 5) An ayah number but NO surah and no context → must ask which surah.
  if (nums.length >= 1 && /ايه|اية|الايه|تفسير|فسر|اشرح/.test(normalizedText)) {
    return {
      ...base,
      intent: 'exact_ayah',
      ayahStart: nums[0],
      ayahEnd: nums[0],
      needsClarification: true,
      clarificationReason: 'missing_surah',
      confidence: 0.3,
    };
  }

  // 6) Topic search ("آيات عن الصبر") — not an exact reference.
  if (TOPIC_RE.test(normalizedText)) {
    return { ...base, intent: 'topic_search', confidence: 0.5 };
  }

  // 7) Quoted Quran phrase → resolve against the verified mushaf.
  const phrase = extractQuotedPhrase(normalizedText);
  if (phrase && phrase.length >= 3) {
    const resolved = resolveQuranPhrase(phrase);
    if (resolved.matches.length === 1) {
      const hit = resolved.matches[0];
      return {
        ...base,
        intent: compareSources ? 'compare_tafsir' : 'quran_phrase',
        quotedPhrase: phrase,
        surahNumber: hit.surah,
        surahName: surahDisplayName(hit.surah),
        ayahStart: hit.ayah,
        ayahEnd: hit.ayah,
        confidence: 0.8,
      };
    }
    if (resolved.matches.length > 1) {
      return {
        ...base,
        intent: 'quran_phrase',
        quotedPhrase: phrase,
        needsClarification: true,
        clarificationReason: 'ambiguous_phrase',
        phraseCandidates: resolved.matches,
        confidence: 0.4,
      };
    }
  }

  // Nothing tafsir-specific recognized — let the existing pipeline handle it.
  return base;
}
