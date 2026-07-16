import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MushafLine from './MushafLine';
import DecorativeSurahBanner from './DecorativeSurahBanner';
import BismillahLine from './BismillahLine';
import MushafPageContainer from './MushafPageContainer';
import { READING } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';
import type { MushafLine as MushafLineType, MushafPage } from '../../types/quran.types';
import { getSurahOpeningMeta, shouldRenderBismillah } from '../../utils/surahOpening';
import type { UIStrings } from '../../utils/strings';

interface MushafPageViewProps {
  page: MushafPage | null;
  pageNumber: number;
  fontSize: number;
  strings: UIStrings;
  onAyahPress?: (surahNumber: number, ayahNumber: number) => void;
}

/**
 * If this line begins a surah, return that surah number; otherwise null. The
 * page layout data drops the printed surah-name/Basmala lines, so a surah
 * start is the line whose first word is the very first word of ayah 1.
 */
function surahStartOf(line: MushafLineType): number | null {
  if (line.isSurahHeader || line.isBismillah) return null;
  const first = line.words[0];
  if (first && first.ayahNumber === 1 && first.wordNumber === 1) return first.surahNumber;
  return null;
}

/**
 * One Mushaf page rendered on the premium page shell: continuous justified
 * Uthmani lines, with a decorative banner + Basmala at each surah opening (no
 * per-ayah cards). Surah/Juz/page context now lives in the top info bar, so the
 * page itself stays calm and uncluttered. Falls back to a clear notice when a
 * page has no layout data yet.
 */
export default function MushafPageView({
  page,
  pageNumber,
  fontSize,
  strings,
  onAyahPress,
}: MushafPageViewProps) {
  return (
    <MushafPageContainer pageNumber={pageNumber}>
      {page ? (
        <ScrollView
          style={styles.linesScroll}
          contentContainerStyle={styles.linesWrap}
          showsVerticalScrollIndicator={false}
        >
          {page.lines.map((line) => {
            const start = surahStartOf(line);
            if (!start) {
              return (
                <MushafLine
                  key={line.lineNumber}
                  line={line}
                  fontSize={fontSize}
                  onAyahPress={onAyahPress}
                />
              );
            }
            // A new surah opens on this line: decorative banner, then a separate
            // Basmala (unless Al-Fatihah / At-Tawbah), then the first line.
            const meta = getSurahOpeningMeta(start);
            return (
              <View key={`start-${line.lineNumber}`} style={styles.openingGroup}>
                <DecorativeSurahBanner
                  surahNumber={meta.surahNumber}
                  surahNameArabic={meta.nameArabic}
                  ayahCount={meta.ayahCount}
                  revelationType={meta.revelationType}
                />
                {shouldRenderBismillah(start) && <BismillahLine fontSize={fontSize} />}
                <MushafLine line={line} fontSize={fontSize} onAyahPress={onAyahPress} />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.missingWrap}>
          <Text style={styles.missingIcon}>۞</Text>
          <Text style={styles.missingText}>{strings.mushafDataMissing}</Text>
        </View>
      )}
    </MushafPageContainer>
  );
}

const styles = StyleSheet.create({
  linesScroll: {
    flex: 1,
  },
  linesWrap: {
    // Fills the page when content is short (so lines spread like a real
    // Mushaf page), and scrolls when a page packs several short surahs.
    flexGrow: 1,
    justifyContent: 'space-evenly',
    gap: 2,
    paddingVertical: SPACING.xs,
  },
  openingGroup: {
    gap: SPACING.xs,
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
    color: READING.gold,
  },
  missingText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: READING.muted,
  },
});
