import type { AppLanguage } from '../types/chat.types';
import type {
  AnswerSource,
  ChatAnswer,
  QuranReference,
  SafetyLevel,
  TafsirReference,
} from '../types/answer.types';
import type {
  TafsirAssistantExplanation,
  TafsirSourceGroup,
} from '../types/answer.types';
import { QURAN_SOURCE_LABEL, TAFSIR_SOURCE_LABEL } from '../types/answer.types';
import type { TafsirSearchMatch, TafsirSourceId } from '../types/data.types';
import type { SearchResult } from './chatbotSearch';
import { FATWA_NOTICE_AR, FATWA_NOTICE_EN } from './chatbotSearch';
import { createArabicExcerpt, extractiveExcerpt } from './tafsir/tafsirExcerpt';
import { sourceShortName, TAFSIR_DISPLAY_ORDER } from './tafsirSources';

/**
 * ============================================================
 *  Unified answer builder — every chatbot answer, whichever local
 *  system produced it (Q&A, tafsir search, Quran analytics, surah
 *  metadata, …), is normalized here into one consistent, source-safe
 *  ChatAnswer shape before it reaches the UI.
 *
 *  Rules enforced here (never in the UI layer):
 *    - Quran text and tafsir text are never mixed without labels.
 *    - Every answer carries explicit source badges.
 *    - Answers built only from automatic search get medium/low confidence.
 *    - No verified data -> an honest, labeled fallback, never a guess.
 *    - Fatwa/ruling questions always carry the required safety note.
 * ============================================================
 */

const NO_SOURCE_FOUND_AR =
  'لم أجد مصدرًا كافيًا داخل بيانات التطبيق للإجابة على هذا السؤال.';
const NO_SOURCE_FOUND_EN =
  'I could not find a sufficient source within the app data to answer this question.';

function isFatwaNotice(text: string | undefined): boolean {
  return text === FATWA_NOTICE_AR || text === FATWA_NOTICE_EN;
}

/** Extracts the Quran ayah(s) cited by a SearchResult (type === 'quran' only — never tafsir text). */
function buildQuranReferences(result: SearchResult): QuranReference[] {
  return (result.references ?? [])
    .filter((r) => r.type === 'quran')
    .map((r) => ({ surah: r.surah, ayah: r.ayah, text: r.text }));
}

/** Short, distinct preview of a tafsir excerpt — kept separate from the full summary text. */
const TAFSIR_EXCERPT_MAX_CHARS = 220;

function excerptOf(text: string): string {
  if (text.length <= TAFSIR_EXCERPT_MAX_CHARS) return text;
  return `${text.slice(0, TAFSIR_EXCERPT_MAX_CHARS).trimEnd()}…`;
}

/**
 * Builds the tafsir excerpt(s) for a SearchResult whose answer text came
 * from Tafseer As-Saʿdi — never applied to Q&A/analytics/metadata answers,
 * which are not tafsir text and must not be labeled as such.
 */
function buildTafsirReferences(result: SearchResult, quranRefs: QuranReference[]): TafsirReference[] {
  if (result.source !== 'tafseer' || !result.answer) return [];
  const anchor = quranRefs[0];
  return [
    {
      surah: anchor?.surah ?? '',
      ayah: anchor?.ayah ?? '',
      excerpt: excerptOf(result.answer),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Multi-source tafsir answers (السعدي / ابن كثير / الطبري)             */
/* ------------------------------------------------------------------ */

/**
 * Groups per-source matches into one card per source, in the fixed display
 * order (السعدي → ابن كثير → الطبري) regardless of retrieval order. Passages
 * of the same source are ordered by ayah and de-duplicated by
 * source+surah+ayahStart+ayahEnd+explanation. A source with only a "not found"
 * marker becomes an empty group flagged `notFound`.
 */
function buildTafsirGroups(matches: TafsirSearchMatch[]): TafsirSourceGroup[] {
  const bySource = new Map<TafsirSourceId, TafsirSourceGroup>();
  const seen = new Set<string>();

  for (const m of matches) {
    let group = bySource.get(m.source);
    if (!group) {
      group = {
        source: m.source,
        sourceArabic: m.sourceArabic,
        surahName: m.surahName,
        passages: [],
        notFound: false,
      };
      bySource.set(m.source, group);
    }

    if (m.notFound) {
      // Only "missing" if the source contributed no real passage at all.
      if (group.passages.length === 0) {
        group.notFound = true;
        // Carry WHY it is missing, so the card can distinguish "this source has
        // no passage here" from "we could not load it".
        if (m.unavailable) group.unavailable = true;
      }
      continue;
    }

    const key = `${m.source}|${m.surahNumber}|${m.ayahStart}|${m.ayahEnd}|${m.explanation}`;
    if (seen.has(key)) continue; // no identical text twice
    seen.add(key);

    group.notFound = false;
    group.unavailable = false;
    group.surahName = m.surahName;
    group.passages.push({
      source: m.source,
      sourceArabic: m.sourceArabic,
      surahNumber: m.surahNumber,
      surahName: m.surahName,
      ayahStart: m.ayahStart,
      ayahEnd: m.ayahEnd,
      explanation: m.explanation,
      excerpt: createArabicExcerpt(m.explanation, 600),
      ...(m.sourceCoversStart !== undefined && m.sourceCoversEnd !== undefined
        ? { sourceCoversStart: m.sourceCoversStart, sourceCoversEnd: m.sourceCoversEnd }
        : {}),
    });
  }

  for (const group of bySource.values()) {
    group.passages.sort((a, b) => a.ayahStart - b.ayahStart || a.ayahEnd - b.ayahEnd);
  }

  // Emit strictly in canonical display order, keeping only sources present.
  return TAFSIR_DISPLAY_ORDER.filter((id) => bySource.has(id)).map(
    (id) => bySource.get(id)!,
  );
}

/**
 * Builds the «شرح المساعد» section DETERMINISTICALLY (this app has no
 * generative-AI backend). It quotes a short, complete opening extract from
 * each DISPLAYED source's text — verbatim, never paraphrased, never using
 * outside knowledge — and lists exactly the sources it drew from. It is
 * explicitly labeled as an extract, not a scholarly conclusion, so it can
 * never be mistaken for an AI-generated fatwa or synthesis.
 */
function buildAssistantExplanation(
  groups: TafsirSourceGroup[],
): TafsirAssistantExplanation | undefined {
  const found = groups.filter((g) => !g.notFound && g.passages.length > 0);
  if (found.length === 0) return undefined;

  const lines = found.map((g) => {
    // First complete sentence(s) of the source's first passage, verbatim.
    const snippet = extractiveExcerpt(g.passages[0].explanation, 200);
    return `• ${g.sourceArabic}: «${snippet}»`;
  });

  const intro =
    found.length > 1
      ? 'هذه خلاصة مستخلَصة حرفيًا من مطالع النصوص المعروضة أعلاه (اقتباس مباشر دون توليد أو إضافة من خارجها):'
      : 'هذه خلاصة مستخلَصة حرفيًا من مطلع النص المعروض أعلاه (اقتباس مباشر دون توليد أو إضافة من خارجه):';

  const basedOnSources = found.map((g) => g.source);
  const basedOnLine = `بناءً على: ${found.map((g) => sourceShortName(g.source)).join('، ')}`;

  return {
    title: 'شرح المساعد',
    text: `${intro}\n\n${lines.join('\n\n')}\n\n${basedOnLine}`,
    basedOnSources,
    extractive: true,
  };
}

/** The cited ayah(s), de-duplicated (a comparison repeats the same ayah). */
function buildMultiQuranReferences(matches: TafsirSearchMatch[]): QuranReference[] {
  const seen = new Set<string>();
  const refs: QuranReference[] = [];
  for (const m of matches) {
    if (m.notFound || !m.ayahText) continue;
    const key = `${m.surahName}|${m.ayahRange}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ surah: m.surahName, ayah: m.ayahRange, text: m.ayahText });
  }
  return refs;
}

/** One tafsir badge per DISTINCT source present in the answer, + a Quran badge. */
function buildMultiSources(
  matches: TafsirSearchMatch[],
  hasQuranRefs: boolean,
): AnswerSource[] {
  const sources: AnswerSource[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.source)) continue;
    seen.add(m.source);
    sources.push({ label: m.sourceArabic, type: 'tafsir' });
  }
  if (hasQuranRefs) sources.push({ label: QURAN_SOURCE_LABEL, type: 'quran' });
  return sources;
}

function buildSources(result: SearchResult, lang: AppLanguage, hasQuranRefs: boolean): AnswerSource[] {
  const sources: AnswerSource[] = [];

  switch (result.source) {
    case 'tafseer':
      sources.push({ label: TAFSIR_SOURCE_LABEL, type: 'tafsir' });
      break;
    case 'qa':
      sources.push({
        label: lang === 'ar' ? 'قاعدة الأسئلة الشائعة' : 'Curated Q&A',
        type: 'qa',
      });
      break;
    case 'analytics':
      sources.push({
        label: lang === 'ar' ? 'إحصاء آلي من نص القرآن' : 'Automated Quran statistics',
        type: 'analytics',
      });
      break;
    case 'metadata':
      sources.push({
        label: lang === 'ar' ? 'بيانات السورة' : 'Surah metadata',
        type: 'metadata',
      });
      break;
    default:
      break;
  }

  // A Quran ayah is quoted -> always label it, even alongside another
  // source (e.g. a tafsir answer that also quotes its ayah).
  if (hasQuranRefs && result.source !== 'analytics') {
    sources.push({ label: QURAN_SOURCE_LABEL, type: 'quran' });
  }

  return sources;
}

/**
 * Confidence reflects how the answer was found, per the app's rules:
 * exact/curated/structured lookups are 'high'; anything resolved purely
 * by automatic keyword/phrase search or statistics is 'medium'; anything
 * short of a real answer (fallback/clarify/fatwa-referral) is 'low'.
 */
function computeConfidence(result: SearchResult): SafetyLevel {
  if (result.kind !== 'answer') return 'low';

  switch (result.source) {
    case 'qa':
    case 'metadata':
      return 'high';
    case 'tafseer':
      // 'direct' = the user unambiguously named a surah/ayah (searchByReference).
      // Everything else (keyword/phrase/topic/meaning search) is 'search' by
      // default — matchType is left unset by quranIntents.ts-derived answers,
      // which is exactly the conservative case we want to fall into here.
      return result.matchType === 'direct' ? 'high' : 'medium';
    case 'analytics':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Turns a SearchResult (from chatbotSearch.ts) into the unified,
 * source-safe ChatAnswer shape the UI renders.
 */
export function buildChatAnswer(result: SearchResult, lang: AppLanguage): ChatAnswer {
  // Fatwa/ruling questions: never a real answer, always the safety referral.
  if (isFatwaNotice(result.answer)) {
    return {
      summary: result.answer ?? (lang === 'ar' ? FATWA_NOTICE_AR : FATWA_NOTICE_EN),
      quranReferences: [],
      tafsirReferences: [],
      sources: [],
      safetyNote: lang === 'ar' ? FATWA_NOTICE_AR : FATWA_NOTICE_EN,
      confidence: 'low',
    };
  }

  // Multi-source tafsir answer: one labeled card per source (السعدي / ابن
  // كثير / الطبري), never merged. `answer` is the short header; the cards
  // carry each source's verbatim text (collapsed in the UI).
  if (result.tafsirMatches && result.tafsirMatches.length > 0) {
    const quranReferences = buildMultiQuranReferences(result.tafsirMatches);
    const tafsirGroups = buildTafsirGroups(result.tafsirMatches);
    const sources = buildMultiSources(result.tafsirMatches, quranReferences.length > 0);
    const assistantExplanation = buildAssistantExplanation(tafsirGroups);
    const missingSources = tafsirGroups
      .filter((g) => g.notFound)
      .map((g) => g.source);
    const baseSummary =
      result.answer ?? (lang === 'ar' ? NO_SOURCE_FOUND_AR : NO_SOURCE_FOUND_EN);
    return {
      title: result.title,
      summary: result.note ? `${baseSummary}\n${result.note}` : baseSummary,
      quranReferences,
      // The grouped, source-titled cards are the multi-tafsir presentation;
      // tafsirReferences stays empty here so the two never double-render.
      tafsirReferences: [],
      tafsirGroups,
      assistantExplanation,
      missingSources: missingSources.length > 0 ? missingSources : undefined,
      sources,
      confidence: computeConfidence(result),
    };
  }

  // No verified data found (dead end / couldn't understand) -> an honest,
  // clearly-labeled fallback. Never fabricate Quran text or tafsir.
  if (result.kind !== 'answer' && !result.answer) {
    return {
      summary: lang === 'ar' ? NO_SOURCE_FOUND_AR : NO_SOURCE_FOUND_EN,
      quranReferences: [],
      tafsirReferences: [],
      sources: [],
      confidence: 'low',
    };
  }

  const quranReferences = buildQuranReferences(result);
  const tafsirReferences = buildTafsirReferences(result, quranReferences);
  const sources = buildSources(result, lang, quranReferences.length > 0);
  const confidence = computeConfidence(result);

  const summary =
    result.answer ?? (lang === 'ar' ? NO_SOURCE_FOUND_AR : NO_SOURCE_FOUND_EN);

  return {
    title: result.title,
    summary,
    quranReferences,
    tafsirReferences,
    sources,
    confidence,
    stats: result.stats,
  };
}
