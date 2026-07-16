import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, READING } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { UIStrings } from '../../utils/strings';

interface MushafBottomBarProps {
  page: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  strings: UIStrings;
  disabledPrevious?: boolean;
  disabledNext?: boolean;
  onRequestJump?: () => void;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  // left "‹" = next (RTL forward); right "›" = previous.
  const d = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path
        d={d}
        stroke={READING.gold}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Premium bottom controls for the Mushaf reader. RTL: NEXT (higher page) is the
 * LEFT button pointing left; PREVIOUS is the RIGHT button pointing right. Each
 * has a text label + accessibilityLabel and a faded disabled state at the
 * first/last page. The centered indicator ("صفحة X من ٦٠٤"), flanked by small
 * gold ornaments, opens the jump sheet.
 */
export default function MushafBottomBar({
  page,
  total,
  onPrevious,
  onNext,
  strings,
  disabledPrevious = false,
  disabledNext = false,
  onRequestJump,
}: MushafBottomBarProps) {
  return (
    <View style={styles.bar}>
      {/* LEFT = next page (RTL forward) */}
      <Pressable
        onPress={onNext}
        disabled={disabledNext}
        accessibilityRole="button"
        accessibilityLabel={strings.nextPage}
        accessibilityState={{ disabled: disabledNext }}
        style={({ pressed }) => [
          styles.button,
          disabledNext && styles.buttonDisabled,
          pressed && !disabledNext && styles.buttonPressed,
        ]}
      >
        <Chevron direction="left" />
        <Text style={styles.buttonLabel} numberOfLines={1}>
          {strings.nextPage}
        </Text>
      </Pressable>

      <Pressable
        onPress={onRequestJump}
        disabled={!onRequestJump}
        accessibilityRole="button"
        accessibilityLabel={strings.jumpToPage}
        style={styles.indicator}
        hitSlop={6}
      >
        <View style={styles.indicatorOrnament}>
          <View style={styles.miniDot} />
          <Text style={styles.pageLabel}>{strings.pageOf(page, total)}</Text>
          <View style={styles.miniDot} />
        </View>
      </Pressable>

      {/* RIGHT = previous page (RTL backward) */}
      <Pressable
        onPress={onPrevious}
        disabled={disabledPrevious}
        accessibilityRole="button"
        accessibilityLabel={strings.previousPage}
        accessibilityState={{ disabled: disabledPrevious }}
        style={({ pressed }) => [
          styles.button,
          disabledPrevious && styles.buttonDisabled,
          pressed && !disabledPrevious && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonLabel} numberOfLines={1}>
          {strings.previousPage}
        </Text>
        <Chevron direction="right" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: READING.barBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,167,91,0.3)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: 'rgba(200,167,91,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(200,167,91,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: READING.gold,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonPressed: {
    backgroundColor: 'rgba(200,167,91,0.28)',
    transform: [{ scale: 0.97 }],
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(200,167,91,0.7)',
    transform: [{ rotate: '45deg' }],
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.cream,
  },
});
