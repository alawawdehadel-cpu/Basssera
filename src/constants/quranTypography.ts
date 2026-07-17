import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
/** Simple responsive split — tablets get a slightly larger, calmer scale. */
const isTablet = width >= 600;

/**
 * Central Quran typography scale. ALL Quran text sizing and vertical rhythm
 * comes from here so the Mushaf reader, surah reader, search results and chat
 * ayah cards stay visually unified — no ad-hoc per-component sizes.
 *
 * Contexts that follow the user's font-size control (mushaf/ayah) pass the
 * chosen base size and inherit `lineHeightRatio`; fixed contexts (surah title,
 * search, Basmala) use the absolute/relative sizes below. Quran text must never
 * carry fontWeight / letterSpacing / textTransform — those distort Uthmani
 * marks — so QuranText strips them.
 */
export const QURAN_TYPOGRAPHY = {
  /** Reading size used when the user hasn't picked one. */
  defaultFontSize: isTablet ? 30 : 26,
  minFontSize: 18,
  maxFontSize: 40,
  /** One consistent rhythm everywhere: lineHeight = fontSize * this. */
  lineHeightRatio: 1.95,
  /** Basmala: a touch larger than body but from the same base — consistent. */
  bismillahScale: 1.04,
  /** Surah-title (banner): fixed, independent of the reading size. */
  surahTitleSize: isTablet ? 26 : 23,
  surahTitleLineHeightRatio: 1.4,
  /** Search-result ayah preview: compact, fixed. */
  searchSize: isTablet ? 20 : 18,
  searchLineHeightRatio: 1.7,
  /** Chat "related ayah" cards: fixed. */
  relatedSize: isTablet ? 21 : 19,
  /**
   * Native-only safety net: a pre-measured Mushaf line that is a hair too wide
   * may auto-shrink (adjustsFontSizeToFit) down to at most this fraction of the
   * base size. Kept high so lines stay visually the SAME size — replacing the
   * old 0.6 that let lines look wildly bigger/smaller.
   */
  mushafMinFontScale: 0.9,
} as const;

/** The rendering contexts QuranText understands. */
export type QuranVariant = 'mushaf' | 'ayah' | 'bismillah' | 'surahTitle' | 'search';

/** Resolve a variant (+ optional base size override) to fontSize + lineHeight. */
export function resolveQuranTextStyle(
  variant: QuranVariant,
  size?: number,
): { fontSize: number; lineHeight: number } {
  const T = QURAN_TYPOGRAPHY;
  switch (variant) {
    case 'bismillah': {
      const fontSize = (size ?? T.defaultFontSize) * T.bismillahScale;
      return { fontSize, lineHeight: fontSize * T.lineHeightRatio };
    }
    case 'surahTitle': {
      const fontSize = size ?? T.surahTitleSize;
      return { fontSize, lineHeight: fontSize * T.surahTitleLineHeightRatio };
    }
    case 'search': {
      const fontSize = size ?? T.searchSize;
      return { fontSize, lineHeight: fontSize * T.searchLineHeightRatio };
    }
    case 'mushaf':
    case 'ayah':
    default: {
      const fontSize = size ?? T.defaultFontSize;
      return { fontSize, lineHeight: fontSize * T.lineHeightRatio };
    }
  }
}
