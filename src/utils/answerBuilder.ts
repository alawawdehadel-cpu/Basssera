import type { AppLanguage } from '../types/chat.types';
import type {
  AnswerSource,
  ChatAnswer,
  QuranReference,
  SafetyLevel,
  TafsirReference,
} from '../types/answer.types';
import { QURAN_SOURCE_LABEL, TAFSIR_SOURCE_LABEL } from '../types/answer.types';
import type { SearchResult } from './chatbotSearch';
import { FATWA_NOTICE_AR, FATWA_NOTICE_EN } from './chatbotSearch';

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
