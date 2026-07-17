import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Icon from '../../src/components/basirah/Icon';
import {
  Chip,
  IconButton,
  Press,
  PrimaryButton,
  SegmentedTabs,
} from '../../src/components/basirah/primitives';
import { EmptyState } from '../../src/components/basirah/states';
import Txt from '../../src/components/basirah/Txt';
import { useUserData } from '../../src/hooks/useUserData';
import { FONT } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';
import type { LastReadingPosition, SurahListItem } from '../../src/types/quran.types';
import { TOTAL_MUSHAF_PAGES } from '../../src/types/quran.types';
import { getJuzStartPages } from '../../src/utils/juzPages';
import { stripSurahPrefix, toArabicDigits, toArabicPercent } from '../../src/utils/numerals';
import { getAyah, getSurahList } from '../../src/utils/quranDataLoader';
import { loadLastPosition } from '../../src/utils/storage';
import { getSurahOpeningMeta } from '../../src/utils/surahOpening';
import { normalizeText } from '../../src/utils/textNormalizer';

const TABS = ['السور', 'الأجزاء', 'الصفحات', 'العلامات'];
const FILTERS = ['الكل', 'مكية', 'مدنية'] as const;

/** 12-pointed medallion behind the surah number. */
function Medallion({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={44} height={44} viewBox="0 0 44 44" style={{ position: 'absolute' }}>
        <Path
          d="M22 3l4.5 3.2 5.5-.4 1.8 5.2 4.6 3-1.7 5.3 1.7 5.3-4.6 3-1.8 5.2-5.5-.4L22 41l-4.5-3.2-5.5.4-1.8-5.2-4.6-3 1.7-5.3-1.7-5.3 4.6-3 1.8-5.2 5.5.4z"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.2}
          opacity={0.55}
        />
      </Svg>
      {children}
    </View>
  );
}

export default function QuranIndexScreen() {
  const { colors } = useTheme();
  const { bookmarks } = useUserData();
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [lastPosition, setLastPosition] = useState<LastReadingPosition | null>(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    loadLastPosition().then(setLastPosition);
  }, []);

  const surahs = useMemo(() => getSurahList(), []);
  const juzStartPages = useMemo(() => getJuzStartPages(), []);

  const filteredSurahs = useMemo(() => {
    const q = normalizeText(query.trim());
    return surahs.filter((s) => {
      if (filter > 0) {
        const type = getSurahOpeningMeta(s.number).revelationType;
        if (filter === 1 && type !== 'meccan') return false;
        if (filter === 2 && type !== 'medinan') return false;
      }
      if (!q) return true;
      if (/^\d+$/.test(q)) return s.number === Number(q) || s.firstPage === Number(q);
      return normalizeText(s.nameArabic).includes(q) || s.nameEnglish.toLowerCase().includes(q);
    });
  }, [surahs, query, filter]);

  const openSurah = (s: SurahListItem) => {
    router.push({ pathname: '/reader', params: { page: String(s.firstPage) } });
  };

  const renderSurahRow = ({ item: s }: { item: SurahListItem }) => {
    const meta = getSurahOpeningMeta(s.number);
    const isLastRead = lastPosition?.surahNumber === s.number;
    const progress = isLastRead && lastPosition ? lastPosition.ayahNumber / Math.max(1, s.ayahCount) : 0;
    return (
      <Press
        onPress={() => openSurah(s)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Medallion>
          <Txt size={13} weight={700} color={colors.emerald} align="center">
            {toArabicDigits(s.number)}
          </Txt>
        </Medallion>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={18} weight={700} amiri color={colors.text} style={{ marginBottom: 3 }}>
            {stripSurahPrefix(s.nameArabic)}
          </Txt>
          <Txt size={11.5} color={colors.text2}>
            {meta.revelationType === 'medinan' ? 'مدنية' : 'مكية'} • {toArabicDigits(s.ayahCount)} آية
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {isLastRead ? (
            <View
              style={{
                backgroundColor: colors.goldTint,
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 8,
              }}
            >
              <Txt size={10} weight={600} color={colors.gold}>
                {toArabicPercent(progress)}
              </Txt>
            </View>
          ) : null}
          <Txt size={19} amiri color={colors.gold} style={{ opacity: 0.7 }}>
            ﴾{toArabicDigits(s.number)}﴿
          </Txt>
        </View>
      </Press>
    );
  };

  const header = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <Txt size={24} weight={700} color={colors.text}>
          القرآن الكريم
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="search" size={38} iconSize={18} label="بحث" onPress={() => searchRef.current?.focus()} />
          <IconButton icon="menu" size={38} iconSize={18} label="إعدادات" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 46,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          marginBottom: 16,
        }}
      >
        <Icon name="search" size={18} color={colors.text2} strokeWidth={1.8} />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم السورة أو رقم الصفحة"
          placeholderTextColor={colors.text2}
          style={{
            flex: 1,
            fontFamily: FONT.ui400,
            fontSize: 13,
            color: colors.text,
            textAlign: 'right',
            paddingVertical: 0,
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <SegmentedTabs items={TABS} active={tab} onChange={setTab} />
      </View>

      {tab === 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {FILTERS.map((f, i) => (
            <Chip key={f} label={f} active={filter === i} onPress={() => setFilter(i)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {tab === 0 ? (
        <FlatList
          data={filteredSurahs}
          keyExtractor={(s) => String(s.number)}
          renderItem={renderSurahRow}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={16}
          windowSize={9}
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View>
              {header}
              {tab === 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8 }}>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                    <Press
                      key={j}
                      onPress={() => {
                        const page = juzStartPages.get(j) ?? 1;
                        router.push({ pathname: '/reader', params: { page: String(page) } });
                      }}
                      style={{
                        flexBasis: '30%',
                        flexGrow: 1,
                        paddingVertical: 16,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Txt size={16} weight={700} color={colors.emerald} align="center">
                        {toArabicDigits(j)}
                      </Txt>
                      <Txt size={10} color={colors.text2} align="center">
                        الجزء
                      </Txt>
                    </Press>
                  ))}
                </View>
              ) : null}

              {tab === 2 ? (
                <View style={{ paddingTop: 8 }}>
                  <Txt size={12} color={colors.text2} style={{ marginBottom: 16 }}>
                    أدخل رقم الصفحة ({toArabicDigits(1)} - {toArabicDigits(TOTAL_MUSHAF_PAGES)})
                  </Txt>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      height: 54,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: colors.surface,
                      borderWidth: 1.5,
                      borderColor: colors.emerald,
                      marginBottom: 16,
                    }}
                  >
                    <TextInput
                      value={pageInput}
                      onChangeText={(t) => setPageInput(t.replace(/[^0-9٠-٩]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="٨"
                      placeholderTextColor={colors.text3}
                      style={{
                        flex: 1,
                        fontFamily: FONT.ui700,
                        fontSize: 16,
                        color: colors.text,
                        textAlign: 'right',
                        paddingVertical: 0,
                      }}
                    />
                    <Txt size={12} color={colors.text2}>
                      / {toArabicDigits(TOTAL_MUSHAF_PAGES)}
                    </Txt>
                  </View>
                  <PrimaryButton
                    title="انتقال"
                    height={50}
                    onPress={() => {
                      const western = pageInput.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                      const n = Number(western);
                      if (Number.isFinite(n) && n >= 1 && n <= TOTAL_MUSHAF_PAGES) {
                        router.push({ pathname: '/reader', params: { page: String(n) } });
                      }
                    }}
                  />
                </View>
              ) : null}

              {tab === 3 ? (
                bookmarks.length === 0 ? (
                  <EmptyState
                    icon="bookmark"
                    title="لم تحفظ أي آية بعد"
                    body="يمكنك الضغط على رمز العلامة أثناء القراءة للعودة إلى الآية لاحقًا."
                    ctaLabel="ابدأ القراءة"
                    onCta={() => router.push('/reader')}
                  />
                ) : (
                  <View style={{ gap: 10, paddingTop: 8 }}>
                    {bookmarks.map((b) => {
                      const ayah = getAyah(b.surahNumber, b.ayahNumber);
                      return (
                        <Press
                          key={b.id}
                          onPress={() => {
                            if (ayah) {
                              router.push({ pathname: '/reader', params: { page: String(ayah.page) } });
                            }
                          }}
                          style={{
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            padding: 13,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              backgroundColor: colors.goldTint,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="bookmark" size={16} color={colors.gold} filled />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt size={13} weight={700} color={colors.text}>
                              سورة {stripSurahPrefix(b.surahNameArabic)} • الآية {toArabicDigits(b.ayahNumber)}
                            </Txt>
                            {ayah ? (
                              <Txt size={11.5} color={colors.text2} numberOfLines={1}>
                                {ayah.textUthmani}
                              </Txt>
                            ) : null}
                          </View>
                          <Txt size={11} color={colors.text2}>
                            ص {toArabicDigits(ayah?.page ?? 0)}
                          </Txt>
                        </Press>
                      );
                    })}
                  </View>
                )
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
