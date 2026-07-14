import type { AnswerReference } from './data.types';
import type { AnswerSource as AnswerSourceBadge, QuranReference, SafetyLevel, TafsirReference } from './answer.types';

export type MessageRole = 'user' | 'bot';

/**
 * The kind of bot answer — used for styling and transparency:
 * every bot message tells the user *where* the answer came from.
 */
export type AnswerSource =
  | 'tafseer'
  | 'qa'
  | 'analytics'
  | 'metadata'
  | 'fallback'
  | 'clarify'
  | 'notice';

/** Small bar-chart payload attached to analytics answers. */
export interface MessageStats {
  title: string;
  items: { label: string; value: number }[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Optional title rendered above the body (e.g. "تفسير سورة الفاتحة ١–٧"). */
  title?: string;
  text: string;
  references?: AnswerReference[];
  /** Small footnote under the answer, e.g. "مطابقة بالكلمات المفتاحية". */
  note?: string;
  stats?: MessageStats;
  source?: AnswerSource;
  timestamp: number;

  // ---- unified answer builder fields (see src/utils/answerBuilder.ts) ----
  /** Related Quran ayahs, always rendered under the "القرآن الكريم" label. */
  quranReferences?: QuranReference[];
  /** Tafsir excerpt(s), always rendered under the "تفسير السعدي" label. */
  tafsirReferences?: TafsirReference[];
  /** Source badges shown on the answer (never mixes Quran/tafsir without one). */
  answerSources?: AnswerSourceBadge[];
  /** Distinct safety-referral note (e.g. the fatwa notice) — separate from `note`. */
  safetyNote?: string;
  /** How the answer was found — exact/curated is 'high', automatic search is 'medium', fallback is 'low'. */
  confidence?: SafetyLevel;
}

export type AppLanguage = 'ar' | 'en';
