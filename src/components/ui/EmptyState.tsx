import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';

interface EmptyStateProps {
  welcome: string;
  hint: string;
}

/** Shown before the first message: bismillah, ornamental rule, welcome text. */
export default function EmptyState({ welcome, hint }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.bismillah}>﷽</Text>

      <View style={styles.ruleRow}>
        <View style={styles.ruleLine} />
        <Svg width={12} height={12} viewBox="0 0 14 14">
          <Path
            d="M7 0l1.8 3.6L12.6 2 11 5.8 14 7l-3 1.2 1.6 3.8-3.8-1.6L7 14l-1.8-3.6L1.4 12 3 8.2 0 7l3-1.2L1.4 2l3.8 1.6z"
            fill={COLORS.gold}
          />
        </Svg>
        <View style={styles.ruleLine} />
      </View>

      <Text style={styles.welcome}>{welcome}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xl,
  },
  bismillah: {
    fontSize: 46,
    color: 'rgba(13,58,45,0.9)',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: 220,
    marginTop: SPACING.xl,
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(178,138,62,0.35)',
  },
  welcome: {
    marginTop: SPACING.xl,
    maxWidth: 320,
    fontSize: 19,
    lineHeight: 30,
    textAlign: 'center',
    color: COLORS.forest,
  },
  hint: {
    marginTop: SPACING.sm,
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.inkSoft,
  },
});
