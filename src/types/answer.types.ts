import type { MessageStats } from './chat.types';

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

/** A tafsir excerpt cited in support of an answer — always labeled "تفسير السعدي". */
export interface TafsirReference {
  surah: string;
  ayah: string;
  excerpt: string;
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
export const TAFSIR_SOURCE_LABEL = 'تفسير السعدي';
