import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { UIStrings } from '../../utils/strings';

interface MushafPageNavigationProps {
  page: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  strings: UIStrings;
  disabledPrevious?: boolean;
  disabledNext?: boolean;
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path d={d} stroke={COLORS.cream} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Previous/Next controls + "page X of 604" indicator, pinned at the bottom of the reader. */
export default function MushafPageNavigation({
  page,
  total,
  onPrevious,
  onNext,
  strings,
  disabledPrevious = false,
  disabledNext = false,
}: MushafPageNavigationProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onNext}
        disabled={disabledNext}
        accessibilityLabel={strings.nextPage}
        style={({ pressed }) => [styles.button, disabledNext && styles.buttonDisabled, pressed && styles.buttonPressed]}
      >
        <ArrowIcon direction="right" />
      </Pressable>

      <Text style={styles.pageLabel}>{strings.pageOf(page, total)}</Text>

      <Pressable
        onPress={onPrevious}
        disabled={disabledPrevious}
        accessibilityLabel={strings.previousPage}
        style={({ pressed }) => [
          styles.button,
          disabledPrevious && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <ArrowIcon direction="left" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.forest,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,246,0.08)',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,253,246,0.18)',
  },
  pageLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.gold,
  },
});
