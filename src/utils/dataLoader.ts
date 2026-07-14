import tafseerRaw from '../data/tafseer_saadi.json';
import type { TafseerGroup } from '../types/data.types';

/**
 * Loads the tafseer dataset (src/data/tafseer_saadi.json, ~9 MB).
 * Bundled directly with the app so it works fully offline in Expo Go —
 * no network fetch, no dev server dependency. Validated and cached in
 * memory once per app session.
 */

let cache: Promise<TafseerGroup[]> | null = null;

function isValidGroup(g: unknown): g is TafseerGroup {
  if (typeof g !== 'object' || g === null) return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o.surah === 'number' &&
    typeof o.surah_name === 'string' &&
    typeof o.ayah_start === 'number' &&
    typeof o.ayah_end === 'number' &&
    typeof o.ayah_text === 'string' &&
    typeof o.explanation === 'string'
  );
}

export function loadTafseerData(): Promise<TafseerGroup[]> {
  if (!cache) {
    cache = new Promise<TafseerGroup[]>((resolve, reject) => {
      try {
        if (!Array.isArray(tafseerRaw)) throw new Error('Dataset is not an array');
        // Drop malformed entries instead of crashing the whole app.
        resolve(tafseerRaw.filter(isValidGroup));
      } catch (err) {
        cache = null; // allow retry on next call
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  return cache;
}
