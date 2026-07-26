import type {
  AnswerReference,
  ChatbotEntry,
  TafseerGroup,
  TafsirSearchMatch,
  TafsirSourceId,
} from '../types/data.types';
import type { AppLanguage, MessageStats } from '../types/chat.types';
import { normalizeText, containsArabic } from './textNormalizer';
import {
  getAnalyticsSurahLookup,
  getQuranAnalyticsEntries,
  tryAnalytics,
} from './quranAnalytics';
import { getQuranValidation } from './quranDataLoader';
import { tryExtendedIntents } from './quranIntents';
import { detectIntent } from './intentDetector';
import { resolveNamedAyah } from './namedAyahs';
import type { QuestionIntent } from '../types/intent.types';
import qaDataRaw from '../data/chatbotData.json';
import { sourceArabicName } from './tafsirSources';
import type {
  TafsirConversationContext,
  TafsirQuestionAnalysis,
} from './tafsir/tafsirQuestionAnalyzer';
import {
  buildTafsirContext,
  planTafsirPassage,
  type TafsirPlan,
} from './tafsir/tafsirPlan';
import { retrieveTafsirMatches } from './tafsir/tafsirSearch';

/**
 * ============================================================
 *  LOCAL retrieval engine — this is the ONLY "brain" of the app.
 *  It matches user questions against:
 *    1. the curated Q&A file  (src/data/chatbotData.json)
 *    2. the Tafseer As-Sa'di dataset (src/data/tafseer_saadi.json)
 *  It NEVER generates religious content. If nothing matches with
 *  enough confidence, it returns a clear fallback result.
 * ============================================================
 */

export interface SearchResult {
  kind: 'answer' | 'fallback' | 'clarify';
  source?: 'tafseer' | 'qa' | 'analytics' | 'metadata';
  title?: string;
  answer?: string;
  references?: AnswerReference[];
  note?: string;
  stats?: MessageStats;
  /**
   * 'direct'  — the user unambiguously named a surah/ayah and this is
   *             its tafsir (searchByReference).
   * 'search'  — found by keyword/phrase matching, never a sure thing.
   * Read by answerBuilder.ts to decide confidence; undefined defaults
   * to 'search' (the conservative choice).
   */
  matchType?: 'direct' | 'search';

  /**
   * Per-source tafsir passages for a multi-source answer (one or more of
   * السعدي / ابن كثير / الطبري). Present only for tafsir-passage questions
   * resolved by the multi-source engine; `answer`/`references` above stay
   * empty for these and the UI renders one card per entry.
   */
  tafsirMatches?: TafsirSearchMatch[];
  /** True when the answer is a side-by-side comparison of sources. */
  comparison?: boolean;
  /**
   * The reference/source context this turn resolved to — stored by the
   * caller (useAssistant) so the NEXT message can be a follow-up.
   */
  resolvedContext?: TafsirConversationContext;
}

/** Options that let a caller steer multi-source tafsir retrieval. */
export interface TafsirSearchOptions {
  /** Sources the UI currently has selected. Defaults to all three. */
  selectedSources?: TafsirSourceId[];
  /** Force comparison mode regardless of the query wording. */
  compare?: boolean;
  /** Previous-turn context, enabling follow-up questions. */
  conversationContext?: TafsirConversationContext | null;

  /* ---- remote-passage injection (see src/utils/tafsir/tafsirPlan.ts) ---- */

  /**
   * The plan the caller already computed. Passing it — rather than letting
   * this module recompute one — is what guarantees the passages that were
   * fetched belong to the question being answered.
   */
  plan?: TafsirPlan;
  /**
   * Passage text fetched remotely for this turn, keyed by content-document id.
   * Tafsir text is no longer bundled, so this is the normal path.
   */
  prefetchedMatches?: Map<string, string>;
  /**
   * Sources whose passages could not be fetched AND were not cached. These
   * render an honest per-source notice; the sources that did resolve still
   * render their text.
   */
  unavailableSources?: TafsirSourceId[];
}

/* ------------------------------------------------------------------ */
/* Curated Q&A index (tiny file, indexed eagerly at module load)       */
/* ------------------------------------------------------------------ */

const qaData = (qaDataRaw as ChatbotEntry[]).filter(
  (e) => e && typeof e.question === 'string' && typeof e.answer === 'string',
);

interface QaIndexEntry {
  entry: ChatbotEntry;
  normQuestion: string;
  normAnswer: string;
  normKeywords: string[];
}

const qaIndex: QaIndexEntry[] = qaData.map((entry) => ({
  entry,
  normQuestion: normalizeText(entry.question),
  normAnswer: normalizeText(entry.answer),
  normKeywords: (entry.keywords ?? []).map(normalizeText).filter(Boolean),
}));

/* ------------------------------------------------------------------ */
/* Tafseer index (built lazily, once, after the dataset is loaded)      */
/* ------------------------------------------------------------------ */

interface TafseerIndexEntry {
  group: TafseerGroup;
  normAyahText: string;
  normExplanation: string;
}

interface SurahInfo {
  number: number;
  arabicName: string; // original display name
  firstGroupIdx: number;
  groupCount: number;
}

let tafseerIndex: TafseerIndexEntry[] = [];
/** normalized name/transliteration variant -> surah number */
let surahNameLookup = new Map<string, number>();
let surahInfo = new Map<number, SurahInfo>();
let indexedSource: TafseerGroup[] | null = null;

function buildTafseerIndex(groups: TafseerGroup[]): void {
  if (indexedSource === groups) return; // already indexed this dataset
  tafseerIndex = groups.map((group) => ({
    group,
    normAyahText: normalizeText(group.ayah_text),
    normExplanation: normalizeText(group.explanation),
  }));

  surahNameLookup = new Map();
  surahInfo = new Map();

  groups.forEach((g, idx) => {
    if (!surahInfo.has(g.surah)) {
      surahInfo.set(g.surah, {
        number: g.surah,
        arabicName: g.surah_name,
        firstGroupIdx: idx,
        groupCount: 0,
      });
      for (const variant of surahNameVariants(g)) {
        if (!surahNameLookup.has(variant)) surahNameLookup.set(variant, g.surah);
      }
    }
    const info = surahInfo.get(g.surah);
    if (info) info.groupCount += 1;
  });
  indexedSource = groups;
}

/** Generate matchable name variants for a surah (Arabic + transliteration). */
function surahNameVariants(g: TafseerGroup): string[] {
  const variants = new Set<string>();
  const arabic = normalizeText(g.surah_name);
  if (arabic) {
    variants.add(arabic);
    // Without the definite article: "الفاتحه" -> "فاتحه"
    if (arabic.startsWith('ال') && arabic.length > 4) variants.add(arabic.slice(2));
  }
  const translit = normalizeText(g.surah_transliteration ?? '');
  if (translit) {
    variants.add(translit); // "al fatihah" (hyphen became a space)
    const compact = translit.replace(/\s+/g, ''); // "alfatihah"
    variants.add(compact);
    const noArticle = compact.replace(/^a([lstdrzn])\1?/, '').replace(/^al/, '');
    if (noArticle.length > 3) {
      variants.add(noArticle); // "fatihah"
      if (noArticle.endsWith('h')) variants.add(noArticle.slice(0, -1)); // "fatiha"
    }
  }
  return [...variants];
}

/* ------------------------------------------------------------------ */
/* Stopwords (normalized once)                                         */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  [
    // Arabic question / filler words
    'في', 'من', 'عن', 'على', 'الى', 'إلى', 'ما', 'ماذا', 'لماذا', 'كيف',
    'هل', 'هو', 'هي', 'ذلك', 'هذا', 'هذه', 'الذي', 'التي', 'ثم', 'او', 'أو',
    'و', 'يا', 'ان', 'أن', 'إن', 'قد', 'كل', 'بعض', 'عند', 'مع', 'لي', 'لنا',
    'معنى', 'معني', 'تفسير', 'فسر', 'اشرح', 'شرح', 'سورة', 'سوره', 'ايه',
    'آية', 'اية', 'الايه', 'الآية', 'رقم', 'قوله', 'تعالى', 'تعالي',
    // English question / filler words
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
    'is', 'are', 'was', 'were', 'be', 'what', 'which', 'who', 'why', 'how',
    'does', 'do', 'did', 'can', 'could', 'me', 'my', 'i', 'you', 'it',
    'meaning', 'mean', 'means', 'explain', 'explanation', 'tafsir',
    'tafseer', 'surah', 'sura', 'surat', 'ayah', 'aya', 'ayat', 'verse',
    'chapter', 'about', 'tell',
  ].map(normalizeText),
);

function tokenize(normQuery: string): string[] {
  return normQuery
    .split(' ')
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/* ------------------------------------------------------------------ */
/* 1) Curated Q&A matching                                             */
/* ------------------------------------------------------------------ */

const QA_MIN_SCORE = 6;

function searchQa(normQuery: string, tokens: string[]): SearchResult | null {
  let best: { score: number; item: QaIndexEntry } | null = null;

  for (const item of qaIndex) {
    let score = 0;
    if (item.normQuestion === normQuery) score += 100;
    else if (
      item.normQuestion.includes(normQuery) ||
      normQuery.includes(item.normQuestion)
    ) {
      score += 12;
    }
    for (const kw of item.normKeywords) {
      if (normQuery.includes(kw)) score += 6;
    }
    for (const token of tokens) {
      if (item.normQuestion.includes(token)) score += 3;
      if (item.normAnswer.includes(token)) score += 1;
    }
    if (!best || score > best.score) best = { score, item };
  }

  if (best && best.score >= QA_MIN_SCORE) {
    const { entry } = best.item;
    return {
      kind: 'answer',
      source: 'qa',
      answer: entry.answer,
      references: entry.references ?? [],
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 2) Direct surah / ayah reference matching                           */
/* ------------------------------------------------------------------ */

interface ParsedReference {
  surah: number;
  ayah?: number;
}

function parseReference(normQuery: string): ParsedReference | null {
  // Well-known nicknames (e.g. «آية الكرسي») resolve directly — they
  // don't literally appear as text inside the ayah, so a name/number
  // scan below would never find them on its own.
  const named = resolveNamedAyah(normQuery);
  if (named) return named;

  // Try every known surah-name variant (longest first so "ال عمران"
  // style names beat shorter accidental substrings).
  let matchedSurah: number | null = null;
  let matchedLen = 0;
  for (const [variant, num] of surahNameLookup) {
    if (variant.length <= matchedLen) continue;
    // Word-boundary-ish containment check on the normalized query.
    if (` ${normQuery} `.includes(` ${variant} `) || normQuery === variant) {
      matchedSurah = num;
      matchedLen = variant.length;
    }
  }

  const numbers = (normQuery.match(/\d+/g) ?? []).map(Number);

  if (matchedSurah !== null) {
    return { surah: matchedSurah, ayah: numbers[0] };
  }

  // "2:255" or "2 255" style (surah number + ayah number)
  if (numbers.length === 2 && surahInfo.has(numbers[0])) {
    return { surah: numbers[0], ayah: numbers[1] };
  }
  return null;
}

function tafseerAnswer(
  entry: TafseerIndexEntry,
  lang: AppLanguage,
  note?: string,
  matchType: 'direct' | 'search' = 'direct',
): SearchResult {
  const { group } = entry;
  const range =
    group.ayah_start === group.ayah_end
      ? `${group.ayah_start}`
      : `${group.ayah_start}–${group.ayah_end}`;
  const title =
    lang === 'ar'
      ? `تفسير سورة ${group.surah_name} — الآية ${range}`
      : `Tafsir of Surah ${group.surah_transliteration} — Ayah ${range}`;
  return {
    kind: 'answer',
    source: 'tafseer',
    title,
    answer: group.explanation,
    references: [
      {
        type: 'quran',
        surah: lang === 'ar' ? group.surah_name : group.surah_transliteration,
        ayah: range,
        text: group.ayah_text,
      },
    ],
    note,
    matchType,
  };
}

function searchByReference(
  normQuery: string,
  lang: AppLanguage,
): SearchResult | null {
  const ref = parseReference(normQuery);
  if (!ref) return null;

  const info = surahInfo.get(ref.surah);
  if (!info) return null;

  if (ref.ayah !== undefined) {
    const hit = tafseerIndex.find(
      (e) =>
        e.group.surah === ref.surah &&
        e.group.ayah_start <= ref.ayah! &&
        e.group.ayah_end >= ref.ayah!,
    );
    if (hit) return tafseerAnswer(hit, lang);
    // Surah exists but the ayah number is out of range.
    return {
      kind: 'clarify',
      answer:
        lang === 'ar'
          ? `لم أجد الآية رقم ${ref.ayah} في سورة ${info.arabicName} ضمن البيانات. تأكد من رقم الآية وحاول مجددًا.`
          : `I could not find ayah ${ref.ayah} in Surah ${info.arabicName} within the data. Please check the ayah number and try again.`,
    };
  }

  // Surah without an ayah number: return its first passage and say so.
  const first = tafseerIndex[info.firstGroupIdx];
  const note =
    info.groupCount > 1
      ? lang === 'ar'
        ? `هذا تفسير أول مقطع من السورة. اذكر رقم آية محددًا (مثال: «سورة ${info.arabicName} آية ٥») لعرض تفسيرها.`
        : `This is the tafsir of the surah's first passage. Mention a specific ayah number (e.g. "Surah ${first.group.surah_transliteration} ayah 5") for its own tafsir.`
      : undefined;
  return tafseerAnswer(first, lang, note);
}

/* ------------------------------------------------------------------ */
/* 3) Keyword scoring across the whole tafseer                          */
/* ------------------------------------------------------------------ */

const TAFSEER_MIN_SCORE = 5;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1 && count < 6) {
    count += 1;
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return count;
}

function searchTafseerKeywords(
  normQuery: string,
  tokens: string[],
  lang: AppLanguage,
): SearchResult | null {
  if (tokens.length === 0 || tafseerIndex.length === 0) return null;

  const phrase = tokens.join(' ');
  let best: { score: number; entry: TafseerIndexEntry } | null = null;

  for (const entry of tafseerIndex) {
    let score = 0;
    let tokensHit = 0;
    for (const token of tokens) {
      const inAyah = entry.normAyahText.includes(token);
      const explCount = countOccurrences(entry.normExplanation, token);
      if (inAyah) score += 5;
      if (explCount > 0) score += 2 + Math.min(explCount, 5) * 0.5;
      if (inAyah || explCount > 0) tokensHit += 1;
    }
    // Require at least half of the meaningful tokens to appear.
    if (tokensHit < Math.ceil(tokens.length / 2)) continue;
    // Exact-phrase bonuses.
    if (tokens.length > 1) {
      if (entry.normAyahText.includes(phrase)) score += 12;
      else if (entry.normExplanation.includes(phrase)) score += 8;
    }
    if (!best || score > best.score) best = { score, entry };
  }

  if (best && best.score >= TAFSEER_MIN_SCORE) {
    return tafseerAnswer(
      best.entry,
      lang,
      lang === 'ar'
        ? 'أقرب نتيجة وُجدت بالبحث في نص التفسير.'
        : 'Closest match found by searching the tafsir text.',
      'search',
    );
  }
  void normQuery;
  return null;
}

/* ------------------------------------------------------------------ */
/* 4) Fiqh-ruling guard — never issue a fatwa                          */
/* ------------------------------------------------------------------ */

/**
 * The app must never answer a religious *ruling* itself — only scholars
 * may give fatwas. Whether a question is ruling-shaped is now decided
 * once, up front, by intentDetector.ts (QuestionIntent === 'FATWA_SAFETY').
 */
export const FATWA_NOTICE_AR =
  'هذا السؤال يحتاج إلى الرجوع لأهل العلم، ويمكنني عرض الآيات والتفاسير المرتبطة فقط.';
export const FATWA_NOTICE_EN =
  'This question needs to be referred to people of knowledge. I can only show related verses and their tafsir.';

/* ------------------------------------------------------------------ */
/* 5) Intent-directed routing                                          */
/* ------------------------------------------------------------------ */

/**
 * Tries the ONE local system the detected intent maps to. Returns null
 * when that system has nothing conclusive (or the intent doesn't map
 * to a specific system) — the caller then falls back to the same full
 * general-purpose pipeline that runs regardless, so a misclassified or
 * GENERAL_TAFSIR_SEARCH/UNKNOWN question is never worse off than before
 * intent detection existed.
 */
const DIRECTED_INTENTS = new Set<QuestionIntent>([
  'QURAN_STATS',
  'WORD_LOCATION',
  'TAFSIR_EXPLANATION',
  'WORD_MEANING',
  'TOPIC_AYAHS',
  'SURAH_INFO',
  'AYAH_SEARCH',
]);

function routeByIntent(
  intent: QuestionIntent,
  normQuery: string,
  groups: TafseerGroup[] | null,
  lang: AppLanguage,
): SearchResult | null {
  // FATWA_SAFETY is handled earlier, before routing. GENERAL_TAFSIR_SEARCH
  // and UNKNOWN have no single dedicated system — fall through immediately.
  if (!groups || !DIRECTED_INTENTS.has(intent)) return null;

  // Try both systems that together cover every specific intent, in the
  // exact same relative order the general pipeline below also uses
  // (quranIntents.ts's more specific matchers — tafsir-of-a-phrase, word
  // meaning, topic/story ayahs, surah metadata, phrase location/count,
  // starts/ends-with, prev/next ayah, summaries — before quranAnalytics.ts's
  // broader "كم"/"أين ... كلمة" matchers). A single intent can legitimately
  // resolve in either system (e.g. "كم مرة وردت عبارة …" is classified
  // QURAN_STATS but is actually a quranIntents phrase-count query), so
  // both are tried regardless of which of the two the intent nominally maps
  // to — this is what keeps directed routing from ever being *worse* than
  // the un-directed pipeline it's meant to prioritize.
  const extended = tryExtendedIntents(normQuery, groups, lang);
  if (extended) {
    if (extended.kind === 'clarify') return { kind: 'clarify', answer: extended.answer ?? '' };
    return {
      kind: 'answer',
      source: extended.source,
      title: extended.title,
      answer: extended.answer,
      note: extended.note,
      references: extended.references,
    };
  }

  const analytics = tryAnalytics(
    normQuery,
    getQuranAnalyticsEntries(),
    getAnalyticsSurahLookup(),
    lang,
  );
  if (analytics) {
    if (analytics.kind === 'clarify') return { kind: 'clarify', answer: analytics.answer };
    return {
      kind: 'answer',
      source: 'analytics',
      title: analytics.title,
      answer: analytics.answer,
      note: analytics.note,
      stats: analytics.stats,
      references: analytics.references,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* 6) Multi-source tafsir retrieval (السعدي / ابن كثير / الطبري)         */
/* ------------------------------------------------------------------ */

const NO_PASSAGE_AR =
  'لم أجد نصًا مطابقًا في التفسير المحدد داخل بيانات التطبيق.';

/** Max passages shown PER SOURCE for a whole-surah request (rest is paginated). */
const FULL_SURAH_MAX_PER_SOURCE = 15;

/**
 * Caps a whole-surah result to keep the chat readable: at most N passages per
 * source, in ayah order (matches are already sorted by source→ayah). Returns
 * whether anything was dropped so the summary can say so honestly.
 */
function capFullSurahMatches(
  all: TafsirSearchMatch[],
  sources: TafsirSourceId[],
): { matches: TafsirSearchMatch[]; truncatedFullSurah: boolean } {
  const kept: TafsirSearchMatch[] = [];
  let truncated = false;
  for (const source of sources) {
    const forSource = all.filter((m) => m.source === source);
    if (forSource.length > FULL_SURAH_MAX_PER_SOURCE) truncated = true;
    kept.push(...forSource.slice(0, FULL_SURAH_MAX_PER_SOURCE));
  }
  return { matches: kept, truncatedFullSurah: truncated };
}

/** The Bismillah display rule for a full-surah view (§1): Fatihah / Tawbah / rest. */
function bismillahNoteForSurah(surah: number): string {
  if (surah === 1) return 'البسملة هي الآية الأولى من سورة الفاتحة.';
  if (surah === 9) return 'لا تُعرض البسملة في فاتحة سورة التوبة.';
  return 'تُعرض البسملة في فتح السورة مرة واحدة دون رقم آية.';
}

/**
 * Handles a tafsir-passage question across the selected source(s). Returns
 * null when the question is NOT a concrete tafsir-passage request (so the
 * existing pipeline handles it unchanged). The gate is deliberately narrow:
 * structured intents (stats, metadata, word meaning, topic, hadith, fatwa)
 * are excluded so nothing that already works is hijacked.
 */
function handleMultiSourceTafsir(
  rawQuery: string,
  detectedIntent: QuestionIntent,
  lang: AppLanguage,
  options: TafsirSearchOptions | undefined,
): SearchResult | null {
  // The gate lives in tafsirPlan.ts so that the code which PRE-FETCHES
  // passages over the network and this code, which answers from them, make
  // one identical decision. Reuse the caller's plan when it supplied one.
  const plan =
    options?.plan ??
    planTafsirPassage(rawQuery, detectedIntent, {
      selectedSources: options?.selectedSources,
      compare: options?.compare,
      conversationContext: options?.conversationContext,
    });

  if (plan.kind === 'skip') return null;
  if (plan.kind === 'clarify') {
    return { kind: 'clarify', answer: clarifyText(plan.analysis, lang) };
  }

  const { analysis, sources, comparison } = plan;

  const retrieved = retrieveTafsirMatches(sources, analysis, {
    passages: options?.prefetchedMatches,
    unavailableSources: options?.unavailableSources,
  });
  const { failedSources, allMissing } = retrieved;

  // A whole-surah request can yield very many passages; cap what we render per
  // source and say so, rather than dumping hundreds of cards (spec: paginate).
  const fullSurah = analysis.fullSurah === true;
  const { matches, truncatedFullSurah } = fullSurah
    ? capFullSurahMatches(retrieved.matches, sources)
    : { matches: retrieved.matches, truncatedFullSurah: false };

  const surahLabel = analysis.surahName ?? `سورة ${analysis.surahNumber}`;
  const range =
    !fullSurah && analysis.ayahStart !== null
      ? analysis.ayahStart === analysis.ayahEnd
        ? `${analysis.ayahStart}`
        : `${analysis.ayahStart}–${analysis.ayahEnd}`
      : '';

  const title = fullSurah
    ? `تفسير سورة ${surahLabel} (كامل)`
    : comparison
      ? `مقارنة التفاسير — سورة ${surahLabel}${range ? ` الآية ${range}` : ''}`
      : `تفسير سورة ${surahLabel}${range ? ` — الآية ${range}` : ''}`;

  // Honest failure/absence messaging — never substitutes another source.
  let summary: string;
  if (allMissing) {
    summary = NO_PASSAGE_AR;
  } else if (comparison) {
    summary = `النصوص المتطابقة من ${sources.length} من التفاسير، منسوبة لكل مفسّر دون إصدار حكم بالاتفاق أو الاختلاف.`;
  } else {
    summary = `التفسير من ${sources.length === 1 ? 'المصدر المحدد' : 'المصادر المحددة'} كما ورد نصًّا في بيانات التطبيق.`;
  }
  // Bismillah rule for a full-surah display (§1).
  if (fullSurah && analysis.surahNumber !== null && !allMissing) {
    summary += ` ${bismillahNoteForSurah(analysis.surahNumber)}`;
  }
  if (truncatedFullSurah) {
    summary += ' (عُرض جزء من مقاطع السورة؛ اطلب آيةً أو نطاقًا محددًا لعرض تفصيلي.)';
  }
  if (failedSources.length > 0) {
    const names = failedSources.map(sourceArabicName).join('، ');
    summary += ` (تعذّر تحميل: ${names}. بقية التفاسير متاحة.)`;
  }

  const matchType: 'direct' | 'search' =
    analysis.intent === 'quran_phrase' ? 'search' : 'direct';

  const note =
    (analysis.asksForSummary || analysis.asksForSimplification) && !allMissing
      ? 'مقتطف مختصر مقتطع حرفيًا من نص التفسير — يمكن عرض النص كاملًا.'
      : undefined;

  return {
    kind: 'answer',
    source: 'tafseer',
    title,
    answer: summary,
    note,
    tafsirMatches: matches,
    comparison,
    matchType,
    resolvedContext: buildTafsirContext(analysis, sources, comparison),
  };
}

function clarifyText(analysis: TafsirQuestionAnalysis, lang: AppLanguage): string {
  if (analysis.clarificationReason === 'missing_surah') {
    return lang === 'ar'
      ? 'اذكر اسم السورة مع رقم الآية (مثال: «تفسير الآية ٥ من سورة الفاتحة»).'
      : 'Please name the surah along with the ayah number (e.g. "tafsir of ayah 5 of Surah Al-Fatihah").';
  }
  if (analysis.clarificationReason === 'ambiguous_named_ayah') {
    return lang === 'ar'
      ? 'هذا الاسم قد يشير إلى أكثر من آية؛ اذكر اسم السورة أو رقم الآية.'
      : 'This name may refer to more than one ayah; please give the surah or ayah number.';
  }
  // ambiguous_phrase
  const list = (analysis.phraseCandidates ?? [])
    .slice(0, 6)
    .map((c) => `${c.surah}:${c.ayah}`)
    .join('، ');
  return lang === 'ar'
    ? `وجدت أكثر من آية مطابقة للعبارة؛ اذكر اسم السورة أو رقم الآية.${list ? ` (مواضع محتملة: ${list})` : ''}`
    : `I found more than one matching ayah; please name the surah or ayah number.${list ? ` (possible: ${list})` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Search the local data for an answer.
 * @param rawQuery already-sanitized user text
 * @param groups   tafseer dataset (null while loading / on load failure)
 * @param lang     current UI language, used for meta-text only
 */
export function searchAnswer(
  rawQuery: string,
  groups: TafseerGroup[] | null,
  lang: AppLanguage,
  options?: TafsirSearchOptions,
): SearchResult {
  const replyLang: AppLanguage = containsArabic(rawQuery) ? 'ar' : lang;

  // Classify the question BEFORE searching anything — this decides which
  // local system (if any) gets a first, directed attempt below.
  const detected = detectIntent(rawQuery);
  const normQuery = detected.normalizedQuery;

  // Unintelligible input -> ask to rephrase.
  if (!detected.isIntelligible) {
    return {
      kind: 'clarify',
      answer:
        replyLang === 'ar'
          ? 'لم أفهم سؤالك جيدًا. هل يمكنك إعادة صياغته بكلمات أوضح؟'
          : 'I did not quite understand your question. Could you rephrase it?',
    };
  }

  if (groups) buildTafseerIndex(groups);
  const tokens = tokenize(normQuery);

  // 0) fiqh-ruling requests (halal/haram, obligation, fatwa) are never
  // answered by this app — only scholars may issue rulings. This check
  // runs before Q&A/tafsir matching so a ruling-style phrasing never
  // slips through as a regular tafsir/meaning answer.
  if (detected.intent === 'FATWA_SAFETY') {
    return {
      kind: 'clarify',
      answer: replyLang === 'ar' ? FATWA_NOTICE_AR : FATWA_NOTICE_EN,
    };
  }

  // 0b) Quran analytical / statistical questions (§1–§3). Computed directly
  // from quran.json — BEFORE tafsir, curated Q&A, keyword search and fallback,
  // and INDEPENDENT of tafsir `groups` (which is empty now the tafsir text
  // lives in Firestore). This is the fix for «ما أطول سورة؟» and friends
  // falling through to tafsir search.
  if (detected.intent === 'QURAN_STATS' || detected.intent === 'WORD_LOCATION') {
    if (__DEV__) {
      const v = getQuranValidation();
      // eslint-disable-next-line no-console
      console.debug('[AssistantIntent]', detected.intent);
      // eslint-disable-next-line no-console
      console.debug('[AssistantRoute]', 'quran-analytics');
      // eslint-disable-next-line no-console
      console.debug('[AnalyticsDataset]', { valid: v.valid, ayahCount: v.count });
    }
    const analytics = tryAnalytics(
      normQuery,
      getQuranAnalyticsEntries(),
      getAnalyticsSurahLookup(),
      replyLang,
    );
    if (analytics) {
      if (analytics.kind === 'clarify') {
        return { kind: 'clarify', answer: analytics.answer };
      }
      return {
        kind: 'answer',
        source: 'analytics',
        title: analytics.title,
        answer: analytics.answer,
        note: analytics.note,
        stats: analytics.stats,
        references: analytics.references,
      };
    }
  }

  // 1) exact question in the curated Q&A file
  const exactQa = qaIndex.find((i) => i.normQuestion === normQuery);
  if (exactQa) {
    return {
      kind: 'answer',
      source: 'qa',
      answer: exactQa.entry.answer,
      references: exactQa.entry.references ?? [],
    };
  }

  // 1b) multi-source tafsir passage (السعدي / ابن كثير / الطبري). Runs before
  // the single-source routing/extended-intents below so a tafsir-of-an-ayah
  // question is answered with source-labeled cards from the SELECTED sources
  // rather than the old As-Sa'di-only path. Its gate is narrow: it returns
  // null for anything that isn't a concrete tafsir-passage request, so every
  // structured intent (stats/metadata/word-meaning/topic/hadith) still falls
  // through to the exact same handlers as before.
  const multi = handleMultiSourceTafsir(rawQuery, detected.intent, replyLang, options);
  if (multi) return multi;

  // 2) intent-directed lookup: try the ONE local system the detected
  // intent maps to (quranAnalytics for QURAN_STATS/WORD_LOCATION,
  // quranIntents for TAFSIR_EXPLANATION/WORD_MEANING/TOPIC_AYAHS/
  // SURAH_INFO/AYAH_SEARCH). Returns null for GENERAL_TAFSIR_SEARCH/
  // UNKNOWN, or when the directed system found nothing — either way we
  // fall through to the exact same general pipeline as before.
  const directed = routeByIntent(detected.intent, normQuery, groups, replyLang);
  if (directed) return directed;

  // 3) extended intents: tafsir-of-a-quoted-phrase, word meaning, topic &
  // prophet-story ayahs, surah metadata, phrase location, prev/next ayah,
  // starts/ends-with search, exact-phrase counting, summaries. Tried before
  // the generic "كم" counting logic and the plain surah/ayah reference
  // lookup below because their trigger phrases (مكية/مدنية، ترتيب، تبدأ
  // بـ، عبارة/جملة، لخص، …) are far more specific and would otherwise be
  // swallowed by those broader, less specific matchers.
  if (groups) {
    const extended = tryExtendedIntents(normQuery, groups, replyLang);
    if (extended) {
      if (extended.kind === 'clarify') {
        return { kind: 'clarify', answer: extended.answer ?? '' };
      }
      return {
        kind: 'answer',
        source: extended.source,
        title: extended.title,
        answer: extended.answer,
        note: extended.note,
        references: extended.references,
      };
    }
  }

  // 4) counting / analytics questions («كم شدة في القرآن», «كم مرة ذكرت كلمة الله»)
  //    Computed from quran.json — NOT gated on tafsir `groups` (§1/§3).
  {
    const analytics = tryAnalytics(
      normQuery,
      getQuranAnalyticsEntries(),
      getAnalyticsSurahLookup(),
      replyLang,
    );
    if (analytics) {
      if (analytics.kind === 'clarify') {
        return { kind: 'clarify', answer: analytics.answer };
      }
      return {
        kind: 'answer',
        source: 'analytics',
        title: analytics.title,
        answer: analytics.answer,
        note: analytics.note,
        stats: analytics.stats,
        references: analytics.references,
      };
    }
  }

  // 5) direct surah / ayah reference
  const byRef = groups ? searchByReference(normQuery, replyLang) : null;
  if (byRef) return byRef;

  // 6) scored Q&A match
  const qa = searchQa(normQuery, tokens);
  if (qa) return qa;

  // 7) keyword search across the tafseer text
  const byKeywords = groups
    ? searchTafseerKeywords(normQuery, tokens, replyLang)
    : null;
  if (byKeywords) return byKeywords;

  // 8) honest fallback — never invent an answer
  return {
    kind: 'fallback',
    answer:
      replyLang === 'ar'
        ? 'عذرًا، لم أجد إجابة في البيانات المتوفرة لديّ. جرّب ذكر اسم السورة أو رقم الآية (مثال: «تفسير سورة الفاتحة» أو «البقرة آية ١٥٣»)، أو أعد صياغة سؤالك.'
        : 'I could not find an answer in the provided data. Try mentioning a surah name or an ayah number (e.g. "Tafsir of Surah Al-Fatihah" or "Al-Baqarah ayah 153"), or rephrase your question.',
  };
}
