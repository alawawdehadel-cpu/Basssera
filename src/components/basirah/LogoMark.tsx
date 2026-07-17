import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

/**
 * The Basirah mark: open-book glyph with a gold spine + small gold star.
 * Placeholder artwork per the handoff — to be finalized by a brand designer.
 */
export function BookStarGlyph({
  width = 24,
  bookFill = '#F7F2E5',
  spine = '#C9A227',
  star = '#DFC96C',
  lines,
}: {
  width?: number;
  bookFill?: string;
  spine?: string;
  star?: string;
  /** Optional decorative text-line color inside the book. */
  lines?: string;
}) {
  return (
    <Svg width={width} height={(width * 72) / 66} viewBox="0 0 66 72" fill="none">
      <Path d="M6 46 Q33 32 33 32 Q33 32 60 46 L60 60 Q33 48 6 60 Z" fill={bookFill} />
      <Path d="M33 32 V60" stroke={spine} strokeWidth={1.5} />
      {lines ? (
        <Path
          d="M12 46 h14 M40 46 h14 M12 52 h13 M41 52 h13"
          stroke={lines}
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.55}
        />
      ) : null}
      <Path d="M33 6 l2.8 5.8 6.4 .9 -4.6 4.5 1.1 6.3 -5.7 -3 -5.7 3 1.1 -6.3 -4.6 -4.5 6.4 -.9 Z" fill={star} />
    </Svg>
  );
}

/** Small emerald-gradient app tile with the mark inside (Home header). */
export function LogoTile({ size = 42 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.emerald, colors.emerald2]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.31,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BookStarGlyph width={size * 0.57} />
    </LinearGradient>
  );
}

/** The thin-arch outline that frames the mark on splash/onboarding. */
export function ArchFrame({
  size,
  borderColor,
  children,
  backgroundColor,
}: {
  size: number;
  borderColor: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 1.5,
        borderColor,
        backgroundColor,
        borderTopLeftRadius: size * 0.58,
        borderTopRightRadius: size * 0.58,
        borderBottomLeftRadius: size * 0.42,
        borderBottomRightRadius: size * 0.42,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
