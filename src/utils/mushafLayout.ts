import mushafPagesRaw from '../data/quran/mushaf-pages.json';
import {
  TOTAL_MUSHAF_PAGES,
  type MushafPage,
  type MushafValidation,
} from '../types/quran.types';

/**
 * Loads and indexes src/data/quran/mushaf-pages.json — real, published
 * page/line layout data for the 604-page Madani Mushaf. See
 * src/data/quran/README.md for why this must be a separate dataset
 * from quran.json, and scripts/fetchMushafLayout.js for how to fill
 * it in from a trusted source.
 *
 * This file ships with mushaf-pages.json empty by default, which is
 * intentional: nothing here invents a layout when the real data is
 * missing. `getMushafPage()` returns null for any page not present,
 * and the UI shows a clear "layout data not added yet" message.
 */

function isValidWord(w: unknown): w is MushafPage['lines'][number]['words'][number] {
  if (typeof w !== 'object' || w === null) return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.textUthmani === 'string' &&
    typeof o.surahNumber === 'number' &&
    typeof o.ayahNumber === 'number' &&
    typeof o.wordNumber === 'number'
  );
}

function isValidLine(l: unknown): l is MushafPage['lines'][number] {
  if (typeof l !== 'object' || l === null) return false;
  const o = l as Record<string, unknown>;
  return (
    typeof o.lineNumber === 'number' &&
    typeof o.text === 'string' &&
    Array.isArray(o.words) &&
    o.words.every(isValidWord)
  );
}

function isValidPage(p: unknown): p is MushafPage {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.pageNumber === 'number' &&
    typeof o.juz === 'number' &&
    Array.isArray(o.surahs) &&
    Array.isArray(o.lines) &&
    o.lines.every(isValidLine)
  );
}

let pageIndex: Map<number, MushafPage> | null = null;

function ensureLoaded(): Map<number, MushafPage> {
  if (pageIndex) return pageIndex;
  const raw = mushafPagesRaw as unknown;
  const arr = Array.isArray(raw) ? raw.filter(isValidPage) : [];
  pageIndex = new Map(arr.map((p) => [p.pageNumber, p]));
  return pageIndex;
}

/** Returns the layout for one Mushaf page, or null if not yet added. */
export function getMushafPage(pageNumber: number): MushafPage | null {
  return ensureLoaded().get(pageNumber) ?? null;
}

/** The Mushaf always has 604 pages — independent of how much layout data is loaded. */
export function getTotalMushafPages(): number {
  return TOTAL_MUSHAF_PAGES;
}

export function getNextPage(pageNumber: number): number | null {
  return pageNumber < TOTAL_MUSHAF_PAGES ? pageNumber + 1 : null;
}

export function getPreviousPage(pageNumber: number): number | null {
  return pageNumber > 1 ? pageNumber - 1 : null;
}

export function getSurahsOnMushafPage(pageNumber: number): string[] {
  return getMushafPage(pageNumber)?.surahs ?? [];
}

export function getJuzOnMushafPage(pageNumber: number): number | null {
  return getMushafPage(pageNumber)?.juz ?? null;
}

/** Finds which Mushaf page a given ayah first appears on, by scanning the loaded layout. */
export function findPageByAyah(surahNumber: number, ayahNumber: number): number | null {
  const index = ensureLoaded();
  for (const page of index.values()) {
    for (const line of page.lines) {
      if (line.words.some((w) => w.surahNumber === surahNumber && w.ayahNumber === ayahNumber)) {
        return page.pageNumber;
      }
    }
  }
  return null;
}

/** Overall readiness of the Mushaf layout dataset. */
export function getMushafValidation(): MushafValidation {
  const index = ensureLoaded();
  const pagesLoaded = index.size;
  return {
    status: pagesLoaded === 0 ? 'missing' : pagesLoaded < TOTAL_MUSHAF_PAGES ? 'partial' : 'ready',
    pagesLoaded,
    expected: TOTAL_MUSHAF_PAGES,
  };
}
