import { normalizeText } from './textNormalizer';
import { loadQuranData } from './quranDataLoader';
import type { QuranAyah } from '../types/quran.types';

/**
 * Quran text search — matches the user's query (normalized the same way
 * as the rest of the app) against each ayah's pre-normalized
 * `textNormalized` field. Never touches tafseer_saadi.json.
 */

export const MAX_QURAN_SEARCH_RESULTS = 50;

export async function searchQuran(rawQuery: string): Promise<QuranAyah[]> {
  const query = normalizeText(rawQuery);
  if (query.length < 2) return [];

  const ayahs = await loadQuranData();
  const results: QuranAyah[] = [];
  for (const a of ayahs) {
    if (a.textNormalized.includes(query)) {
      results.push(a);
      if (results.length >= MAX_QURAN_SEARCH_RESULTS) break;
    }
  }
  return results;
}
