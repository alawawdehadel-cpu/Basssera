import { Platform } from 'react-native';

/** System fonts first — keeps the app stable in Expo Go without extra font loading. */
export const FONTS = {
  arabic: Platform.select({ ios: 'Damascus', android: 'sans-serif', default: undefined }),
  base: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
  /**
   * KFGQPC Uthman Taha Naskh — Quran body text. Handles Tanzil annotation
   * marks correctly (small ۟ above silent alef, هُدًۭى, عَلَىٰ).
   */
  quran: 'UthmanTN1',
  /**
   * KFGQPC UthmanicHafs1 Ver13 — ornate ayah-end medallion (۝ + number)
   * only; it draws U+06DF as a large inline circle so don't use it for
   * body text. Both loaded in app/_layout.tsx from assets/fonts.
   */
  quranOrnament: 'UthmanicHafs',
};

export const TEXT = {
  title: { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 13, fontWeight: '500' as const },
  h1: { fontSize: 26, fontWeight: '700' as const },
  h2: { fontSize: 19, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyLarge: { fontSize: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
};
