import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { FONT, uiFamily, type UiWeight } from '../../theme/fonts';

interface TxtProps extends TextProps {
  size?: number;
  weight?: UiWeight;
  color?: string;
  align?: TextStyle['textAlign'];
  /** lineHeight = size * lh when provided. */
  lh?: number;
  /** Use Amiri (decorative Arabic serif) instead of the UI sans. */
  amiri?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Themed text primitive for the Basirah UI: IBM Plex Sans Arabic by
 * default (per-weight family), Amiri via the `amiri` flag. Keeps screens
 * free of repeated fontFamily plumbing.
 */
export default function Txt({
  size = 14,
  weight = 400,
  color,
  align,
  lh,
  amiri = false,
  style,
  children,
  ...rest
}: TxtProps) {
  const { isRTL, direction } = useAppLanguage();
  const family = amiri ? (weight >= 600 ? FONT.amiriBold : FONT.amiri) : uiFamily(weight);
  // Default alignment follows the UI language; an explicit `align` still wins.
  const resolvedAlign = align ?? (isRTL ? 'right' : 'left');
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: size,
          color,
          textAlign: resolvedAlign,
          writingDirection: direction,
          ...(lh ? { lineHeight: size * lh } : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
