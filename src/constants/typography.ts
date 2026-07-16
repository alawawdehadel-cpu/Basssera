import { Platform } from 'react-native';

/** System fonts first — keeps the app stable in Expo Go without extra font loading. */
export const FONTS = {
  arabic: Platform.select({ ios: 'Damascus', android: 'sans-serif', default: undefined }),
  base: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
  /**
   * QuranFont = Amiri Quran — the dedicated Uthmani/Mushaf typeface used for
   * ALL Quran reading (body text AND the ayah-end medallion). It renders the
   * full range of Tanzil/Unicode Uthmani marks the way a real Mushaf does:
   * the iqlāb/ikhfāʾ small meem over/under tanwīn (U+06E2 / U+06ED), the
   * silent-alef round zero (U+06DF) as a small superscript — not a giant
   * inline circle — and it encloses the ayah number inside an ornate
   * medallion via U+06DD. Never pair it with letterSpacing/fontWeight, which
   * break Arabic joining and mark placement. Loaded in app/_layout.tsx.
   */
  quran: 'QuranFont',
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
