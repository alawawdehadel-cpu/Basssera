import type { TafsirSourceId } from '../../types/data.types';
import type { QuestionIntent } from '../../types/intent.types';
import { ALL_TAFSIR_SOURCE_IDS, resolveRequestedTafsirSources } from '../tafsirSources';
import {
  analyzeTafsirQuestion,
  type TafsirConversationContext,
  type TafsirQuestionAnalysis,
} from './tafsirQuestionAnalyzer';

/**
 * ============================================================
 *  Decides — once — whether a question is a tafsir-passage request, and if so
 *  which surah/ayah(s) from which source(s).
 *
 *  Extracted from chatbotSearch.handleMultiSourceTafsir so that the code which
 *  PRE-FETCHES passages over the network and the code which ANSWERS from them
 *  make the identical decision. Duplicating this gate would guarantee eventual
 *  drift: it is subtle (intent shape, explicit-source override, the tafsir cue
 *  regex, the whole-surah carve-out) and a mismatch would show as "the app
 *  fetched Ibn Kathir but answered without it".
 *
 *  Pure and synchronous. Touches no dataset and no network — the analyzer it
 *  calls resolves references against the bundled quran.json only.
 * ============================================================
 */

/** Concrete "tafsir passage" intents the multi-source engine can answer. */
export const TAFSIR_PASSAGE_INTENTS: ReadonlySet<TafsirQuestionAnalysis['intent']> = new Set([
  'exact_ayah',
  'ayah_range',
  'named_ayah',
  'quran_phrase',
  'compare_tafsir',
  'surah_tafsir',
  'follow_up',
]);

export type TafsirPlan =
  /** Not a tafsir-passage question — the existing pipeline handles it unchanged. */
  | { kind: 'skip' }
  /** The reference could not be pinned down safely; ask rather than guess. */
  | { kind: 'clarify'; analysis: TafsirQuestionAnalysis }
  /** Retrieve these sources for this resolved reference. */
  | {
      kind: 'retrieve';
      analysis: TafsirQuestionAnalysis;
      /** Non-null surah, guaranteed by construction. */
      surahNumber: number;
      ayahStart: number | null;
      ayahEnd: number | null;
      sources: TafsirSourceId[];
      comparison: boolean;
    };

export interface PlanInput {
  selectedSources?: TafsirSourceId[];
  compare?: boolean;
  conversationContext?: TafsirConversationContext | null;
}

/**
 * The question plainly asks for tafsir, even when detectIntent() did not tag it
 * TAFSIR_EXPLANATION — that regex only fires on «ما تفسير …» or whole-word
 * «اشرح|فسر», so a bare «تفسير سورة الفاتحة» arrives as GENERAL_TAFSIR_SEARCH.
 * Without this cue such a question fell through to the single-source path and
 * answered from As-Sa'di alone (observed and fixed). A pure navigation phrase
 * like «افتح سورة الفاتحة» carries no cue and is still left alone.
 */
const TAFSIR_CUE_RE = /تفسير|(^|\s)(فسر|اشرح|شرح|وضح)(\s|$)/;

export function hasTafsirCue(normalizedText: string): boolean {
  return TAFSIR_CUE_RE.test(normalizedText);
}

/**
 * Classifies a question into a TafsirPlan.
 *
 * @param rawQuery       the sanitized question TEXT THAT WILL BE ANSWERED.
 *                       For a hadith-led turn the assistant rewrites the query
 *                       before answering, so callers must pass the same string
 *                       they will hand to searchAnswer — not the raw input.
 * @param detectedIntent result of detectIntent() on that same string.
 */
export function planTafsirPassage(
  rawQuery: string,
  detectedIntent: QuestionIntent,
  input?: PlanInput,
): TafsirPlan {
  const analysis = analyzeTafsirQuestion(rawQuery, input?.conversationContext ?? null);

  const tafsirShaped =
    detectedIntent === 'TAFSIR_EXPLANATION' || detectedIntent === 'GENERAL_TAFSIR_SEARCH';

  const explicit =
    analysis.requestedSources.length > 0 ||
    analysis.compareSources ||
    !!analysis.namedAyah ||
    !!analysis.quotedPhrase;

  const cue = hasTafsirCue(analysis.normalizedText);

  if (!tafsirShaped && !explicit) return { kind: 'skip' };
  if (!TAFSIR_PASSAGE_INTENTS.has(analysis.intent)) return { kind: 'skip' };

  // Clarifications the analyzer already decided on. Only the missing-surah case
  // is gated on an explicit tafsir trigger, so a stray number elsewhere never
  // forces a prompt.
  if (analysis.needsClarification) {
    if (
      analysis.clarificationReason === 'missing_surah' &&
      detectedIntent !== 'TAFSIR_EXPLANATION'
    ) {
      return { kind: 'skip' };
    }
    return { kind: 'clarify', analysis };
  }

  // A whole-surah tafsir with no explicit trigger / cue / source / comparison is
  // left to the existing pipeline (preserves «افتح سورة …» behaviour).
  if (
    analysis.intent === 'surah_tafsir' &&
    detectedIntent !== 'TAFSIR_EXPLANATION' &&
    !explicit &&
    !cue
  ) {
    return { kind: 'skip' };
  }

  if (analysis.surahNumber === null) return { kind: 'skip' };

  const comparison = analysis.compareSources || input?.compare === true;
  let sources = resolveRequestedTafsirSources({
    explicitlyRequestedSources: analysis.requestedSources,
    asksForAllSources: analysis.asksForAllSources,
    uiSelectedSources: input?.selectedSources,
  });
  // "Compare" with only one source resolved is meaningless — widen to all.
  if (comparison && sources.length < 2) sources = [...ALL_TAFSIR_SOURCE_IDS];

  return {
    kind: 'retrieve',
    analysis,
    surahNumber: analysis.surahNumber,
    ayahStart: analysis.ayahStart,
    ayahEnd: analysis.ayahEnd,
    sources,
    comparison,
  };
}

export function buildTafsirContext(
  analysis: TafsirQuestionAnalysis,
  sources: TafsirSourceId[],
  comparison: boolean,
): TafsirConversationContext {
  return {
    lastSurahNumber: analysis.surahNumber,
    lastSurahName: analysis.surahName,
    lastAyahStart: analysis.ayahStart,
    lastAyahEnd: analysis.ayahEnd,
    lastSources: sources,
    lastWasComparison: comparison,
  };
}
