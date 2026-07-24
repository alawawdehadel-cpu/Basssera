import type {
  TafseerAyah,
  TafseerGroup,
  TafsirSourceId,
} from '../types/data.types';
import { sourceArabicName } from './tafsirSources';

/**
 * ============================================================
 *  Per-source tafsir adapters.
 *
 *  As-Sa'di already ships in the app's canonical TafseerGroup shape.
 *  Ibn Kathir / Al-Tabari datasets are third-party and may use different
 *  field names (surah_number / surahNumber / ayah / verse / tafsir /
 *  content, …). Each adapter maps its raw records into ONE internal
 *  TafseerGroup model, tagged with its source, WITHOUT ever rewriting,
 *  summarizing, or fabricating religious text — it only relocates and
 *  validates fields, preserving the explanation byte-for-byte.
 *
 *  Every adapter:
 *    - preserves the original explanation + Arabic UTF-8 text verbatim,
 *    - preserves surah/ayah numbers (single ayah OR a range),
 *    - validates surah ∈ [1,114], ayah_start > 0, ayah_end ≥ ayah_start,
 *      explanation non-empty,
 *    - drops malformed records safely (counted, never silently mis-filed),
 *    - de-duplicates within the same source,
 *    - reports counts so callers/scripts can surface them in development.
 * ============================================================
 */

export interface AdaptStats {
  source: TafsirSourceId;
  /** Records seen in the raw input. */
  total: number;
  /** Records that passed validation and were kept. */
  valid: number;
  /** Records dropped because a required field was missing/invalid. */
  invalid: number;
  /** Records dropped as exact (surah + ayah range) duplicates of a kept one. */
  duplicates: number;
  /** Human-readable reasons for dropped records (first few), for dev logging. */
  sampleIssues: string[];
}

export interface AdaptResult {
  groups: TafseerGroup[];
  stats: AdaptStats;
}

const MAX_SAMPLE_ISSUES = 8;

/* ------------------------------------------------------------------ */
/* Field extraction helpers — tolerant of alternative key names        */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

/** First candidate key present with a value of the wanted primitive type. */
function pickNumber(o: Raw, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

function pickString(o: Raw, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

/** Normalize an `ayahs` array if the source provides one; else synthesize it. */
function pickAyahs(o: Raw, start: number, end: number, ayahText: string): TafseerAyah[] {
  const raw = o.ayahs;
  if (Array.isArray(raw)) {
    const mapped: TafseerAyah[] = [];
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue;
      const a = item as Raw;
      const number = pickNumber(a, ['number', 'ayah', 'ayah_number', 'verse', 'verse_number']);
      const text = pickString(a, ['text', 'ayah_text', 'verse_text', 'content']);
      if (number !== null && text !== null) mapped.push({ number, text });
    }
    if (mapped.length > 0) return mapped;
  }
  // No usable ayah array — synthesize one entry spanning the range so the
  // per-ayah index (quranIntents.ts) still has something to key on. The
  // verse text is preserved as-is; nothing is invented.
  const synth: TafseerAyah[] = [];
  for (let n = start; n <= end && n - start < 300; n++) {
    synth.push({ number: n, text: ayahText });
  }
  return synth.length > 0 ? synth : [{ number: start, text: ayahText }];
}

/** Canonicalize a surah type value to the app's vocabulary where possible. */
function normalizeSurahType(raw: string | null): string {
  if (!raw) return '';
  const v = raw.trim().toLowerCase();
  if (v === 'meccan' || v === 'makki' || v === 'مكية' || v === 'مكيه') return 'meccan';
  if (v === 'medinan' || v === 'madani' || v === 'مدنية' || v === 'مدنيه') return 'medinan';
  return raw;
}

/** Field-name candidates, ordered by preference. */
const SURAH_KEYS = ['surah', 'surah_number', 'surahNumber', 'sura', 'chapter'];
const SURAH_NAME_KEYS = ['surah_name', 'surahName', 'sura_name', 'name'];
const SURAH_TRANSLIT_KEYS = ['surah_transliteration', 'surahTransliteration', 'transliteration', 'name_en'];
const SURAH_TYPE_KEYS = ['surah_type', 'surahType', 'type', 'revelation_place'];
const AYAH_START_KEYS = ['ayah_start', 'ayahStart', 'ayah', 'ayah_number', 'ayahNumber', 'verse', 'verse_number', 'aya'];
const AYAH_END_KEYS = ['ayah_end', 'ayahEnd', 'ayah_to', 'to'];
const AYAH_TEXT_KEYS = ['ayah_text', 'ayahText', 'verse_text', 'quran_text', 'arabic'];
const EXPLANATION_KEYS = ['explanation', 'tafsir', 'tafseer', 'content', 'text', 'commentary'];

/**
 * Core normalizer shared by every source. `source` decides the tag/label; the
 * field mapping is identical because we probe every known key name. Returns
 * null (with a reason) for records that cannot be safely placed.
 */
function normalizeRecord(
  raw: unknown,
  source: TafsirSourceId,
  reasons: string[],
): TafseerGroup | null {
  if (typeof raw !== 'object' || raw === null) {
    reasons.push('record is not an object');
    return null;
  }
  const o = raw as Raw;

  const surah = pickNumber(o, SURAH_KEYS);
  if (surah === null || !Number.isInteger(surah) || surah < 1 || surah > 114) {
    reasons.push(`invalid surah number: ${JSON.stringify(o[SURAH_KEYS[0]])}`);
    return null;
  }

  const ayahStart = pickNumber(o, AYAH_START_KEYS);
  if (ayahStart === null || !Number.isInteger(ayahStart) || ayahStart < 1) {
    reasons.push(`invalid ayah_start in surah ${surah}`);
    return null;
  }

  // A range end may be omitted (single-ayah record) — default to start.
  const rawEnd = pickNumber(o, AYAH_END_KEYS);
  const ayahEnd = rawEnd === null ? ayahStart : rawEnd;
  if (!Number.isInteger(ayahEnd) || ayahEnd < ayahStart) {
    reasons.push(`ayah_end < ayah_start in surah ${surah}:${ayahStart}`);
    return null;
  }

  const explanation = pickString(o, EXPLANATION_KEYS);
  if (explanation === null || explanation.trim().length === 0) {
    reasons.push(`empty explanation in surah ${surah}:${ayahStart}`);
    return null;
  }

  const surahName = pickString(o, SURAH_NAME_KEYS) ?? `سورة ${surah}`;
  const surahTranslit = pickString(o, SURAH_TRANSLIT_KEYS) ?? `Surah ${surah}`;
  const surahType = normalizeSurahType(pickString(o, SURAH_TYPE_KEYS));
  const ayahText = pickString(o, AYAH_TEXT_KEYS) ?? '';
  const ayahs = pickAyahs(o, ayahStart, ayahEnd, ayahText);

  return {
    source,
    source_name_ar: sourceArabicName(source),
    surah,
    surah_name: surahName,
    surah_transliteration: surahTranslit,
    surah_type: surahType,
    ayah_start: ayahStart,
    ayah_end: ayahEnd,
    ayahs,
    // Fall back to the joined ayah texts if the source has no combined field.
    ayah_text: ayahText || ayahs.map((a) => a.text).join(' ').trim(),
    explanation,
  };
}

/** Shared driver: normalize + validate + de-duplicate an entire raw dataset. */
function adaptDataset(raw: unknown, source: TafsirSourceId): AdaptResult {
  const stats: AdaptStats = {
    source,
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    sampleIssues: [],
  };

  if (!Array.isArray(raw)) {
    stats.sampleIssues.push('dataset root is not an array');
    return { groups: [], stats };
  }

  stats.total = raw.length;
  const groups: TafseerGroup[] = [];
  const seen = new Set<string>();
  const reasons: string[] = [];

  for (const record of raw) {
    const before = reasons.length;
    const group = normalizeRecord(record, source, reasons);
    if (!group) {
      stats.invalid += 1;
      continue;
    }
    // Duplicate = same source + surah + exact ayah range (regardless of order).
    const key = `${group.surah}:${group.ayah_start}-${group.ayah_end}`;
    if (seen.has(key)) {
      stats.duplicates += 1;
      if (reasons.length === before) reasons.push(`duplicate ${key}`);
      continue;
    }
    seen.add(key);
    groups.push(group);
    stats.valid += 1;
  }

  stats.sampleIssues = reasons.slice(0, MAX_SAMPLE_ISSUES);
  return { groups, stats };
}

/* ------------------------------------------------------------------ */
/* Public per-source adapters                                          */
/* ------------------------------------------------------------------ */

/** Adapt raw Tafsir As-Sa'di records (already canonical) → tagged groups. */
export function adaptSaadiData(raw: unknown): AdaptResult {
  return adaptDataset(raw, 'al_saadi');
}

/** Adapt raw Tafsir Ibn Kathir records → the shared internal model. */
export function adaptIbnKathirData(raw: unknown): AdaptResult {
  return adaptDataset(raw, 'ibn_kathir');
}

/** Adapt raw Tafsir Al-Tabari records → the shared internal model. */
export function adaptTabariData(raw: unknown): AdaptResult {
  return adaptDataset(raw, 'al_tabari');
}

/** Dispatch to the right adapter by source id (used by the loader). */
export function adaptBySource(raw: unknown, source: TafsirSourceId): AdaptResult {
  switch (source) {
    case 'al_saadi':
      return adaptSaadiData(raw);
    case 'ibn_kathir':
      return adaptIbnKathirData(raw);
    case 'al_tabari':
      return adaptTabariData(raw);
    default:
      return adaptDataset(raw, source);
  }
}
