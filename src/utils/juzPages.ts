import { TOTAL_MUSHAF_PAGES } from '../types/quran.types';
import { getJuzOnMushafPage } from './mushafLayout';

let cache: Map<number, number> | null = null;

/** First mushaf page of each juz (1–30), derived once from the layout data. */
export function getJuzStartPages(): Map<number, number> {
  if (cache) return cache;
  cache = new Map();
  for (let p = 1; p <= TOTAL_MUSHAF_PAGES; p += 1) {
    const j = getJuzOnMushafPage(p);
    if (j && !cache.has(j)) cache.set(j, p);
  }
  return cache;
}
