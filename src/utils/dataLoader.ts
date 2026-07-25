import type { TafseerGroup, TafsirSourceId } from '../types/data.types';
import { normalizeSourceList } from './tafsirSources';

/**
 * ============================================================
 *  Tafsir data access.
 *
 *  THE THREE TAFSIR JSON FILES ARE NO LONGER BUNDLED.
 *
 *  They were ~163 MB (As-Sa'di 10 MB, Ibn Kathir 90 MB, Tabari 63 MB) and,
 *  although the previous version required() them lazily, Metro still resolved
 *  and bundled every literal require — so the whole corpus sat in the JS
 *  bundle and Metro eventually died rebundling it:
 *
 *      FATAL ERROR: Reached heap limit Allocation failed
 *      - JavaScript heap out of memory
 *
 *  The text now lives in Cloud Firestore, fetched per passage by document id.
 *  What stays in the bundle is small and derived:
 *
 *    src/data/tafsir-index/{source}.manifest.json   ayah -> content id (~310 KB)
 *    src/data/tafsir-index/saadi.search.json        keyword index    (~2.9 MB)
 *
 *  See src/utils/tafsir/tafsirManifest.ts (resolution),
 *      src/services/tafsirRemote.ts       (fetch + cache),
 *      src/utils/tafsir/saadiSearchIndex.ts (keyword search),
 *      docs/FIREBASE_TAFSIR_IMPORT.md     (how the corpus got there).
 *
 *  This module is kept as a thin, honest shim rather than deleted, because
 *  several callers still ask for "the local groups". They now get an empty
 *  array — which every one of them already handled, since a failing source
 *  always produced [] before.
 * ============================================================
 */

export interface LoadTafseerOptions {
  /** Retained for source compatibility; no source is loaded locally any more. */
  sources?: TafsirSourceId[];
}

/**
 * Formerly returned the bundled As-Sa'di groups. Now always resolves to an
 * empty array: no tafsir text ships with the app.
 *
 * Callers that need passages must go through the pre-fetch path in
 * useAssistant (plan -> contentIdsFor -> fetchPassages -> inject). Callers that
 * only needed the array to build a keyword index should use
 * src/utils/tafsir/saadiSearchIndex.ts instead.
 */
export function loadTafseerData(options?: LoadTafseerOptions): Promise<TafseerGroup[]> {
  void normalizeSourceList(options?.sources ?? []);
  return Promise.resolve([]);
}

/**
 * Adapted groups for one source. Always [] — the corpus is remote.
 *
 * Crucially this does NOT report a load failure. Reporting one would make every
 * answer carry «تعذّر تحميل: تفسير ابن كثير», because "no local data" is now the
 * normal, expected state rather than an error. Genuine fetch failures are
 * reported by the injection layer, which can tell them apart from a source that
 * simply has no passage for the requested ayah.
 */
export function getSourceGroupsSync(source: TafsirSourceId): TafseerGroup[] {
  void source;
  return [];
}

/** Always false: absence of local data is not a failure. See above. */
export function didSourceFailSync(source: TafsirSourceId): boolean {
  void source;
  return false;
}
