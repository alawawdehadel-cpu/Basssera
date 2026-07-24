import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HadithResults from '../../src/components/basirah/hadith/HadithResults';
import Icon from '../../src/components/basirah/Icon';
import { AyahBadge, Chip, Press, SegmentedTabs } from '../../src/components/basirah/primitives';
import { useToast } from '../../src/components/basirah/Toast';
import Txt from '../../src/components/basirah/Txt';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';
import { useHadithSearch } from '../../src/hooks/useHadithSearch';
import { usePlayback, RECITERS } from '../../src/hooks/usePlayback';
import { useUserData } from '../../src/hooks/useUserData';
import { FONT } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';
import type { QuranAyah } from '../../src/types/quran.types';
import { formatNumber, stripSurahPrefix } from '../../src/utils/numerals';
import { getSurahMeta } from '../../src/utils/quranDataLoader';
import { searchQuran } from '../../src/utils/quranSearch';
import { normalizeText } from '../../src/utils/textNormalizer';

const SUGGESTED_KEYS = [
  'search.suggest.1',
  'search.suggest.2',
  'search.suggest.3',
  'search.suggest.4',
] as const;
const TOPIC_KEYS = [
  'search.topic.patience',
  'search.topic.mercy',
  'search.topic.repentance',
  'search.topic.provision',
  'search.topic.ethics',
  'search.topic.supplication',
] as const;
const RESULT_TAB_KEYS = [
  'search.tab.ayat',
  'search.tab.tafsir',
  'search.tab.topics',
  'search.tab.surahs',
  'hadith.tabLabel',
] as const;

/** Index of the hadith tab within RESULT_TAB_KEYS. */
const HADITH_TAB = 4;

/** Splits an ayah's text around the first match of `term` for <mark>-style highlight. */
function splitHighlight(text: string, term: string): [string, string, string] | null {
  const normTerm = normalizeText(term).trim();
  if (!normTerm) return null;
  // Walk the raw text, normalizing progressively to find the match window.
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 1) {
    if (normalizeText(words[i]).includes(normTerm)) {
      return [words.slice(0, i).join(''), words[i], words.slice(i + 1).join('')];
    }
  }
  return null;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const hadithSearch = useHadithSearch();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const { isBookmarked, toggleVerseBookmark } = useUserData();

  const [query, setQuery] = useState('');
  const [smartMode, setSmartMode] = useState(true);
  const [results, setResults] = useState<QuranAyah[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [resTab, setResTab] = useState(0);
  const [recents, setRecents] = useState<string[]>(['الرحمة', 'قصة يوسف', 'آيات الشفاء']);
  const inputRef = useRef<TextInput>(null);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setLoading(true);
    setResults(null);
    setResTab(0);
    setRecents((prev) => [term, ...prev.filter((r) => r !== term)].slice(0, 6));
    const found = await searchQuran(term);
    setResults(found);
    setLoading(false);
  }, []);

  // Deep-link from feature grid / assistant.
  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      runSearch(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  const submit = (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    if (q) setQuery(q);
    runSearch(term);
  };

  const searchTermWord = useMemo(() => {
    const toks = normalizeText(query).split(' ').filter((t) => t.length > 2);
    return toks[toks.length - 1] ?? query.trim();
  }, [query]);

  const showResults = results !== null || loading;

  /* --------------------------- results view --------------------------- */
  if (showResults) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ paddingHorizontal: LAYOUT.screenX, paddingTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              height: 48,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Press
              onPress={() => {
                setResults(null);
                setLoading(false);
              }}
              accessibilityLabel={t('common.back')}
            >
              <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
            </Press>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => submit()}
              returnKeyType="search"
              style={{
                flex: 1,
                fontFamily: FONT.ui600,
                fontSize: 13.5,
                color: colors.text,
                textAlign: 'right',
                paddingVertical: 0,
              }}
            />
            {smartMode ? <Icon name="spark" size={16} color={colors.gold} strokeWidth={1.8} /> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: LAYOUT.screenX, paddingVertical: 10 }}>
          <Txt size={12} color={colors.text2}>
            {loading ? t('search.searching') : t('search.resultsCount', { count: formatNumber(results?.length ?? 0) })}
          </Txt>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48 }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, gap: 8, paddingBottom: 14 }}
        >
          {RESULT_TAB_KEYS.map((key, i) => (
            <Chip
              key={key}
              label={t(key)}
              active={resTab === i}
              onPress={() => {
                setResTab(i);
                // Run the hadith search lazily, the first time the tab is opened.
                if (i === HADITH_TAB && query.trim()) hadithSearch.submit(query.trim());
              }}
              height={34}
            />
          ))}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 24, gap: 14 }}
        >
          {resTab === HADITH_TAB ? (
            <HadithResults search={hadithSearch} />
          ) : loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.emerald} />
            </View>
          ) : results && results.length > 0 ? (
            <>
              {results.slice(0, 30).map((r) => {
                const parts = splitHighlight(r.textUthmani, searchTermWord);
                const bm = isBookmarked(r.surahNumber, r.ayahNumber);
                return (
                  <View
                    key={r.id}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ padding: 16, paddingBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Txt size={12.5} weight={700} color={colors.emerald}>
                          {t('common.surah')} {stripSurahPrefix(r.surahNameArabic)}
                        </Txt>
                        <AyahBadge number={r.ayahNumber} size={24} />
                      </View>
                      <Txt size={18} lh={1.9} align="right" color={colors.readerText} style={{ fontFamily: FONT.quran }}>
                        {parts ? (
                          <>
                            {parts[0]}
                            <Txt size={18} color={colors.readerText} style={{ fontFamily: FONT.quran, backgroundColor: colors.goldTintStrong }}>
                              {parts[1]}
                            </Txt>
                            {parts[2]}
                          </>
                        ) : (
                          r.textUthmani
                        )}
                      </Txt>
                    </View>
                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
                      {[
                        {
                          label: t('search.open'),
                          color: colors.emerald,
                          onPress: () => router.push({ pathname: '/reader', params: { page: String(r.page) } }),
                        },
                        {
                          label: t('verse.listen'),
                          color: colors.text,
                          onPress: () => {
                            const meta = getSurahMeta(r.surahNumber);
                            startTrack({
                              surahNumber: r.surahNumber,
                              surahName: r.surahNameArabic,
                              ayahCount: meta?.ayahCount ?? 10,
                              reciter: RECITERS[1],
                            });
                            showToast(t('playback.starting'));
                          },
                        },
                        {
                          label: t('verse.tafsir'),
                          color: colors.text,
                          onPress: () =>
                            router.push({
                              pathname: '/tafsir',
                              params: { surah: String(r.surahNumber), ayah: String(r.ayahNumber) },
                            }),
                        },
                        {
                          label: t('verse.save'),
                          color: bm ? colors.gold : colors.text,
                          onPress: async () => {
                            const added = await toggleVerseBookmark({
                              id: `${r.surahNumber}:${r.ayahNumber}`,
                              surahNumber: r.surahNumber,
                              ayahNumber: r.ayahNumber,
                              surahNameArabic: r.surahNameArabic,
                              surahNameEnglish: r.surahNameEnglish,
                            });
                            showToast(added ? t('bookmark.added') : t('bookmark.removed'));
                          },
                        },
                      ].map((a, i) => (
                        <Press
                          key={a.label}
                          onPress={a.onPress}
                          style={{
                            flex: 1,
                            paddingVertical: 11,
                            alignItems: 'center',
                            borderLeftWidth: i < 3 ? 1 : 0,
                            borderLeftColor: colors.border,
                          }}
                        >
                          <Txt size={12} weight={600} color={a.color} align="center">
                            {a.label}
                          </Txt>
                        </Press>
                      ))}
                    </View>
                  </View>
                );
              })}

              {/* رحلة المعنى */}
              <View
                style={{
                  marginTop: 8,
                  borderRadius: 18,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="journey" size={18} color={colors.gold} strokeWidth={1.7} />
                  <Txt size={15} weight={700} color={colors.text}>
                    {t('search.meaningJourney')}
                  </Txt>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[searchTermWord, ...TOPIC_KEYS.slice(0, 4).map((k) => t(k))].map((m, i) => (
                    <Press
                      key={`${m}-${i}`}
                      onPress={() => submit(t('search.versesAbout', { topic: m }))}
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 13,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.bg,
                      }}
                    >
                      <Txt size={12} color={colors.text}>
                        {m}
                      </Txt>
                    </Press>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 26,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Icon name="search" size={26} color={colors.text3} strokeWidth={1.6} />
              </View>
              <Txt size={14} weight={700} color={colors.text} align="center" style={{ marginBottom: 6 }}>
                {t('search.noResults')}
              </Txt>
              <Txt size={12.5} lh={1.7} color={colors.text2} align="center">
                {t('search.noResultsBody')}
              </Txt>
              <Press
                onPress={() =>
                  router.push({ pathname: '/(tabs)/assistant', params: { ask: query } })
                }
                style={{
                  marginTop: 18,
                  flexDirection: 'row',
                  gap: 7,
                  alignItems: 'center',
                  height: 44,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  backgroundColor: colors.emerald,
                }}
              >
                <Icon name="spark" size={15} color="#DFC96C" strokeWidth={1.8} />
                <Txt size={13} weight={600} color="#fff">
                  {t('assistant.title')}
                </Txt>
              </Press>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------------------------- home view ---------------------------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingTop: 8, paddingBottom: 24 }}
      >
        <Txt size={24} weight={700} color={colors.text} style={{ marginVertical: 8 }}>
          {t('search.title')}
        </Txt>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 54,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.emerald,
            marginBottom: 14,
          }}
        >
          <Icon name="search" size={20} color={colors.emerald} strokeWidth={1.9} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit()}
            returnKeyType="search"
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.text2}
            style={{
              flex: 1,
              fontFamily: FONT.ui400,
              fontSize: 13.5,
              color: colors.text,
              textAlign: 'right',
              paddingVertical: 0,
            }}
          />
          <Press
            onPress={() => showToast(t('search.voiceUnavailable'))}
            accessibilityLabel={t('search.voiceLabel')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="mic" size={17} color={colors.emerald} strokeWidth={1.8} />
          </Press>
        </View>

        <View style={{ marginBottom: 26 }}>
          <SegmentedTabs
            items={[t('search.modeMatch'), t('search.modeSmart')]}
            active={smartMode ? 1 : 0}
            onChange={(i) => setSmartMode(i === 1)}
            height={40}
          />
        </View>

        <Txt size={15} weight={700} color={colors.text} style={{ marginBottom: 12 }}>
          {t('search.tryAsk')}
        </Txt>
        <View style={{ gap: 10, marginBottom: 26 }}>
          {SUGGESTED_KEYS.map((k) => (
            <Press
              key={k}
              onPress={() =>
                smartMode
                  ? router.push({ pathname: '/(tabs)/assistant', params: { ask: t(k) } })
                  : submit(t(k))
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="spark" size={16} color={colors.gold} strokeWidth={1.8} />
              <Txt size={13.5} color={colors.text} style={{ flex: 1 }}>
                {t(k)}
              </Txt>
            </Press>
          ))}
        </View>

        <Txt size={15} weight={700} color={colors.text} style={{ marginBottom: 12 }}>
          {t('search.recent')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
          {recents.map((r) => (
            <Press
              key={r}
              onPress={() => submit(r)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderRadius: 20,
                backgroundColor: colors.surface2,
              }}
            >
              <Icon name="clock" size={13} color={colors.text2} strokeWidth={1.8} />
              <Txt size={12.5} color={colors.text}>
                {r}
              </Txt>
            </Press>
          ))}
        </View>

        <Txt size={15} weight={700} color={colors.text} style={{ marginBottom: 12 }}>
          {t('search.popularTopics')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {TOPIC_KEYS.map((k) => (
            <Press
              key={k}
              onPress={() => submit(t('search.versesAbout', { topic: t(k) }))}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Txt size={13} weight={600} color={colors.text}>
                {t(k)}
              </Txt>
            </Press>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
