import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/typography';

export interface QuranTextProps extends TextProps {
  /** Font size in px. Line height is derived from this. */
  size?: number;
  /** Horizontal alignment — Mushaf lines are centered, list/reader ayahs right. */
  align?: 'center' | 'right';
  /** Ink color. Defaults to the deep-green reading color. */
  color?: string;
  /** lineHeight = size * this. Generous by default so Uthmani marks never clip. */
  lineHeightScale?: number;
}

const DEFAULT_SIZE = 22;
const DEFAULT_LINE_HEIGHT_SCALE = 1.9;

/**
 * The single component for rendering Quran (Uthmani) text anywhere in the
 * app — Mushaf reader, surah reader, search results, and chat ayah cards.
 *
 * It applies the dedicated Quran font (Amiri Quran, see FONTS.quran) with
 * RTL + Mushaf-safe styles and DELIBERATELY omits everything that breaks
 * Arabic/Uthmani rendering: no letterSpacing, no textTransform, no
 * fontWeight (synthetic bold distorts the marks). Callers pass raw
 * `textUthmani` as children and only tune size/align/color — never restyle
 * the glyphs. Extra Text props (numberOfLines, onPress, adjustsFontSizeToFit,
 * …) pass straight through.
 */
export default function QuranText({
  children,
  size = DEFAULT_SIZE,
  align = 'center',
  color = COLORS.forestDeep,
  lineHeightScale = DEFAULT_LINE_HEIGHT_SCALE,
  style,
  ...rest
}: QuranTextProps) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        { fontSize: size, lineHeight: size * lineHeightScale, textAlign: align, color },
        style,
      ]}
    >
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
