import { StyleSheet, Text, View } from 'react-native';
import MushafLine from './MushafLine';
import MushafPageHeader from './MushafPageHeader';
import { COLORS } from '../../constants/colors';
import { RADIUS, SPACING } from '../../constants/spacing';
import type { MushafPage } from '../../types/quran.types';
import type { UIStrings } from '../../utils/strings';

interface MushafPageViewProps {
  page: MushafPage | null;
  pageNumber: number;
  fontSize: number;
  strings: UIStrings;
  onAyahPress?: (surahNumber: number, ayahNumber: number) => void;
}

/**
 * One Mushaf page: cream "paper" surface, gold ornamental border, dark
 * green surah/juz banner, then continuous justified Uthmani lines — no
 * per-ayah cards, no artificial spacing. Falls back to a clear "layout
 * data not added yet" notice when this page hasn't been populated in
 * mushaf-pages.json (see src/data/quran/README.md).
 */
export default function MushafPageView({
  page,
  pageNumber,
  fontSize,
  strings,
  onAyahPress,
}: MushafPageViewProps) {
  return (
    <View style={styles.paper}>
      <View style={styles.innerBorder}>
        {page ? (
          <>
            <MushafPageHeader surahs={page.surahs} juz={page.juz} strings={strings} />
            <View style={styles.linesWrap}>
              {page.lines.map((line) => (
                <MushafLine
                  key={line.lineNumber}
                  line={line}
                  fontSize={fontSize}
                  onAyahPress={onAyahPress}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.missingWrap}>
            <Text style={styles.missingIcon}>۞</Text>
            <Text style={styles.missingText}>{strings.mushafDataMissing}</Text>
          </View>
        )}

        <Text style={styles.pageNumber}>{pageNumber}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    flex: 1,
    backgroundColor: COLORS.parchment,
    padding: SPACING.md,
  },
  innerBorder: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.cream,
    padding: SPACING.lg,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  linesWrap: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 2,
  },
  pageNumber: {
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldDeep,
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  missingIcon: {
    fontSize: 28,
    color: COLORS.gold,
  },
  missingText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.inkSoft,
  },
});
