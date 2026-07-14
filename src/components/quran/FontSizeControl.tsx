import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import { MAX_QURAN_FONT_SIZE, MIN_QURAN_FONT_SIZE } from '../../utils/storage';
import type { UIStrings } from '../../utils/strings';

interface FontSizeControlProps {
  size: number;
  onChange: (size: number) => void;
  strings: UIStrings;
}

const STEP = 2;

export default function FontSizeControl({ size, onChange, strings }: FontSizeControlProps) {
  const decrease = () => onChange(Math.max(MIN_QURAN_FONT_SIZE, size - STEP));
  const increase = () => onChange(Math.min(MAX_QURAN_FONT_SIZE, size + STEP));

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={decrease}
        disabled={size <= MIN_QURAN_FONT_SIZE}
        accessibilityLabel={strings.decreaseFontSize}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>–</Text>
      </Pressable>
      <Text style={styles.value}>{size}</Text>
      <Pressable
        onPress={increase}
        disabled={size >= MAX_QURAN_FONT_SIZE}
        accessibilityLabel={strings.increaseFontSize}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,253,246,0.25)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: 'rgba(255,253,246,0.15)',
  },
  btnText: {
    color: COLORS.cream,
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
  },
  value: {
    minWidth: 20,
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '600',
  },
});
