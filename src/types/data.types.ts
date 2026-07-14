/**
 * Data model for the retrieval-based chatbot.
 * All answers come exclusively from these local data structures —
 * there is NO generative AI and NO external API anywhere in this app.
 */

/** A reference attached to an answer (e.g. a Quran verse). */
export interface AnswerReference {
  type: 'quran' | 'hadith' | 'book' | 'other';
  /** Surah name (or source title for non-Quran references). */
  surah: string;
  /** Ayah number or range, e.g. "153" or "1–7". */
  ayah: string;
  /** The referenced text itself (verse text, quote, …). */
  text: string;
}

/** One curated Q&A entry in src/data/chatbotData.json. */
export interface ChatbotEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  references: AnswerReference[];
  language: 'ar' | 'en';
}

/** A single ayah inside a tafseer group. */
export interface TafseerAyah {
  number: number;
  text: string;
}

/** One grouped entry of Tafseer As-Sa'di (src/data/tafseer_saadi.json). */
export interface TafseerGroup {
  surah: number;
  surah_name: string;
  surah_transliteration: string;
  surah_type: 'meccan' | 'medinan' | string;
  ayah_start: number;
  ayah_end: number;
  ayahs: TafseerAyah[];
  ayah_text: string;
  explanation: string;
}

export type DataStatus = 'loading' | 'ready' | 'error';

/**
 * src/data/wordMeanings.json — curated word → meaning lookup, keyed by the
 * normalized Arabic word (see utils/textNormalizer#normalizeText). Empty
 * today; word-meaning questions fall back to searching the tafsir text
 * until this is populated.
 */
export type WordMeaningsMap = Record<string, string>;

/**
 * src/data/quranTopics.json — curated topic → ayah references, keyed by
 * the normalized topic/keyword. Empty today; topic questions fall back
 * to searching ayah + tafsir text until this is populated.
 */
export type QuranTopicsMap = Record<string, { surah: number; ayah: number }[]>;
