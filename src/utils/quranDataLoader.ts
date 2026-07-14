import quranRaw from '../data/quran/quran.json';
import type { QuranAyah, QuranValidation, SurahListItem } from '../types/quran.types';

/**
 * Loads and indexes src/data/quran/quran.json — the ONLY data source for
 * the Quran reading section (display + search). tafseer_saadi.json is
 * never used here; it stays exclusively behind the tafsir chatbot.
 *
 * The full mushaf has exactly 6236 ayahs. That count is validated once
 * at load time; a mismatch never crashes the app, it surfaces as a
 * `QuranValidation.valid === false` flag the UI turns into a warning.
 */

export const EXPECTED_AYAH_COUNT = 6236;

function isValidAyah(a: unknown): a is QuranAyah {
  if (typeof a !== 'object' || a === null) return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.surahNumber === 'number' &&
    typeof o.surahNameArabic === 'string' &&
    typeof o.surahNameEnglish === 'string' &&
    typeof o.ayahNumber === 'number' &&
    typeof o.textUthmani === 'string' &&
    typeof o.textSimple === 'string' &&
    typeof o.textNormalized === 'string' &&
    typeof o.juz === 'number' &&
    typeof o.page === 'number'
  );
}

let ayahs: QuranAyah[] | null = null;
let validation: QuranValidation | null = null;
let surahList: SurahListItem[] | null = null;
let surahIndex: Map<number, QuranAyah[]> | null = null;

function ensureLoaded(): void {
  if (ayahs) return;

  const raw = quranRaw as unknown;
  const rawArray = Array.isArray(raw) ? raw : [];
  const valid = rawArray.filter(isValidAyah);

  ayahs = valid;
  validation = {
    valid: Array.isArray(raw) && rawArray.length === EXPECTED_AYAH_COUNT && valid.length === EXPECTED_AYAH_COUNT,
    count: valid.length,
    expected: EXPECTED_AYAH_COUNT,
  };

  const surahMap = new Map<number, SurahListItem>();
  surahIndex = new Map();
  for (const a of valid) {
    const existing = surahMap.get(a.surahNumber);
    if (existing) existing.ayahCount += 1;
    else
      surahMap.set(a.surahNumber, {
        number: a.surahNumber,
        nameArabic: a.surahNameArabic,
        nameEnglish: a.surahNameEnglish,
        ayahCount: 1,
        firstPage: a.page,
      });

    const list = surahIndex.get(a.surahNumber);
    if (list) list.push(a);
    else surahIndex.set(a.surahNumber, [a]);
  }
  surahList = [...surahMap.values()].sort((x, y) => x.number - y.number);
}

/** Validation result for quran.json — check `.valid` before trusting counts. */
export function getQuranValidation(): QuranValidation {
  ensureLoaded();
  return validation!;
}

/** Full flat ayah list (for search). */
export function loadQuranData(): Promise<QuranAyah[]> {
  ensureLoaded();
  return Promise.resolve(ayahs!);
}

/** 114-surah summary list, derived once from quran.json. */
export function getSurahList(): SurahListItem[] {
  ensureLoaded();
  return surahList!;
}

/** All ayahs of one surah, in ayah order. */
export function getAyahsBySurah(surahNumber: number): QuranAyah[] {
  ensureLoaded();
  return surahIndex!.get(surahNumber) ?? [];
}

export function getSurahMeta(surahNumber: number): SurahListItem | null {
  ensureLoaded();
  return surahList!.find((s) => s.number === surahNumber) ?? null;
}

export function getAyah(surahNumber: number, ayahNumber: number): QuranAyah | null {
  ensureLoaded();
  const list = surahIndex!.get(surahNumber);
  return list?.find((a) => a.ayahNumber === ayahNumber) ?? null;
}
