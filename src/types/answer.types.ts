import type { MessageStats } from './chat.types';
import type { TafsirSourceId } from './data.types';

/**
 * Unified answer shape produced by src/utils/answerBuilder.ts. Every
 * chatbot answer — whatever local system produced it (Q&A, tafsir
 * search, Quran analytics, surah metadata, …) — is normalized into
 * this one shape before it reaches the UI, so the chat always renders
 * a consistent, source-labeled structure:
 *
 *   1. summary            — short, direct answer
 *   2. quranReferences[]  — related ayahs, labeled "القرآن الكريم"
 *   3. tafsirReferences[] — tafsir excerpt(s), labeled "تفسير السعدي"
 *   4. sources[]          — badges naming where the answer came from
 *   5. safetyNote         — shown for fatwa/ruling questions
 */

/** One labeled source badge shown on an answer (never mixes Quran/tafsir without a label). */
export interface AnswerSource {
  /** Human-readable label, e.g. "القرآن الكريم" or "تفسير السعدي". */
  label: string;
  type: 'quran' | 'tafsir' | 'qa' | 'analytics' | 'metadata' | 'other';
}

/** A Quran ayah cited in support of an answer — always labeled "القرآن الكريم". */
export interface QuranReference {
  surah: string;
  ayah: string;
  text: string;
}

/**
 * A tafsir excerpt cited in support of an answer. Each card is labeled with
 * its OWN source (السعدي / ابن كثير / الطبري) — the app now shows one card
 * per source, so a single answer can carry several without ever merging one
 * scholar's words into another's.
 */
export interface TafsirReference {
  surah: string;
  ayah: string;
  /** Short, safe preview (see answerBuilder#excerptOf). */
  excerpt: string;
  /** Full Arabic source name for this card, e.g. «تفسير ابن كثير». */
  sourceLabel?: string;
  /** Stable source id, so the UI can key/badge cards per source. */
  sourceId?: import('./data.types').TafsirSourceId;
  /** The complete verbatim tafsir text, revealed on "عرض النص كاملًا". */
  fullText?: string;
  /** True when this source was requested but has no matching passage. */
  notFound?: boolean;
}

/**
 * One tafsir passage to display, fully structured (never a pre-joined string).
 * `explanation` is the complete verbatim text; `excerpt` is the collapsed
 * preview. The two are kept separate so the card can expand without re-deriving
 * anything and the full text is never lost.
 */
export interface TafsirDisplayItem {
  source: TafsirSourceId;
  /** Human label, e.g. «تفسير السعدي» — never the raw id. */
  sourceArabic: string;
  surahNumber: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  /** Full, verbatim tafsir text (never summarized). */
  explanation: string;
  /** Word-safe collapsed preview (see createArabicExcerpt). */
  excerpt: string;
  /**
   * When this source's commentary originally covers a WIDER range than the
   * requested/displayed scope, its real range — so the card can show an honest
   * "this source discusses verses X–Y together" note.
   */
  sourceCoversStart?: number;
  sourceCoversEnd?: number;
}

/**
 * All passages of ONE tafsir source, grouped under a single source card. A
 * source that was requested but has no matching passage is represented with
 * `notFound: true` and an empty `passages` array, so the UI can show an honest
 * notice instead of dropping the source or substituting another.
 */
export interface TafsirSourceGroup {
  source: TafsirSourceId;
  sourceArabic: string;
  surahName: string;
  passages: TafsirDisplayItem[];
  notFound?: boolean;
  /**
   * The passage exists but could not be fetched (offline / timeout / backend
   * not configured). Kept separate from `notFound` so the card never tells the
   * reader a passage is absent when it is merely unreachable.
   */
  unavailable?: boolean;
}

/**
 * The «شرح المساعد» section shown BELOW the tafsir cards. This app has no
 * generative-AI backend, so this is a DETERMINISTIC, extractive summary built
 * only from the displayed tafsir texts (see answerBuilder#buildAssistantExplanation)
 * — never model knowledge, never a fabricated scholarly conclusion.
 */
export interface TafsirAssistantExplanation {
  title: 'شرح المساعد';
  text: string;
  /** Exactly the sources whose text was shown in this same answer. */
  basedOnSources: TafsirSourceId[];
  /** Always true here — flags that the text is extracted, not AI-generated. */
  extractive: true;
}

/**
 * Structured multi-tafsir answer (kept as a named type for callers/storage);
 * the live `ChatAnswer` carries the same data via `tafsirGroups`,
 * `assistantExplanation`, and `missingSources`.
 */
export interface MultiTafsirAnswer {
  type: 'multi_tafsir';
  sectionTitle: 'التفاسير';
  items: TafsirDisplayItem[];
  assistantExplanation?: TafsirAssistantExplanation;
  missingSources?: TafsirSourceId[];
}

/**
 * How much to trust an answer:
 * - 'high'   exact/curated match (Q&A entry, direct surah/ayah reference, structured metadata)
 * - 'medium' found via automatic search (keyword/phrase match, statistics)
 * - 'low'    fallback, clarification, or safety-referral — no verified answer given
 */
export type SafetyLevel = 'high' | 'medium' | 'low';

export interface ChatAnswer {
  title?: string;
  summary: string;
  quranReferences: QuranReference[];
  tafsirReferences: TafsirReference[];
  /**
   * Multi-source tafsir results, grouped and ordered by source
   * (السعدي → ابن كثير → الطبري). Present for multi-tafsir answers; the UI
   * renders one card per group. Older/other answers leave this undefined and
   * keep using `tafsirReferences`, so nothing legacy breaks.
   */
  tafsirGroups?: TafsirSourceGroup[];
  /**
   * The «شرح المساعد» section, generated deterministically from ONLY the
   * displayed tafsir texts. Undefined for non-tafsir / legacy answers.
   */
  assistantExplanation?: TafsirAssistantExplanation;
  /** Requested sources that had no matching passage (shown as notices). */
  missingSources?: TafsirSourceId[];
  sources: AnswerSource[];
  safetyNote?: string;
  confidence: SafetyLevel;
  /**
   * Optional analytics bar-chart payload (word/letter/ayah counts,
   * comparisons, …). Kept as a pass-through field so existing analytics
   * answers keep rendering exactly as before.
   */
  stats?: MessageStats;
}

export const QURAN_SOURCE_LABEL = 'القرآن الكريم';

/**
 * @deprecated Answers can now carry several tafsir sources at once, so a
 * single global label is no longer meaningful. Kept only so any older caller
 * still compiles; new code must derive the label from each passage's source
 * via `sourceArabicName()` in src/utils/tafsirSources.ts. Its value is the
 * default source's name for backward-compatible behavior.
 */
export const TAFSIR_SOURCE_LABEL = 'تفسير السعدي';
