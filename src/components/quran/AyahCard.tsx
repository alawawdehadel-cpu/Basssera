import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import QuranText from './QuranText';
import type { QuranAyah } from '../../types/quran.types';

interface AyahCardProps {
  ayah: QuranAyah;
  fontSize: number;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  highlighted?: boolean;
  /**
   * Uthmani text to display instead of `ayah.textUthmani` — used to show ayah 1
   * without its embedded Basmala (rendered separately as BismillahLine). Still
   * plain Uthmani text; nothing is normalized.
   */
  overrideText?: string;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.8-4.6 6.6-.9z"
        fill={filled ? COLORS.gold : 'none'}
        stroke={COLORS.gold}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** One ayah in the reader: Uthmani text, ayah-number medallion, bookmark toggle. */
export default function AyahCard({
  ayah,
  fontSize,
  bookmarked,
  onToggleBookmark,
  highlighted = false,
  overrideText,
}: AyahCardProps) {
  return (
    <View style={[styles.wrapper, highlighted && styles.wrapperHighlighted]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ayah.ayahNumber}</Text>
        </View>
        <Pressable
          onPress={onToggleBookmark}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.starButton}
        >
          <StarIcon filled={bookmarked} />
        </Pressable>
      </View>
      <QuranText variant="ayah" size={fontSize} align="right" color={COLORS.forest}>
        {overrideText ?? ayah.textUthmani}
      </QuranText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.25)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  wrapperHighlighted: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(178,138,62,0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.4)',
  },
  badgeText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  starButton: {
    padding: 4,
  },
});
