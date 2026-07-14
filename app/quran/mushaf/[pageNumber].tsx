import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert as RNAlert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import MushafPageView from '../../../src/components/quran/MushafPageView';
import MushafPageNavigation from '../../../src/components/quran/MushafPageNavigation';
import FontSizeControl from '../../../src/components/quran/FontSizeControl';
import { COLORS } from '../../../src/constants/colors';
import { RADIUS, SPACING } from '../../../src/constants/spacing';
import { useAppLanguage } from '../../../src/hooks/useAppLanguage';
import {
  getMushafPage,
  getMushafValidation,
  getNextPage,
  getPreviousPage,
  getTotalMushafPages,
} from '../../../src/utils/mushafLayout';
import { getSurahMeta } from '../../../src/utils/quranDataLoader';
import {
  loadFontSize,
  loadMushafPageBookmarks,
  saveFontSize,
  saveLastMushafPage,
  toggleBookmark,
  toggleMushafPageBookmark,
} from '../../../src/utils/storage';

function ChevronIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path
        d="M15 18l-6-6 6-6"
        stroke={COLORS.cream}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
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

export default function MushafReaderScreen() {
  const { strings } = useAppLanguage();
  const params = useLocalSearchParams<{ pageNumber: string }>();
  const pageNumber = Math.min(Math.max(1, Number(params.pageNumber) || 1), getTotalMushafPages());

  const [fontSize, setFontSize] = useState(26);
  const [bookmarked, setBookmarked] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [showJump, setShowJump] = useState(false);

  const total = getTotalMushafPages();
  const page = useMemo(() => getMushafPage(pageNumber), [pageNumber]);
  const validation = useMemo(() => getMushafValidation(), []);

  useEffect(() => {
    let mounted = true;
    loadFontSize().then((s) => mounted && setFontSize(s));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    saveLastMushafPage(pageNumber);
    let mounted = true;
    loadMushafPageBookmarks().then(
      (list) => mounted && setBookmarked(list.some((b) => b.pageNumber === pageNumber)),
    );
    return () => {
      mounted = false;
    };
  }, [pageNumber]);

  const goToPage = useCallback(
    (n: number) => {
      if (n < 1 || n > total) return;
      router.replace(`/quran/mushaf/${n}`);
    },
    [total],
  );

  const handleNext = useCallback(() => {
    const next = getNextPage(pageNumber);
    if (next) goToPage(next);
  }, [pageNumber, goToPage]);

  const handlePrevious = useCallback(() => {
    const prev = getPreviousPage(pageNumber);
    if (prev) goToPage(prev);
  }, [pageNumber, goToPage]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    saveFontSize(size);
  }, []);

  const handleTogglePageBookmark = useCallback(() => {
    toggleMushafPageBookmark(pageNumber).then((list) =>
      setBookmarked(list.some((b) => b.pageNumber === pageNumber)),
    );
  }, [pageNumber]);

  const handleAyahPress = useCallback((surahNumber: number, ayahNumber: number) => {
    const meta = getSurahMeta(surahNumber);
    if (!meta) return;
    toggleBookmark({
      id: `${surahNumber}:${ayahNumber}`,
      surahNumber,
      ayahNumber,
      surahNameArabic: meta.nameArabic,
      surahNameEnglish: meta.nameEnglish,
      createdAt: Date.now(),
    }).then(() => {
      RNAlert.alert('', strings.pageBookmarked);
    });
  }, [strings]);

  const handleJumpSubmit = () => {
    const n = Number(jumpValue);
    if (!Number.isFinite(n) || n < 1 || n > total) {
      RNAlert.alert('', strings.invalidPageNumber(total));
      return;
    }
    setShowJump(false);
    setJumpValue('');
    goToPage(n);
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconButton}>
            <ChevronIcon />
          </Pressable>
          <Text style={styles.headerTitle}>{strings.mushafMode}</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleTogglePageBookmark}
              hitSlop={8}
              accessibilityLabel={strings.bookmarkPage}
              style={styles.iconButton}
            >
              <StarIcon filled={bookmarked} />
            </Pressable>
            <Pressable
              onPress={() => setShowJump((v) => !v)}
              hitSlop={8}
              accessibilityLabel={strings.jumpToPage}
              style={styles.iconButton}
            >
              <Text style={styles.jumpIcon}>#</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerRow}>
          <FontSizeControl size={fontSize} onChange={handleFontSizeChange} strings={strings} />
        </View>

        {showJump && (
          <View style={styles.jumpRow}>
            <TextInput
              value={jumpValue}
              onChangeText={setJumpValue}
              placeholder={strings.jumpToPagePlaceholder}
              placeholderTextColor="rgba(255,253,246,0.5)"
              keyboardType="number-pad"
              style={styles.jumpInput}
              onSubmitEditing={handleJumpSubmit}
            />
            <Pressable onPress={handleJumpSubmit} style={styles.jumpGoButton}>
              <Text style={styles.jumpGoText}>{strings.go}</Text>
            </Pressable>
          </View>
        )}

        {validation.status === 'partial' && (
          <Text style={styles.partialNote}>
            {strings.mushafDataPartialNote(validation.pagesLoaded, validation.expected)}
          </Text>
        )}
      </View>

      <MushafPageView
        page={page}
        pageNumber={pageNumber}
        fontSize={fontSize}
        strings={strings}
        onAyahPress={handleAyahPress}
      />

      <MushafPageNavigation
        page={pageNumber}
        total={total}
        onPrevious={handlePrevious}
        onNext={handleNext}
        strings={strings}
        disabledPrevious={pageNumber <= 1}
        disabledNext={pageNumber >= total}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.forest,
  },
  header: {
    backgroundColor: COLORS.forest,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.cream,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  jumpIcon: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  jumpRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  jumpInput: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,253,246,0.3)',
    color: COLORS.cream,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    textAlign: 'center',
  },
  jumpGoButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  jumpGoText: {
    color: COLORS.forestDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  partialNote: {
    fontSize: 10.5,
    color: 'rgba(230,214,174,0.85)',
    textAlign: 'center',
  },
});
