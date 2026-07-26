import type {
  TafseerGroup,
  TafsirSearchMatch,
  TafsirSourceId,
} from '../../types/data.types';
import { getAyah, getSurahMeta } from '../quranDataLoader';
import { withAyahMarker } from '../numerals';
import { shouldRenderBismillah, stripLeadingBismillah } from '../surahOpening';
import { sourceArabicName } from '../tafsirSources';
import { passagesFor } from './tafsirManifest';
import type { TafsirQuestionAnalysis } from './tafsirQuestionAnalyzer';

/**
 * ============================================================
 *  Source-aware tafsir retrieval.
 *
 *  The tafsir TEXT now lives in Firestore, so this module no longer walks a
 *  bundled dataset. It resolves an ayah reference to content-document ids via
 *  the bundled manifest (offline, zero reads) and reads the text out of the
 *  passages the caller pre-fetched.
 *
 *  Deliberately still SYNCHRONOUS. Only one of searchAnswer()'s eight return
 *  paths touches remote data; making the whole engine async to serve it would
 *  ripple through useAssistant, useChat and every call site in
 *  scripts/testTafsirEngine.js — and would pull the network layer into a module
 *  graph that bare Node must be able to load, which would end the only test
 *  harness this project has. useAssistant does the awaiting and injects the
 *  result instead.
 *
 *  The invariant that matters most is preserved by construction: a requested
 *  source that has no text yields its OWN "not found" marker and is never
 *  filled in with another scholar's words.
 * ============================================================
 */

/** Passage text for this turn, keyed by content-document id. */
export interface TafsirInjection {
  passages?: Map<string, string>;
  /** Sources whose fetch failed with nothing cached. */
  unavailableSources?: TafsirSourceId[];
}

function rangeLabel(start: number, end: number): string {
  return start === end ? `${start}` : `${start}–${end}`;
}

/**
 * Surah/ayah display data comes from the verified mushaf rather than from the
 * tafsir record, which is no longer local. quran.json is the same source
 * quranDataLoader already serves to the reader.
 */
function surahNameOf(surah: number): string {
  const meta = getSurahMeta(surah);
  if (!meta) return `سورة ${surah}`;
  return meta.nameArabic.replace(/^سُورَةُ?\s+/, '').replace(/^سورة\s+/, '').trim();
}

/**
 * Verse text for display. For verse 1 of a surah that opens with a standalone
 * Basmala (every surah except Al-Fatihah, whose Basmala IS verse 1, and
 * At-Tawbah, which has none), the stored text embeds the Basmala; it is
 * stripped here so it is never shown twice. quran.json is never mutated.
 */
function ayahTextOf(surah: number, ayah: number): string {
  const raw = getAyah(surah, ayah)?.textUthmani ?? '';
  if (ayah === 1 && shouldRenderBismillah(surah)) return stripLeadingBismillah(raw);
  return raw;
}

/**
 * Text of ayahs [start, end], each Basmala-cleaned and followed by its own
 * decorated ayah marker (﴿٢﴾), one verse per line. So a verse-range or
 * full-surah answer shows every verse ending with its number (§4).
 */
function ayahTextRange(surah: number, start: number, end: number): string {
  const parts: string[] = [];
  for (let n = start; n <= end && n - start < 20; n++) {
    const t = ayahTextOf(surah, n);
    if (t) parts.push(withAyahMarker(t, n));
  }
  return parts.join('\n').trim() || withAyahMarker(ayahTextOf(surah, start), start);
}

function toMatch(
  source: TafsirSourceId,
  surah: number,
  /** The range shown in the heading (the REQUESTED scope, unified across sources). */
  displayStart: number,
  displayEnd: number,
  explanation: string,
  /** The source's own wider grouped range, if any (drives the honest note). */
  covers?: { start: number; end: number },
): TafsirSearchMatch {
  return {
    source,
    sourceArabic: sourceArabicName(source),
    surahNumber: surah,
    surahName: surahNameOf(surah),
    surahTransliteration: getSurahMeta(surah)?.nameEnglish ?? '',
    ayahRange: rangeLabel(displayStart, displayEnd),
    ayahStart: displayStart,
    ayahEnd: displayEnd,
    ayahText: ayahTextRange(surah, displayStart, displayEnd),
    explanation,
    ...(covers ? { sourceCoversStart: covers.start, sourceCoversEnd: covers.end } : {}),
  };
}

/** A "no passage found" placeholder for one requested source. */
function notFoundMatch(
  source: TafsirSourceId,
  surah: number,
  surahName: string | null,
  start: number | null,
  end: number | null,
  unavailable = false,
): TafsirSearchMatch {
  return {
    source,
    sourceArabic: sourceArabicName(source),
    surahNumber: surah,
    surahName: surahName ?? surahNameOf(surah),
    surahTransliteration: '',
    ayahRange: start !== null ? rangeLabel(start, end ?? start) : '',
    ayahStart: start ?? 0,
    ayahEnd: end ?? start ?? 0,
    ayahText: start !== null ? ayahTextOf(surah, start) : '',
    explanation: '',
    notFound: true,
    ...(unavailable ? { unavailable: true } : {}),
  };
}

export interface TafsirRetrieval {
  matches: TafsirSearchMatch[];
  /**
   * Sources that were requested and DO have a passage for this ayah, but whose
   * text could not be fetched. Distinct from "this source has nothing here",
   * which is a real answer rather than a failure. The bundled manifest is what
   * makes that distinction possible while offline.
   */
  failedSources: TafsirSourceId[];
  /** True when no requested source produced any text. */
  allMissing: boolean;
}

/**
 * Retrieves per-source tafsir passages for a resolved analysis.
 *
 * @param sources   sources to retrieve, already resolved and ordered
 * @param analysis  the resolved reference
 * @param injected  passages fetched for this turn (see useAssistant)
 */
export function retrieveTafsirMatches(
  sources: TafsirSourceId[],
  analysis: TafsirQuestionAnalysis,
  injected?: TafsirInjection,
): TafsirRetrieval {
  const { surahNumber, surahName, ayahStart, ayahEnd } = analysis;
  const fullSurah = analysis.fullSurah === true;
  const matches: TafsirSearchMatch[] = [];
  const failedSources: TafsirSourceId[] = [];

  if (surahNumber === null) {
    return { matches: [], failedSources, allMissing: true };
  }

  const passages = injected?.passages;
  const unavailable = new Set(injected?.unavailableSources ?? []);
  let anyFound = false;

  for (const source of sources) {
    const refs = passagesFor(source, surahNumber, ayahStart, ayahEnd);

    if (refs.length === 0) {
      // The manifest says this source genuinely has nothing here. That is a
      // real answer, and it stays correct with no network at all.
      matches.push(notFoundMatch(source, surahNumber, surahName, ayahStart, ayahEnd));
      continue;
    }

    const resolved = refs
      .map((ref) => ({ ref, text: passages?.get(ref.contentId) }))
      .filter((r): r is { ref: (typeof refs)[number]; text: string } => !!r.text);

    if (resolved.length === 0) {
      // The manifest says this source HAS a passage here, so failing to read it
      // is a fetch failure, not an absence. Flagged on the match itself so the
      // card can say "could not load" instead of falsely claiming the passage
      // does not exist.
      const couldNotFetch = unavailable.has(source) || !passages;
      if (couldNotFetch) failedSources.push(source);
      matches.push(
        notFoundMatch(source, surahNumber, surahName, ayahStart, ayahEnd, couldNotFetch),
      );
      continue;
    }

    anyFound = true;
    for (const { ref, text } of resolved) {
      if (fullSurah) {
        // Whole-surah request: each passage keeps its OWN range heading, so
        // the surah reads verse-group by verse-group in ayah order.
        matches.push(toMatch(source, surahNumber, ref.ayahStart, ref.ayahEnd, text));
      } else {
        // Single verse / range: EVERY source displays under the same requested
        // scope. When the source's passage is wider, record its real range so
        // the card can add an honest "discusses verses X–Y together" note —
        // never silently claim the wider range was requested.
        const dispStart = ayahStart ?? ref.ayahStart;
        const dispEnd = ayahEnd ?? ref.ayahEnd;
        const wider = ref.ayahStart < dispStart || ref.ayahEnd > dispEnd;
        matches.push(
          toMatch(
            source,
            surahNumber,
            dispStart,
            dispEnd,
            text,
            wider ? { start: ref.ayahStart, end: ref.ayahEnd } : undefined,
          ),
        );
      }
    }
  }

  // Stable ordering: request order, then surah, then ayah.
  const order = new Map(sources.map((s, i) => [s, i] as const));
  matches.sort((a, b) => {
    const so = (order.get(a.source) ?? 0) - (order.get(b.source) ?? 0);
    if (so !== 0) return so;
    if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
    return a.ayahStart - b.ayahStart;
  });

  return { matches, failedSources, allMissing: !anyFound };
}

/**
 * Every content-document id needed to answer this reference, across sources.
 * Used by the pre-fetch step; resolving ids costs no network and no reads.
 */
export function contentIdsFor(
  sources: TafsirSourceId[],
  surah: number,
  ayahStart: number | null,
  ayahEnd: number | null,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const ref of passagesFor(source, surah, ayahStart, ayahEnd)) {
      if (seen.has(ref.contentId)) continue;
      seen.add(ref.contentId);
      ids.push(ref.contentId);
    }
  }
  return ids;
}

/** Which of `sources` have a passage for this reference, per the local manifest. */
export function sourcesWithPassage(
  sources: TafsirSourceId[],
  surah: number,
  ayahStart: number | null,
  ayahEnd: number | null,
): TafsirSourceId[] {
  return sources.filter((s) => passagesFor(s, surah, ayahStart, ayahEnd).length > 0);
}

/**
 * Kept for API compatibility with the previous bundled-dataset implementation.
 * There is no longer a per-source index to clear; the manifest cache is reset
 * through _resetManifestCache().
 */
export function _resetTafsirSearchCache(): void {
  /* no cached dataset remains */
}

/** Unused re-export guard: TafseerGroup is still the shape used elsewhere. */
export type { TafseerGroup };
