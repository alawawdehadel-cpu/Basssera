/**
 * Data model for the Quran reading section (src/data/quran/quran.json).
 * This dataset is separate from tafseer_saadi.json: quran.json is the
 * ONLY source used to display/search Quran ayahs; tafseer_saadi.json
 * remains exclusively for the tafsir chatbot.
 */

/** One ayah row in src/data/quran/quran.json. */
export interface QuranAyah {
  id: string;
  surahNumber: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  ayahNumber: number;
  /** Uthmani mushaf script — used for on-screen display. */
  textUthmani: string;
  /** Simplified spelling (diacritics removed) — reference only. */
  textSimple: string;
  /** Fully normalized text — used for search matching. */
  textNormalized: string;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean;
}

/** Derived per-surah summary, built once from quran.json. */
export interface SurahListItem {
  number: number;
  nameArabic: string;
  nameEnglish: string;
  ayahCount: number;
  firstPage: number;
}

export type QuranDataStatus = 'loading' | 'ready' | 'error';

export interface QuranValidation {
  valid: boolean;
  count: number;
  expected: number;
}

export interface QuranBookmark {
  /** "<surah>:<ayah>" */
  id: string;
  surahNumber: number;
  ayahNumber: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  createdAt: number;
}

export interface LastReadingPosition {
  surahNumber: number;
  ayahNumber: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  updatedAt: number;
}

/**
 * Data model for the Mushaf (604-page) reader
 * (src/data/quran/mushaf-pages.json).
 *
 * This is deliberately a SEPARATE dataset from quran.json: quran.json
 * only carries an ayah-level `page` number, which is not enough to
 * reproduce the real Madani Mushaf layout (which line each word falls
 * on, line count per page, per-line centering, etc.). Real page/line
 * layout data must come from a trusted source (e.g. the Quran
 * Foundation Page Layout API) — see scripts/fetchMushafLayout.js and
 * src/data/quran/README.md. Nothing in this app invents, guesses, or
 * OCRs this layout.
 */

/** One word positioned on a Mushaf line. */
export interface MushafWord {
  textUthmani: string;
  surahNumber: number;
  ayahNumber: number;
  wordNumber: number;
  /** True for the final word of an ayah — where the ayah-number medallion renders. */
  isAyahEnd?: boolean;
}

/** One physical line of a Mushaf page (a real Madani Mushaf page has 15 lines). */
export interface MushafLine {
  lineNumber: number;
  /** Plain concatenated text for the line (fallback rendering / search). */
  text: string;
  words: MushafWord[];
  /** Surah-name banner line / bismillah line, when the layout source marks one. */
  isSurahHeader?: boolean;
  isBismillah?: boolean;
}

/** One full Mushaf page (604 total in the standard Madani mushaf). */
export interface MushafPage {
  pageNumber: number;
  juz: number;
  /** Arabic surah name(s) appearing on this page. */
  surahs: string[];
  lines: MushafLine[];
}

export const TOTAL_MUSHAF_PAGES = 604;

export type MushafDataStatus = 'missing' | 'partial' | 'ready';

export interface MushafValidation {
  status: MushafDataStatus;
  /** How many of the 604 pages have layout data loaded. */
  pagesLoaded: number;
  expected: number;
}

export type QuranReadingMode = 'mushaf' | 'surah';

export interface LastMushafPosition {
  pageNumber: number;
  updatedAt: number;
}

export interface MushafPageBookmark {
  pageNumber: number;
  createdAt: number;
}
