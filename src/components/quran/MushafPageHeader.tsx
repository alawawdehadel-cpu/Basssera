import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { UIStrings } from '../../utils/strings';

interface MushafPageHeaderProps {
  surahs: string[];
  juz: number | null;
  strings: UIStrings;
}

export default function MushafPageHeader({ surahs, juz, strings }: MushafPageHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.surahs} numberOfLines={1}>
        {surahs.length > 0 ? `سورة ${surahs.join(' / ')}` : ''}
      </Text>
      {juz !== null && (
        <View style={styles.juzBadge}>
          <Text style={styles.juzText}>
            {strings.juzLabel} {juz}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  surahs: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gold,
  },
  juzBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.5)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  juzText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.cream,
  },
});
