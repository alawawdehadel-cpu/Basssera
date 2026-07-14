import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { SurahListItem } from '../../types/quran.types';
import type { UIStrings } from '../../utils/strings';

interface SurahListRowProps {
  surah: SurahListItem;
  strings: UIStrings;
  onPress: () => void;
}

export default function SurahListRow({ surah, strings, onPress }: SurahListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{surah.number}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.nameArabic}>{surah.nameArabic}</Text>
        <Text style={styles.nameEnglish}>
          {surah.nameEnglish} · {strings.ayahCountSuffix(surah.ayahCount)}
        </Text>
      </View>
      <Text style={styles.chevron}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.25)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  rowPressed: {
    backgroundColor: COLORS.parchmentDeep,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.4)',
    flexShrink: 0,
  },
  badgeText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameArabic: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.forest,
  },
  nameEnglish: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  chevron: {
    fontSize: 20,
    color: 'rgba(178,138,62,0.6)',
  },
});
