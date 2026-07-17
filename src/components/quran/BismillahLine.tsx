import { StyleSheet, View } from 'react-native';
import { READING } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';
import QuranText from './QuranText';

interface BismillahLineProps {
  /** Reading font size; the Basmala is drawn a touch larger than body ayahs. */
  fontSize?: number;
}

/** Uthmani Basmala — a reading-only UI element, never sourced from quran.json. */
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

/**
 * The decorative Basmala shown at the top of a surah (except Al-Fatihah, where
 * it is ayah 1, and At-Tawbah, which has none). Centered, in the Quran font,
 * under a slim gold rule with a small centered diamond — calm and unboxed. It
 * is NOT an ayah: no number, no medallion, not counted, not tappable.
 */
export default function BismillahLine({ fontSize = 24 }: BismillahLineProps) {
  return (
    <View style={styles.wrapper} accessibilityRole="text">
      <View style={styles.divider}>
        <View style={styles.rule} />
        <View style={styles.diamond} />
        <View style={styles.rule} />
      </View>
      <QuranText variant="bismillah" size={fontSize} align="center" color={READING.ink}>
        {BISMILLAH}
      </QuranText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  rule: {
    width: 54,
    height: 1,
    backgroundColor: 'rgba(200,167,91,0.5)',
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: READING.gold,
    transform: [{ rotate: '45deg' }],
  },
});
