import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../src/constants/colors';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';
import { getAyah } from '../../src/utils/quranDataLoader';
import { loadBookmarks, toggleBookmark } from '../../src/utils/storage';
import type { QuranBookmark } from '../../src/types/quran.types';

function ChevronIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path
        d="M15 18l-6-6 6-6"
        stroke={COLORS.goldDeep}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16}>
      <Path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"
        stroke={COLORS.goldDeep}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function BookmarksScreen() {
  const { lang, strings } = useAppLanguage();
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      loadBookmarks().then((list) => mounted && setBookmarks(list));
      return () => {
        mounted = false;
      };
    }, []),
  );

  const handleRemove = (bookmark: QuranBookmark) => {
    toggleBookmark(bookmark).then(setBookmarks);
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ChevronIcon />
        </Pressable>
        <Text style={styles.title}>{strings.bookmarksTitle}</Text>
      </View>

      {bookmarks.length === 0 ? (
        <Text style={styles.emptyText}>{strings.bookmarksEmpty}</Text>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => {
                  const page = getAyah(item.surahNumber, item.ayahNumber)?.page;
                  router.push(
                    page
                      ? `/quran/mushaf/${page}`
                      : `/quran/surah/${item.surahNumber}?ayah=${item.ayahNumber}`,
                  );
                }}
              >
                <Text style={styles.rowSurah}>
                  {lang === 'ar' ? item.surahNameArabic : item.surahNameEnglish}
                </Text>
                <Text style={styles.rowAyah}>#{item.ayahNumber}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRemove(item)}
                hitSlop={8}
                accessibilityLabel={strings.removeBookmark}
                style={styles.removeButton}
              >
                <TrashIcon />
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.forest,
  },
  emptyText: {
    marginTop: SPACING.xxl,
    marginHorizontal: SPACING.xl,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.inkSoft,
  },
  listContent: {
    padding: SPACING.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.25)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowSurah: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.forest,
  },
  rowAyah: {
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  removeButton: {
    padding: SPACING.xs,
  },
});
