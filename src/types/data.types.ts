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

/* ------------------------------------------------------------------ */
/* Multi-source tafsir model                                           */
/*                                                                     */
/* The app now bundles up to three tafsir sources side by side. Every  */
/* record is normalized into the SAME TafseerGroup shape by the        */
/* per-source adapters (src/utils/tafsirAdapters.ts), tagged with its  */
/* `source` so answers can be labeled and compared without ever mixing */
/* one scholar's words into another's.                                 */
/* ------------------------------------------------------------------ */

/** Stable identifier for a bundled tafsir source. */
export type TafsirSourceId = 'al_saadi' | 'ibn_kathir' | 'al_tabari';

/** Display metadata for a tafsir source (Arabic-first, RTL). */
export interface TafsirSourceInfo {
  id: TafsirSourceId;
  /** Full Arabic name, e.g. «تفسير السعدي». */
  arabicName: string;
  /** Short Arabic label for badges/chips, e.g. «السعدي». */
  shortArabicName: string;
}

/**
 * One grouped tafsir passage, normalized across all sources.
 *
 * As-Sa'di records (src/data/tafseer_saadi.json) already match this shape;
 * Ibn Kathir / Al-Tabari records are mapped into it by their adapters. The
 * two extra fields (`source`, `source_name_ar`) are what let a single answer
 * carry, label, and compare passages from more than one source.
 *
 * NOTE: the two source fields are optional at the type level so that legacy
 * callers and the raw As-Sa'di JSON (which predates them) still satisfy the
 * type; the loader/adapters always populate them at runtime.
 */
export interface TafseerGroup {
  /** Which tafsir this passage belongs to. Absent only on raw legacy records. */
  source?: TafsirSourceId;
  /** The source's full Arabic name, denormalized for convenient labeling. */
  source_name_ar?: string;

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

/** A single retrieved tafsir passage for one source, as returned by search. */
export interface TafsirSearchMatch {
  source: TafsirSourceId;
  /** Full Arabic source name, e.g. «تفسير ابن كثير». */
  sourceArabic: string;
  surahNumber: number;
  surahName: string;
  surahTransliteration: string;
  /** Ayah range as a display string, e.g. "255" or "1–5". */
  ayahRange: string;
  ayahStart: number;
  ayahEnd: number;
  /** The verse text the passage explains. */
  ayahText: string;
  /** The full, verbatim tafsir explanation — never summarized here. */
  explanation: string;
  /**
   * True when the source was requested but has no matching passage (e.g. a
   * source whose dataset is missing or does not cover this ayah). The UI
   * shows an honest "not found in this source" card — never another source's
   * text in its place.
   */
  notFound?: boolean;
  /**
   * True when this source DOES have a passage for the ayah (the bundled
   * manifest says so) but its text could not be fetched — offline, timeout, or
   * Firebase not configured.
   *
   * Distinct from `notFound` on purpose. Telling a reader that a passage does
   * not exist, when in fact we merely failed to load it, is a false statement
   * about a scholar's work. The UI must say "could not load", not "not found".
   */
  unavailable?: boolean;
}

/** Typed load failure so one bad/missing source never crashes the assistant. */
export interface TafsirLoadError {
  source: TafsirSourceId;
  message: string;
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
