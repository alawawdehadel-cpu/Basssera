import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AyahCard from '../../../src/components/quran/AyahCard';
import BismillahLine from '../../../src/components/quran/BismillahLine';
import FontSizeControl from '../../../src/components/quran/FontSizeControl';
import DecorativeSurahBanner from '../../../src/components/quran/DecorativeSurahBanner';
import { COLORS } from '../../../src/constants/colors';
import { RADIUS, SPACING } from '../../../src/constants/spacing';
import { useAppLanguage } from '../../../src/hooks/useAppLanguage';
import { getAyahsBySurah, getSurahMeta } from '../../../src/utils/quranDataLoader';
import { runQuranRenderCheck } from '../../../src/utils/quranRenderCheck';
import {
  getSurahOpeningMeta,
  shouldRenderBismillah,
  stripLeadingBismillah,
} from '../../../src/utils/surahOpening';
import {
  loadBookmarks,
  loadFontSize,
  saveFontSize,
  saveLastPosition,
  toggleBookmark,
} from '../../../src/utils/storage';
import type { QuranAyah, QuranBookmark } from '../../../src/types/quran.types';

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

export default function SurahReaderScreen() {
  const { strings } = useAppLanguage();
  const params = useLocalSearchParams<{ number: string; ayah?: string }>();
  const surahNumber = Number(params.number);
  const targetAyah = params.ayah ? Number(params.ayah) : null;

  const listRef = useRef<FlatList<QuranAyah>>(null);
  const [fontSize, setFontSize] = useState(26);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(
    surahNumber && targetAyah ? `${surahNumber}:${targetAyah}` : null,
  );

  const ayahs = useMemo(() => getAyahsBySurah(surahNumber), [surahNumber]);
  const meta = useMemo(() => getSurahMeta(surahNumber), [surahNumber]);
  const openingMeta = useMemo(() => getSurahOpeningMeta(surahNumber), [surahNumber]);
  const renderBismillah = shouldRenderBismillah(surahNumber);

  // Dev-only: confirm the reader renders Uthmani text with the Quran font.
  useEffect(() => {
    runQuranRenderCheck(ayahs, true);
  }, [ayahs]);

  useEffect(() => {
    let mounted = true;
    loadFontSize().then((s) => mounted && setFontSize(s));
    loadBookmarks().then((list) => mounted && setBookmarkIds(new Set(list.map((b) => b.id))));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!targetAyah || ayahs.length === 0) return;
    const index = ayahs.findIndex((a) => a.ayahNumber === targetAyah);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAyah, ayahs.length]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: true,
      });
    },
    [],
  );

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    saveFontSize(size);
  }, []);

  const handleToggleBookmark = useCallback(
    (ayah: QuranAyah) => {
      const bookmark: QuranBookmark = {
        id: ayah.id,
        surahNumber: ayah.surahNumber,
        ayahNumber: ayah.ayahNumber,
        surahNameArabic: ayah.surahNameArabic,
        surahNameEnglish: ayah.surahNameEnglish,
        createdAt: Date.now(),
      };
      toggleBookmark(bookmark).then((list) => setBookmarkIds(new Set(list.map((b) => b.id))));
    },
    [],
  );

  // Persist the topmost visible ayah as the last reading position.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable)?.item as QuranAyah | undefined;
      if (!first) return;
      saveLastPosition({
        surahNumber: first.surahNumber,
        ayahNumber: first.ayahNumber,
        surahNameArabic: first.surahNameArabic,
        surahNameEnglish: first.surahNameEnglish,
        updatedAt: Date.now(),
      });
      if (highlightedId) setHighlightedId(null);
    },
  ).current;

  if (!meta || ayahs.length === 0) {
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{strings.quranDataError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <ChevronIcon />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>{meta.nameArabic}</Text>
            <Text style={styles.headerSubtitle}>
              {meta.nameEnglish} · {strings.ayahCountSuffix(meta.ayahCount)}
            </Text>
          </View>
          <FontSizeControl size={fontSize} onChange={handleFontSizeChange} strings={strings} />
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={ayahs}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.opening}>
            <DecorativeSurahBanner
              surahNumber={surahNumber}
              surahNameArabic={openingMeta.nameArabic}
              ayahCount={openingMeta.ayahCount}
              revelationType={openingMeta.revelationType}
            />
            {renderBismillah && <BismillahLine fontSize={fontSize} />}
          </View>
        }
        renderItem={({ item, index }) => (
          <AyahCard
            ayah={item}
            fontSize={fontSize}
            bookmarked={bookmarkIds.has(item.id)}
            onToggleBookmark={() => handleToggleBookmark(item)}
            highlighted={highlightedId === item.id}
            // Ayah 1 embeds the Basmala in this dataset; show it once as the
            // separate BismillahLine above and drop the prefix here.
            overrideText={
              index === 0 && renderBismillah ? stripLeadingBismillah(item.textUthmani) : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />

      <Text style={styles.footerNote} numberOfLines={1}>
        {strings.pageLabel} {meta.firstPage}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  header: {
    backgroundColor: COLORS.forest,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleX: -1 }],
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: 'rgba(230,214,174,0.9)',
  },
  listContent: {
    padding: SPACING.lg,
  },
  opening: {
    marginBottom: SPACING.md,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10.5,
    color: COLORS.inkSoft,
    paddingVertical: SPACING.xs,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  notFoundText: {
    fontSize: 14,
    color: COLORS.inkSoft,
    textAlign: 'center',
  },
});
