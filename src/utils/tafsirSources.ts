import type { TafsirSourceId, TafsirSourceInfo } from '../types/data.types';

/**
 * ============================================================
 *  Single source of truth for the bundled tafsir sources.
 *
 *  Everything that needs to name, label, order, or iterate the
 *  tafsir sources reads from here — so adding a fourth tafsir later
 *  means editing ONE table (plus its adapter + data file), never
 *  hunting labels across the codebase.
 * ============================================================
 */

/** All bundled sources, in canonical display order (السعدي، ابن كثير، الطبري). */
export const TAFSIR_SOURCES: readonly TafsirSourceInfo[] = [
  { id: 'al_saadi', arabicName: 'تفسير السعدي', shortArabicName: 'السعدي' },
  { id: 'ibn_kathir', arabicName: 'تفسير ابن كثير', shortArabicName: 'ابن كثير' },
  { id: 'al_tabari', arabicName: 'تفسير الطبري', shortArabicName: 'الطبري' },
] as const;

/** The full ordered list of every source id. */
export const ALL_TAFSIR_SOURCE_IDS: readonly TafsirSourceId[] = TAFSIR_SOURCES.map(
  (s) => s.id,
);

/** The default single source used when nothing is selected and none is named. */
export const DEFAULT_TAFSIR_SOURCE: TafsirSourceId = 'al_saadi';

/**
 * The ONE canonical order tafsir results are always displayed in, regardless
 * of the order the search/UI produced them: السعدي → ابن كثير → الطبري.
 * (Same values as ALL_TAFSIR_SOURCE_IDS; named separately so display code can
 * reference intent explicitly.)
 */
export const TAFSIR_DISPLAY_ORDER: readonly TafsirSourceId[] = [
  'al_saadi',
  'ibn_kathir',
  'al_tabari',
] as const;

const BY_ID: Record<TafsirSourceId, TafsirSourceInfo> = TAFSIR_SOURCES.reduce(
  (acc, info) => {
    acc[info.id] = info;
    return acc;
  },
  {} as Record<TafsirSourceId, TafsirSourceInfo>,
);

/** Metadata for a source id (never throws — returns a safe fallback label). */
export function sourceInfo(id: TafsirSourceId): TafsirSourceInfo {
  return BY_ID[id] ?? { id, arabicName: id, shortArabicName: id };
}

/** Full Arabic name for a source id, e.g. «تفسير ابن كثير». */
export function sourceArabicName(id: TafsirSourceId): string {
  return sourceInfo(id).arabicName;
}

/** Short Arabic label for a source id, e.g. «ابن كثير». */
export function sourceShortName(id: TafsirSourceId): string {
  return sourceInfo(id).shortArabicName;
}

/** True when `id` is a known source. */
export function isTafsirSourceId(id: string): id is TafsirSourceId {
  return id in BY_ID;
}

/**
 * De-duplicates and re-orders a list of source ids into canonical order,
 * dropping unknowns. Used everywhere a caller hands us "requested sources"
 * so downstream code always sees a clean, stable list.
 */
export function normalizeSourceList(
  ids: readonly TafsirSourceId[],
): TafsirSourceId[] {
  const seen = new Set(ids.filter(isTafsirSourceId));
  return ALL_TAFSIR_SOURCE_IDS.filter((id) => seen.has(id));
}

export interface ResolveSourcesInput {
  /** Sources the QUESTION explicitly named (highest priority). */
  explicitlyRequestedSources: TafsirSourceId[];
  /** True when the question asked for "all"/"the three" tafsirs. */
  asksForAllSources: boolean;
  /** Sources the UI currently has selected (used only if none named). */
  uiSelectedSources?: TafsirSourceId[];
}

/**
 * THE single place that decides which tafsir sources an answer shows, in
 * strict priority order (§1/§4):
 *   1. sources explicitly named in the question,
 *   2. an explicit "all tafsirs" request,
 *   3. the active UI selection,
 *   4. otherwise all three.
 * Never silently adds a source that wasn't asked for; always returns a
 * canonical, de-duplicated, non-empty list.
 */
export function resolveRequestedTafsirSources(
  input: ResolveSourcesInput,
): TafsirSourceId[] {
  const explicit = normalizeSourceList(input.explicitlyRequestedSources);
  if (explicit.length > 0) return explicit;
  if (input.asksForAllSources) return [...ALL_TAFSIR_SOURCE_IDS];
  const ui = normalizeSourceList(input.uiSelectedSources ?? []);
  if (ui.length > 0) return ui;
  return [...ALL_TAFSIR_SOURCE_IDS];
}
