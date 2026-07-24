import type {
  TafseerGroup,
  TafsirLoadError,
  TafsirSourceId,
} from '../types/data.types';
import { adaptBySource, type AdaptStats } from './tafsirAdapters';
import {
  ALL_TAFSIR_SOURCE_IDS,
  DEFAULT_TAFSIR_SOURCE,
  normalizeSourceList,
} from './tafsirSources';

// LAZY requires (not top-level imports): the tafsir datasets are very large
// (As-Sa'di ~10 MB, Ibn Kathir ~90 MB, Al-Tabari ~63 MB). Metro still bundles
// each literal require for full offline use, but the JSON is only PARSED into
// memory the first time its source is actually requested — so selecting a
// single source never pays the cost of the other two. See docs/MULTI_TAFSIR_
// CHATBOT.md (Performance) for the production chunking path if bundle size
// becomes a problem on a given target.
/* eslint-disable @typescript-eslint/no-var-requires */
const RAW_LOADERS: Record<TafsirSourceId, () => unknown> = {
  al_saadi: () => require('../data/tafseer_saadi.json'),
  ibn_kathir: () => require('../data/tafseer_ibn_kathir.json'),
  al_tabari: () => require('../data/tafseer_tabari.json'),
};
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * ============================================================
 *  Multi-source tafsir loader.
 *
 *  Each source is adapted + validated + cached SEPARATELY and lazily, so:
 *    - a source is parsed at most once per app session,
 *    - loading one source never re-parses the others,
 *    - a missing/malformed source fails in isolation (typed error) while
 *      every other source keeps working,
 *    - the raw ~9 MB As-Sa'di JSON is only walked when first needed.
 *
 *  Backward compatibility: the original `loadTafseerData()` (no args) still
 *  resolves to the As-Sa'di groups exactly as before, so every existing
 *  caller keeps its current behavior until it opts into source selection.
 * ============================================================
 */

/** Parse a source's raw JSON on demand (may throw if the file is broken). */
function loadRaw(source: TafsirSourceId): unknown {
  const loader = RAW_LOADERS[source];
  if (!loader) throw new Error(`لا توجد بيانات لهذا المصدر (${source}).`);
  return loader();
}

interface SourceCache {
  groups: TafseerGroup[];
  stats: AdaptStats;
}

/** Per-source memoized adapt result (built once, on first request). */
const cache = new Map<TafsirSourceId, Promise<SourceCache>>();

/** Adapt+validate a single source, memoized. Rejects with a typed error. */
function loadSource(source: TafsirSourceId): Promise<SourceCache> {
  const existing = cache.get(source);
  if (existing) return existing;

  const promise = new Promise<SourceCache>((resolve, reject) => {
    try {
      const raw = loadRaw(source);
      const { groups, stats } = adaptBySource(raw, source);
      if (__DEV__ && (stats.invalid > 0 || stats.duplicates > 0)) {
        // Surface data-quality problems in development only.
        // eslint-disable-next-line no-console
        console.warn(
          `[tafsir:${source}] kept ${stats.valid}/${stats.total} records ` +
            `(${stats.invalid} invalid, ${stats.duplicates} duplicate).` +
            (stats.sampleIssues.length ? ` e.g. ${stats.sampleIssues[0]}` : ''),
        );
      }
      resolve({ groups, stats });
    } catch (err) {
      cache.delete(source); // allow a retry on the next call
      const error: TafsirLoadError = {
        source,
        message: err instanceof Error ? err.message : String(err),
      };
      reject(error);
    }
  });

  cache.set(source, promise);
  return promise;
}

/** Groups for one source, or [] if that single source fails to load. */
async function safeSourceGroups(source: TafsirSourceId): Promise<TafseerGroup[]> {
  try {
    return (await loadSource(source)).groups;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface LoadTafseerOptions {
  /** Which sources to load. Defaults to As-Sa'di only (legacy behavior). */
  sources?: TafsirSourceId[];
}

/**
 * Loads and merges the requested tafsir sources into one flat array.
 *
 * Default (no options / no `sources`) resolves to As-Sa'di only — this
 * preserves the exact behavior every existing caller relied on before
 * source selection existed. A failing source is skipped (its groups are
 * simply absent) rather than rejecting the whole load, so one bad file can
 * never crash the assistant.
 */
export function loadTafseerData(
  options?: LoadTafseerOptions,
): Promise<TafseerGroup[]> {
  const requested = options?.sources
    ? normalizeSourceList(options.sources)
    : [DEFAULT_TAFSIR_SOURCE];
  const sources = requested.length > 0 ? requested : [DEFAULT_TAFSIR_SOURCE];

  return Promise.all(sources.map(safeSourceGroups)).then((lists) =>
    lists.flat(),
  );
}

/** As-Sa'di groups (تفسير السعدي). */
export function loadSaadiData(): Promise<TafseerGroup[]> {
  return safeSourceGroups('al_saadi');
}

/** Ibn Kathir groups (تفسير ابن كثير). */
export function loadIbnKathirData(): Promise<TafseerGroup[]> {
  return safeSourceGroups('ibn_kathir');
}

/** Al-Tabari groups (تفسير الطبري). */
export function loadTabariData(): Promise<TafseerGroup[]> {
  return safeSourceGroups('al_tabari');
}

/**
 * Loads several sources but keeps them SEPARATED by source id, and reports
 * which ones failed. Search/comparison uses this so it can build per-source
 * indexes and answer honestly when a requested source is unavailable.
 */
export interface SelectedTafsirData {
  /** Successfully loaded groups, keyed by source id (order = request order). */
  bySource: Map<TafsirSourceId, TafseerGroup[]>;
  /** Sources that failed to load (typed errors) — never silently dropped. */
  errors: TafsirLoadError[];
}

export async function loadSelectedTafsirData(
  sources: TafsirSourceId[],
): Promise<SelectedTafsirData> {
  const list = normalizeSourceList(sources);
  const ids = list.length > 0 ? list : [DEFAULT_TAFSIR_SOURCE];

  const bySource = new Map<TafsirSourceId, TafseerGroup[]>();
  const errors: TafsirLoadError[] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const { groups } = await loadSource(id);
        bySource.set(id, groups);
      } catch (err) {
        const e = err as TafsirLoadError;
        errors.push(
          e && e.source
            ? e
            : { source: id, message: err instanceof Error ? err.message : String(err) },
        );
        bySource.set(id, []); // keep the key so callers know it was requested
      }
    }),
  );

  return { bySource, errors };
}

/* ------------------------------------------------------------------ */
/* Synchronous access (for the retrieval pipeline)                     */
/*                                                                     */
/* The tafsir JSON is bundled and parsed by adaptBySource() without any */
/* I/O, so a synchronous, memoized accessor is safe. searchAnswer() is  */
/* synchronous; this lets it pull per-source groups on demand without   */
/* threading promises through the whole engine.                         */
/* ------------------------------------------------------------------ */

const syncCache = new Map<TafsirSourceId, TafseerGroup[]>();
/** Sources whose sync adaptation failed hard (root not an array, etc.). */
const syncFailed = new Set<TafsirSourceId>();

/** Adapted groups for one source, memoized synchronously ([] on failure). */
export function getSourceGroupsSync(source: TafsirSourceId): TafseerGroup[] {
  const cached = syncCache.get(source);
  if (cached) return cached;
  try {
    const raw = loadRaw(source);
    const { groups, stats } = adaptBySource(raw, source);
    // A non-array root yields 0 groups AND a root-level issue → treat as a
    // hard load failure so callers can say "couldn't load" vs "no match".
    if (!Array.isArray(raw)) syncFailed.add(source);
    void stats;
    syncCache.set(source, groups);
    return groups;
  } catch {
    syncFailed.add(source);
    syncCache.set(source, []);
    return [];
  }
}

/** True when a source failed to load (as opposed to loading an empty set). */
export function didSourceFailSync(source: TafsirSourceId): boolean {
  // Ensure we've attempted a load so the flag is meaningful.
  getSourceGroupsSync(source);
  return syncFailed.has(source);
}

/** Adapter statistics for every source (used by dev/validation tooling). */
export async function getAllTafsirStats(): Promise<AdaptStats[]> {
  const out: AdaptStats[] = [];
  for (const id of ALL_TAFSIR_SOURCE_IDS) {
    try {
      out.push((await loadSource(id)).stats);
    } catch (err) {
      const e = err as TafsirLoadError;
      out.push({
        source: id,
        total: 0,
        valid: 0,
        invalid: 0,
        duplicates: 0,
        sampleIssues: [e?.message ?? 'load failed'],
      });
    }
  }
  return out;
}
