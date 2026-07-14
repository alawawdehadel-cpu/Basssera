/**
 * Intent classification for incoming chat questions. Classifying the
 * question BEFORE searching lets the chatbot pick the right local
 * system (Quran statistics, tafsir lookup, surah metadata, …) instead
 * of relying purely on an implicit chain of best-effort matchers.
 *
 * This is a pure text classifier — it never touches the Quran/tafsir
 * datasets and never generates an answer itself. See
 * src/utils/intentDetector.ts.
 */
export type QuestionIntent =
  /** «كم شدة في القرآن؟», «كم مرة ذكرت كلمة الله؟» — counting/statistics. */
  | 'QURAN_STATS'
  /** «أين وردت كلمة الصمد؟», «اعرض الآيات التي فيها كلمة الجنة» */
  | 'WORD_LOCATION'
  /** «اشرح آية الكرسي», «ما تفسير الآية 255 من سورة البقرة؟» */
  | 'TAFSIR_EXPLANATION'
  /** «ما معنى الصمد؟», «ماذا تعني كلمة الفلق؟» */
  | 'WORD_MEANING'
  /** «آيات عن الصبر», «هات آيات عن بر الوالدين» */
  | 'TOPIC_AYAHS'
  /** «كم عدد آيات سورة البقرة؟», «هل سورة الكهف مكية أم مدنية؟» */
  | 'SURAH_INFO'
  /** «في أي سورة وردت عبارة ...», «ابحث عن ...» */
  | 'AYAH_SEARCH'
  /** «هل يجوز ...», «ما حكم ...» — never answered directly, only referred. */
  | 'FATWA_SAFETY'
  /** A real, intelligible question that doesn't match any specific pattern above. */
  | 'GENERAL_TAFSIR_SEARCH'
  /** Empty, unintelligible, or otherwise unclassifiable input. */
  | 'UNKNOWN';

export interface IntentDetectionResult {
  intent: QuestionIntent;
  /** The question after normalizeText() — the same normalization used everywhere else. */
  normalizedQuery: string;
  /** False for empty/gibberish input (no recognizable Arabic or Latin letters). */
  isIntelligible: boolean;
}
