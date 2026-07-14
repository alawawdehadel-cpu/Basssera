import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import SurahListRow from '../../src/components/quran/SurahListRow';
import { COLORS } from '../../src/constants/colors';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';
import { getSurahList } from '../../src/utils/quranDataLoader';
import { normalizeText } from '../../src/utils/textNormalizer';
import type { SurahListItem } from '../../src/types/quran.types';

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

export default function SurahListScreen() {
  const { strings } = useAppLanguage();
  const [query, setQuery] = useState('');
  const surahs = useMemo(() => getSurahList(), []);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        normalizeText(s.nameArabic).includes(q) ||
        normalizeText(s.nameEnglish).includes(q) ||
        String(s.number).includes(q),
    );
  }, [surahs, query]);

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ChevronIcon />
        </Pressable>
        <Text style={styles.title}>{strings.surahListTitle}</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={strings.surahSearchPlaceholder}
          placeholderTextColor="rgba(95,106,99,0.6)"
          style={styles.searchInput}
        />
      </View>

      <FlatList<SurahListItem>
        data={filtered}
        keyExtractor={(s) => String(s.number)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <SurahListRow
            surah={item}
            strings={strings}
            onPress={() => router.push(`/quran/surah/${item.number}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
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
  listContent: {
    padding: SPACING.xl,
    paddingTop: SPACING.md,
  },
});
