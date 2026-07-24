import type { TranslationKey } from '../i18n/translations';

/**
 * Data model for hadith search (الموسوعة الحديثية — الدرر السنية).
 *
 * The Dorar endpoint returns ONE HTML blob per response rather than
 * structured records, so everything here describes the *parsed* shape
 * produced by src/utils/hadithParser.ts. Hadith text itself is Arabic-only,
 * exactly like the Quran and Tafsir datasets — only the UI chrome is
 * translated.
 */

/**
 * How much weight a muhaddith's ruling carries, derived from free-text.
 *
 * Dorar's "خلاصة حكم المحدث" is prose, not an enum — it ranges from a bare
 * "صحيح" to a whole paragraph discussing a chain. Classification is a
 * heuristic used only to pick a badge; the verbatim ruling is ALWAYS shown
 * next to it so the user reads the muhaddith's own wording.
 */
export type HadithGradeCategory = 'authentic' | 'chain' | 'weak' | 'unknown';

export const GRADE_LABEL_KEYS: Record<HadithGradeCategory, TranslationKey> = {
  authentic: 'hadith.grade.authentic',
  chain: 'hadith.grade.chain',
  weak: 'hadith.grade.weak',
  unknown: 'hadith.grade.unknown',
};

/** One parsed hadith record. Every field except `matn` may be missing upstream. */
export interface HadithResult {
  /** Stable-enough id for list keys: page + index. */
  id: string;
  /** The hadith text, diacritics preserved, with the leading "N - " removed. */
  matn: string;
  /** Substrings Dorar marked as matching the query (from span.search-keys). */
  highlights: string[];
  narrator?: string;
  muhaddith?: string;
  source?: string;
  pageOrNumber?: string;
  /** The muhaddith's ruling, verbatim. */
  gradeText?: string;
  gradeCategory: HadithGradeCategory;
}

/**
 * Dorar's `d[]` filter. Verified live:
 *   1 → صحيح / حسن / ثابت
 *   2 → إسناده صحيح / حسن (chain-level rulings)
 *   3 → ضعيف / باطل / موضوع
 * `all` omits the parameter entirely.
 */
export type HadithDegreeFilter = 'all' | '1' | '2' | '3';

export const DEGREE_FILTER_KEYS: Record<HadithDegreeFilter, TranslationKey> = {
  all: 'hadith.filter.all',
  '1': 'hadith.filter.authentic',
  '2': 'hadith.filter.chain',
  '3': 'hadith.filter.weak',
};

export const DEGREE_FILTERS: readonly HadithDegreeFilter[] = ['all', '1', '2', '3'] as const;

/** Dorar returns a fixed page size. */
export const HADITH_PAGE_SIZE = 15;

export interface HadithSearchParams {
  query: string;
  degree: HadithDegreeFilter;
  /** 1-based. */
  page: number;
}

/** Raw endpoint payload — a single HTML string nested under `ahadith.result`. */
export interface DorarApiResponse {
  ahadith?: {
    result?: string;
  };
}

/** One parsed page of results. */
export interface HadithPage {
  results: HadithResult[];
  /** True when Dorar returned a full page, so another page may exist. */
  hasMore: boolean;
  fetchedAt: number;
}

export type HadithStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'offline';

export const HADITH_CACHE_VERSION = 1;

/** Small LRU of recent searches so repeat queries survive going offline. */
export interface HadithCacheEntry {
  key: string;
  page: HadithPage;
}

export interface HadithCache {
  version: number;
  entries: HadithCacheEntry[];
}

export const HADITH_CACHE_LIMIT = 20;

/** Attribution required by الدرر السنية. */
export const DORAR_SITE_URL = 'https://dorar.net';
