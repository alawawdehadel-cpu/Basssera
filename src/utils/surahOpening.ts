import { getSurahMeta } from './quranDataLoader';
import { normalizeText } from './textNormalizer';

/**
 * Rules for rendering surah openings in the Quran reader (both Mushaf page
 * mode and surah reading mode). This module only DECIDES what decoration to
 * show around ayahs — it never mutates, adds, or removes Quran text. The
 * displayed Basmala (see BismillahLine) is a reading-only UI element and is
 * intentionally NOT part of quran.json.
 */

export type RevelationType = 'meccan' | 'medinan';

/**
 * Surahs revealed in Madinah (Tanzil classification); every other surah is
 * Meccan. Used only for the optional مكية/مدنية badge — reference metadata,
 * not Quran text.
 */
const MEDINAN_SURAHS = new Set<number>([
  2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 76, 98, 99, 110,
]);

/** At-Tawbah (9) has no Basmala; Al-Fatihah (1) counts its Basmala as ayah 1. */
const NO_STANDALONE_BISMILLAH = new Set<number>([1, 9]);

/** Normalized Basmala prefix, used to detect if an ayah already opens with it. */
const BISMILLAH_PREFIX = normalizeText('بِسْمِ ٱللَّهِ');

/** The Basmala is four whitespace-separated words in the Uthmani text. */
const BISMILLAH_WORD_COUNT = 4;

export interface SurahOpeningMeta {
  surahNumber: number;
  /** Arabic name as stored in quran.json — already includes the "سُورَةُ" prefix. */
  nameArabic: string;
  ayahCount?: number;
  revelationType: RevelationType;
}

/** True when `text` begins with the Basmala, ignoring diacritics/spelling. */
export function startsWithBismillah(text: string): boolean {
  return normalizeText(text).startsWith(BISMILLAH_PREFIX);
}

/** An ayah begins a surah when it is the first ayah. */
export function isSurahStart(ayah: { ayahNumber: number }): boolean {
  return ayah.ayahNumber === 1;
}

/** Whether to render the decorative surah header before this ayah. */
export function shouldRenderSurahHeader(ayah: { ayahNumber: number }): boolean {
  return isSurahStart(ayah);
}

/**
 * Whether to render a SEPARATE decorative Basmala line at a surah opening.
 * Every surah gets one EXCEPT Al-Fatihah (its Basmala is ayah 1) and
 * At-Tawbah (no Basmala). When ayah 1's data already embeds the Basmala, the
 * caller uses stripLeadingBismillah so it shows once here, not twice.
 */
export function shouldRenderBismillah(surahNumber: number): boolean {
  return !NO_STANDALONE_BISMILLAH.has(surahNumber);
}

/**
 * Returns ayah text with a leading Basmala removed, for display only. Some
 * datasets embed the Basmala in ayah 1 of every surah; since the reader shows
 * it as its own decorative line (see shouldRenderBismillah), ayah 1 must not
 * repeat it. Only strips when the text truly starts with the Basmala and
 * content remains after it — never for Al-Fatihah, where the Basmala IS the
 * ayah. Does not touch quran.json; the underlying text is unchanged.
 */
export function stripLeadingBismillah(text: string): string {
  if (!startsWithBismillah(text)) return text;
  const rest = text.trim().split(/\s+/).slice(BISMILLAH_WORD_COUNT).join(' ');
  return rest.length > 0 ? rest : text;
}

/** Opening metadata (name, ayah count, revelation type) for a surah header. */
export function getSurahOpeningMeta(surahNumber: number): SurahOpeningMeta {
  const meta = getSurahMeta(surahNumber);
  return {
    surahNumber,
    nameArabic: meta?.nameArabic ?? '',
    ayahCount: meta?.ayahCount,
    revelationType: MEDINAN_SURAHS.has(surahNumber) ? 'medinan' : 'meccan',
  };
}
