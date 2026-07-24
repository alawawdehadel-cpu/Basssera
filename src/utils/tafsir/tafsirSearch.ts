import type {
  TafseerGroup,
  TafsirSearchMatch,
  TafsirSourceId,
} from '../../types/data.types';
import { didSourceFailSync, getSourceGroupsSync } from '../dataLoader';
import { sourceArabicName } from '../tafsirSources';
import type { TafsirQuestionAnalysis } from './tafsirQuestionAnalyzer';

/**
 * ============================================================
 *  Source-aware tafsir retrieval.
 *
 *  Builds and caches ONE index per source (surah → its groups), so a
 *  question never re-walks a whole dataset and adding a second/third source
 *  never rebuilds the others' indexes. Retrieval is exact and deterministic:
 *  it returns the tafsir group(s) whose ayah range overlaps the requested
 *  ayah/range, per source, and an honest "not found" marker for any
 *  requested source that has no matching passage — never another source's
 *  text in its place.
 * ============================================================
 */

/** surah number → groups of that surah (for one source). */
type SurahIndex = Map<number, TafseerGroup[]>;

const indexCache = new Map<TafsirSourceId, SurahIndex>();

function sourceIndex(source: TafsirSourceId): SurahIndex {
  const cached = indexCache.get(source);
  if (cached) return cached;

  const bySurah: SurahIndex = new Map();
  for (const g of getSourceGroupsSync(source)) {
    const list = bySurah.get(g.surah);
    if (list) list.push(g);
    else bySurah.set(g.surah, [g]);
  }
  // Keep each surah's groups in ayah order for stable, sorted output.
  for (const list of bySurah.values()) {
    list.sort((a, b) => a.ayah_start - b.ayah_start);
  }
  indexCache.set(source, bySurah);
  return bySurah;
}

function rangeLabel(start: number, end: number): string {
  return start === end ? `${start}` : `${start}–${end}`;
}

function toMatch(source: TafsirSourceId, g: TafseerGroup): TafsirSearchMatch {
  return {
    source,
    sourceArabic: sourceArabicName(source),
    surahNumber: g.surah,
    surahName: g.surah_name,
    surahTransliteration: g.surah_transliteration,
    ayahRange: rangeLabel(g.ayah_start, g.ayah_end),
    ayahStart: g.ayah_start,
    ayahEnd: g.ayah_end,
    ayahText: g.ayah_text,
    explanation: g.explanation,
  };
}

/** A "no passage found" placeholder for one requested source. */
function notFoundMatch(
  source: TafsirSourceId,
  surah: number,
  surahName: string | null,
  start: number | null,
  end: number | null,
): TafsirSearchMatch {
  return {
    source,
    sourceArabic: sourceArabicName(source),
    surahNumber: surah,
    surahName: surahName ?? `سورة ${surah}`,
    surahTransliteration: '',
    ayahRange: start !== null ? rangeLabel(start, end ?? start) : '',
    ayahStart: start ?? 0,
    ayahEnd: end ?? start ?? 0,
    ayahText: '',
    explanation: '',
    notFound: true,
  };
}

/** Groups of `surah` in one source that overlap [start,end] (or the first, whole-surah). */
function groupsForRange(
  source: TafsirSourceId,
  surah: number,
  start: number | null,
  end: number | null,
): TafseerGroup[] {
  const list = sourceIndex(source).get(surah);
  if (!list || list.length === 0) return [];
  if (start === null) return [list[0]]; // whole-surah request → first passage
  const lo = start;
  const hi = end ?? start;
  const overlapping = list.filter((g) => g.ayah_start <= hi && g.ayah_end >= lo);
  return overlapping;
}

export interface TafsirRetrieval {
  matches: TafsirSearchMatch[];
  /** Sources that were requested but failed to LOAD (not merely no-match). */
  failedSources: TafsirSourceId[];
  /** True when every requested source came back empty/not-found. */
  allMissing: boolean;
}

/**
 * Retrieves per-source tafsir passages for a resolved analysis.
 * @param sources  the sources to search, in display order (already resolved)
 */
export function retrieveTafsirMatches(
  sources: TafsirSourceId[],
  analysis: TafsirQuestionAnalysis,
): TafsirRetrieval {
  const { surahNumber, surahName, ayahStart, ayahEnd } = analysis;
  const matches: TafsirSearchMatch[] = [];
  const failedSources: TafsirSourceId[] = [];

  if (surahNumber === null) {
    return { matches: [], failedSources, allMissing: true };
  }

  let anyFound = false;
  for (const source of sources) {
    const groups = groupsForRange(source, surahNumber, ayahStart, ayahEnd);
    if (groups.length > 0) {
      anyFound = true;
      for (const g of groups) matches.push(toMatch(source, g));
    } else {
      if (didSourceFailSync(source)) failedSources.push(source);
      matches.push(notFoundMatch(source, surahNumber, surahName, ayahStart, ayahEnd));
    }
  }

  // Stable ordering: by source (request order), then surah, then ayah start.
  const order = new Map(sources.map((s, i) => [s, i] as const));
  matches.sort((a, b) => {
    const so = (order.get(a.source) ?? 0) - (order.get(b.source) ?? 0);
    if (so !== 0) return so;
    if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
    return a.ayahStart - b.ayahStart;
  });

  return { matches, failedSources, allMissing: !anyFound };
}

/** Clears cached indexes (used by tests to isolate runs). */
export function _resetTafsirSearchCache(): void {
  indexCache.clear();
}
