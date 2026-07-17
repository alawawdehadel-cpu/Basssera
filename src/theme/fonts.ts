/**
 * Font families for the Basirah UI.
 * - UI text: IBM Plex Sans Arabic (per-weight families — native never
 *   synthesizes weights, so styles must pick the family, not fontWeight).
 * - Decorative Arabic (app name, surah names, monograms): Amiri.
 * - Quran body text: the bundled Uthmani QuranFont (KFGQPC-style) —
 *   preferred over Amiri for actual mushaf text, per the handoff note.
 */
export const FONT = {
  ui400: 'IBMPlexSansArabic_400Regular',
  ui500: 'IBMPlexSansArabic_500Medium',
  ui600: 'IBMPlexSansArabic_600SemiBold',
  ui700: 'IBMPlexSansArabic_700Bold',
  amiri: 'Amiri_400Regular',
  amiriBold: 'Amiri_700Bold',
  quran: 'QuranFont',
} as const;

export type UiWeight = 400 | 500 | 600 | 700;

export function uiFamily(weight: UiWeight): string {
  switch (weight) {
    case 700:
      return FONT.ui700;
    case 600:
      return FONT.ui600;
    case 500:
      return FONT.ui500;
    default:
      return FONT.ui400;
  }
}
