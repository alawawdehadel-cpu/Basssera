import {
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/typography';
import { type QuranVariant, resolveQuranTextStyle } from '../../constants/quranTypography';

export interface QuranTextProps
  extends Pick<
    TextProps,
    | 'children'
    | 'numberOfLines'
    | 'onPress'
    | 'suppressHighlighting'
    | 'accessibilityRole'
    | 'accessibilityLabel'
    | 'adjustsFontSizeToFit'
    | 'minimumFontScale'
    | 'selectable'
  > {
  /** Rendering context — drives size + line height from quranTypography. */
  variant?: QuranVariant;
  /** Base size override (for user-controlled reading contexts: mushaf/ayah). */
  size?: number;
  /** Horizontal alignment — Mushaf lines centered, list/reader ayahs right. */
  align?: 'center' | 'right';
  /** Ink color. Defaults to the deep-green reading color. */
  color?: string;
  /**
   * SAFE style overrides only (color / textAlign / margin / padding …).
   * fontWeight, letterSpacing and textTransform are stripped — they break
   * Uthmani mark shaping and must never be applied to Quran text.
   */
  style?: StyleProp<TextStyle>;
}

/**
 * The single component for rendering Quran (Uthmani) text everywhere — Mushaf
 * reader, surah reader, search results, chat ayah cards. It:
 *  - applies the one dedicated Quran font (FONTS.quran / Amiri Quran),
 *  - takes size + line height from the central quranTypography scale via
 *    `variant`, so nothing looks randomly bigger/smaller,
 *  - keeps RTL + Android includeFontPadding (so tall marks never clip), and
 *  - STRIPS unsafe typography (fontWeight/letterSpacing/textTransform).
 *
 * Callers pass raw `textUthmani` as children and only tune variant/size/
 * align/color — never restyle the glyphs.
 */
export default function QuranText({
  children,
  variant = 'ayah',
  size,
  align = 'center',
  color = COLORS.forestDeep,
  style,
  ...rest
}: QuranTextProps) {
  const { fontSize, lineHeight } = resolveQuranTextStyle(variant, size);

  // Remove typography that corrupts Uthmani rendering, even if a caller passes it.
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight: _fw, letterSpacing: _ls, textTransform: _tt, ...safe } = flat as TextStyle;

  return (
    <Text {...rest} style={[styles.base, { fontSize, lineHeight, textAlign: align, color }, safe]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FONTS.quran,
    writingDirection: 'rtl',
    // Android clips tall Uthmani marks unless font padding is kept.
    ...(Platform.OS === 'android' ? { includeFontPadding: true } : null),
  } as TextStyle,
});
