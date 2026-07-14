import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/** Eight-pointed star — the app's mark. */
function StarLogo() {
  return (
    <View style={styles.logo}>
      <Svg viewBox="0 0 44 44" width={26} height={26} style={StyleSheet.absoluteFill}>
        <Path
          d="M22 2l4.9 10.3L38 8l-4.3 11.1L44 22l-10.3 2.9L38 36l-11.1-4.3L22 42l-4.9-10.3L6 36l4.3-11.1L0 22l10.3-2.9L6 8l11.1 4.3z"
          fill={COLORS.gold}
          opacity={0.9}
        />
      </Svg>
      <Svg viewBox="0 0 24 24" width={18} height={18}>
        <Path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 0 4 18.5zM6.5 18H18v1.5H6.5a.75.75 0 0 1 0-1.5zM7 6h10v2H7z"
          fill={COLORS.forestDeep}
        />
      </Svg>
    </View>
  );
}

export default function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <StarLogo />
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.forest,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: COLORS.cream,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(230,214,174,0.9)',
    fontSize: 11.5,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
});
