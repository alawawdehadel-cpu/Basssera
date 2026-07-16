import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import LoadingState from '../../src/components/ui/LoadingState';
import QuranText from '../../src/components/quran/QuranText';
import { COLORS } from '../../src/constants/colors';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';
import { searchQuran } from '../../src/utils/quranSearch';
import type { QuranAyah } from '../../src/types/quran.types';

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

const DEBOUNCE_MS = 300;

export default function QuranSearchScreen() {
  const { lang, strings } = useAppLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuranAyah[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchQuran(query).then((r) => {
        setResults(r);
        setSearching(false);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ChevronIcon />
        </Pressable>
        <Text style={styles.title}>{strings.quranSearch}</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={strings.quranSearchPlaceholder}
          placeholderTextColor="rgba(95,106,99,0.6)"
          autoFocus
          style={styles.searchInput}
        />
      </View>

      {results.length > 0 && !searching && (
        <Text style={styles.resultsCount}>{strings.quranSearchResultsCount(results.length)}</Text>
      )}

      {searching ? (
        <LoadingState label={strings.quranSearch} />
      ) : query.trim().length < 2 ? (
        <Text style={styles.emptyText}>{strings.quranSearchEmpty}</Text>
      ) : results.length === 0 ? (
        <Text style={styles.emptyText}>{strings.quranSearchNoResults}</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/quran/mushaf/${item.page}`)}
              style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultSurah}>
                  {lang === 'ar' ? item.surahNameArabic : item.surahNameEnglish}
                </Text>
                <Text style={styles.resultAyahNumber}>#{item.ayahNumber}</Text>
              </View>
              <QuranText size={17} align="right" color={COLORS.forest} numberOfLines={3}>
                {item.textUthmani}
              </QuranText>
            </Pressable>
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
  searchBox: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.3)',
    backgroundColor: COLORS.cream,
  },
  searchInput: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
    color: COLORS.ink,
    textAlign: 'right',
  },
  resultsCount: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
    fontSize: 11,
    color: COLORS.inkSoft,
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
    paddingTop: SPACING.sm,
  },
  resultCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.25)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  resultCardPressed: {
    backgroundColor: COLORS.parchmentDeep,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  resultSurah: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldDeep,
  },
  resultAyahNumber: {
    fontSize: 11,
    color: COLORS.inkSoft,
  },
});
