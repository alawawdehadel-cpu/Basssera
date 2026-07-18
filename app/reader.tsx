import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '../src/components/basirah/BottomSheet';
import Icon from '../src/components/basirah/Icon';
import {
  PillSwitch,
  Press,
  PrimaryButton,
  SegmentedTabs,
} from '../src/components/basirah/primitives';
import { useToast } from '../src/components/basirah/Toast';
import Txt from '../src/components/basirah/Txt';
import VerseActionSheet from '../src/components/basirah/VerseActionSheet';
import MushafPage from '../src/components/basirah/mushaf/MushafPage';
import { usePlayback, RECITERS } from '../src/hooks/usePlayback';
import { FONT_STEP_LABELS, useSettings } from '../src/hooks/useSettings';
import { useUserData } from '../src/hooks/useUserData';
import { FONT } from '../src/theme/fonts';
import { useTheme } from '../src/theme/ThemeContext';
import type { MushafLine, QuranAyah, SurahListItem } from '../src/types/quran.types';
import { TOTAL_MUSHAF_PAGES } from '../src/types/quran.types';
import { getJuzStartPages } from '../src/utils/juzPages';
import { getJuzOnMushafPage, getMushafPage } from '../src/utils/mushafLayout';
import { stripSurahPrefix, toArabicDigits } from '../src/utils/numerals';
import { getAyah, getSurahList, loadQuranData } from '../src/utils/quranDataLoader';
import { loadLastMushafPage, loadReadingMode, saveLastMushafPage, saveLastPosition, saveReadingMode } from '../src/utils/storage';
import { getSurahOpeningMeta, shouldRenderBismillah, stripLeadingBismillah } from '../src/utils/surahOpening';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

type SheetKind = 'surah' | 'juz' | 'page' | 'readSettings' | null;

function surahStartOf(line: MushafLine): number | null {
  if (line.isSurahHeader || line.isBismillah) return null;
  const first = line.words[0];
  if (first && first.ayahNumber === 1 && first.wordNumber === 1) return first.surahNumber;
  return null;
}

/** Decorative surah opening: name, gold rule, meta line. */
function SurahHeader({ surahNumber }: { surahNumber: number }) {
  const { colors } = useTheme();
  const meta = getSurahOpeningMeta(surahNumber);
  return (
    <View style={{ alignItems: 'center', marginBottom: 14, marginTop: 6 }}>
      <Txt size={22} weight={700} amiri color={colors.emerald} align="center">
        {meta.nameArabic.startsWith('سورة') || meta.nameArabic.startsWith('سُورَةُ')
          ? meta.nameArabic
          : `سُورَةُ ${meta.nameArabic}`}
      </Txt>
      <View style={{ width: 60, height: 2, borderRadius: 1, backgroundColor: colors.gold, marginVertical: 8 }} />
      <Txt size={10} color={colors.text3} align="center">
        {meta.revelationType === 'medinan' ? 'مدنية' : 'مكية'}
        {meta.ayahCount ? ` • ${toArabicDigits(meta.ayahCount)} آية` : ''}
      </Txt>
    </View>
  );
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ page?: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const { quranFontSize, fontStep, setFontStep, keepAwake, toggleFlag } = useSettings();
  const { logReading, markWirdPage } = useUserData();

  const [page, setPage] = useState<number | null>(null);
  const [mode, setMode] = useState<'mushaf' | 'reading'>('mushaf');
  const [focus, setFocus] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [selectedVerse, setSelectedVerse] = useState<QuranAyah | null>(null);
  const [pageInput, setPageInput] = useState('');
  const [allAyahs, setAllAyahs] = useState<QuranAyah[]>([]);
  const pageAnim = useRef(new Animated.Value(1)).current;

  // Initial page: route param, else last saved position, else page 1.
  useEffect(() => {
    const fromParam = Number(params.page);
    if (Number.isFinite(fromParam) && fromParam >= 1 && fromParam <= TOTAL_MUSHAF_PAGES) {
      setPage(fromParam);
    } else {
      loadLastMushafPage().then((p) => setPage(p?.pageNumber ?? 1));
    }
    loadReadingMode().then((m) => setMode(m === 'surah' ? 'reading' : 'mushaf'));
    loadQuranData().then(setAllAyahs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep screen awake while reading (user setting).
  useEffect(() => {
    if (!keepAwake) return undefined;
    activateKeepAwakeAsync().catch(() => {});
    return () => {
      try {
        deactivateKeepAwake();
      } catch {
        /* ignore */
      }
    };
  }, [keepAwake]);

  const mushafPage = page ? getMushafPage(page) : null;
  const juz = page ? getJuzOnMushafPage(page) : null;

  const pageAyahs = useMemo(
    () => (page ? allAyahs.filter((a) => a.page === page) : []),
    [allAyahs, page],
  );

  const currentSurahNumber =
    mushafPage?.lines.find((l) => l.words.length > 0)?.words[0]?.surahNumber ??
    pageAyahs[0]?.surahNumber ??
    1;
  const currentSurahName =
    getAyah(currentSurahNumber, 1)?.surahNameArabic ?? pageAyahs[0]?.surahNameArabic ?? '';

  // Persist progress whenever the page settles.
  useEffect(() => {
    if (!page) return;
    saveLastMushafPage(page);
    markWirdPage(page);
    const first = pageAyahs[0];
    if (first) {
      saveLastPosition({
        surahNumber: first.surahNumber,
        ayahNumber: first.ayahNumber,
        surahNameArabic: first.surahNameArabic,
        surahNameEnglish: first.surahNameEnglish,
        updatedAt: Date.now(),
      });
      logReading({
        surahNumber: first.surahNumber,
        surahName: first.surahNameArabic,
        page,
        ayahNumber: first.ayahNumber,
      });
    }
  }, [page, pageAyahs, logReading, markWirdPage]);

  const turnPage = useCallback(
    (next: number) => {
      if (next < 1 || next > TOTAL_MUSHAF_PAGES) return;
      Animated.sequence([
        Animated.timing(pageAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(pageAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setPage(next), 120);
    },
    [pageAnim],
  );

  const openVerse = useCallback(
    (surahNumber: number, ayahNumber: number) => {
      const ayah = getAyah(surahNumber, ayahNumber);
      if (ayah) setSelectedVerse(ayah);
    },
    [],
  );

  const setModePersist = (i: number) => {
    const next = i === 0 ? 'mushaf' : 'reading';
    setMode(next);
    saveReadingMode(next === 'reading' ? 'surah' : 'mushaf');
  };

  const surahList = useMemo(() => getSurahList(), []);
  const juzStartPages = useMemo(() => getJuzStartPages(), []);

  const selectedKey = selectedVerse ? `${selectedVerse.surahNumber}:${selectedVerse.ayahNumber}` : '';

  /* ------------------------------------------------------------------ */
  /* Page content                                                        */
  /* ------------------------------------------------------------------ */

  const renderMushafLines = () => {
    if (!mushafPage) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Txt size={26} color={colors.gold} align="center">
            ۞
          </Txt>
          <Txt size={13} lh={1.8} color={colors.text2} align="center">
            بيانات تخطيط هذه الصفحة غير متوفرة بعد. يعرض المصحف صفحاتٍ بتخطيطٍ حقيقي من مصدر موثّق فقط.
          </Txt>
        </View>
      );
    }
    const lineFont = Math.min(quranFontSize, 27);
    return (
      <View style={{ gap: 2 }}>
        {mushafPage.lines.map((line) => {
          const start = surahStartOf(line);
          const lineText = (
            <Text
              key={`l-${line.lineNumber}`}
              {...(Platform.OS === 'web' ? {} : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 })}
              style={{
                fontFamily: FONT.quran,
                fontSize: line.isBismillah ? lineFont * 0.9 : lineFont,
                lineHeight: lineFont * 1.95,
                color: colors.readerText,
                textAlign: 'center',
                writingDirection: 'rtl',
                ...(Platform.OS === 'web' ? ({ wordSpacing: `${lineFont * 0.14}px` } as object) : null),
              }}
            >
              {line.isBismillah
                ? line.text
                : line.words.map((w, i) => {
                    const isSelected = selectedKey === `${w.surahNumber}:${w.ayahNumber}`;
                    return (
                      <Text
                        key={`${w.surahNumber}-${w.ayahNumber}-${w.wordNumber}-${i}`}
                        onPress={() => openVerse(w.surahNumber, w.ayahNumber)}
                        style={isSelected ? { backgroundColor: colors.goldTintStrong, borderRadius: 6 } : undefined}
                      >
                        {w.textUthmani}
                        {w.isAyahEnd ? (
                          <Text style={{ color: colors.gold }}>
                            {' '}۝{toArabicDigits(w.ayahNumber)}{' '}
                          </Text>
                        ) : (
                          ' '
                        )}
                      </Text>
                    );
                  })}
            </Text>
          );
          if (!start) return lineText;
          return (
            <View key={`s-${line.lineNumber}`}>
              <SurahHeader surahNumber={start} />
              {shouldRenderBismillah(start) ? (
                <Text
                  style={{
                    fontFamily: FONT.quran,
                    fontSize: lineFont * 0.92,
                    lineHeight: lineFont * 1.9,
                    color: colors.readerText,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                    marginBottom: 4,
                  }}
                >
                  {BISMILLAH}
                </Text>
              ) : null}
              {lineText}
            </View>
          );
        })}
      </View>
    );
  };

  const renderReadingFlow = () => {
    if (pageAyahs.length === 0) {
      return (
        <Txt size={13} lh={1.8} color={colors.text2} align="center" style={{ paddingVertical: 40 }}>
          لا تتوفر بيانات هذه الصفحة.
        </Txt>
      );
    }
    // Split into chunks at surah openings so headers sit between flows.
    const chunks: { surahStart: number | null; ayahs: QuranAyah[] }[] = [];
    for (const a of pageAyahs) {
      if (a.ayahNumber === 1) chunks.push({ surahStart: a.surahNumber, ayahs: [a] });
      else if (chunks.length === 0) chunks.push({ surahStart: null, ayahs: [a] });
      else chunks[chunks.length - 1].ayahs.push(a);
    }
    return (
      <View style={{ gap: 10 }}>
        {chunks.map((chunk, ci) => (
          <View key={ci}>
            {chunk.surahStart ? (
              <>
                <SurahHeader surahNumber={chunk.surahStart} />
                {shouldRenderBismillah(chunk.surahStart) ? (
                  <Text
                    style={{
                      fontFamily: FONT.quran,
                      fontSize: quranFontSize * 0.92,
                      lineHeight: quranFontSize * 1.9,
                      color: colors.readerText,
                      textAlign: 'center',
                      writingDirection: 'rtl',
                      marginBottom: 6,
                    }}
                  >
                    {BISMILLAH}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Text
              style={{
                fontFamily: FONT.quran,
                fontSize: quranFontSize,
                lineHeight: quranFontSize * (2 + fontStep * 0.06),
                color: colors.readerText,
                textAlign: 'justify',
                writingDirection: 'rtl',
              }}
            >
              {chunk.ayahs.map((a) => {
                const isSelected = selectedKey === `${a.surahNumber}:${a.ayahNumber}`;
                const display =
                  a.ayahNumber === 1 && a.surahNumber !== 1
                    ? stripLeadingBismillah(a.textUthmani)
                    : a.textUthmani;
                return (
                  <Text
                    key={a.id}
                    onPress={() => openVerse(a.surahNumber, a.ayahNumber)}
                    style={isSelected ? { backgroundColor: colors.goldTintStrong, borderRadius: 6 } : undefined}
                  >
                    {display}
                    <Text style={{ color: colors.gold }}> ۝{toArabicDigits(a.ayahNumber)} </Text>
                  </Text>
                );
              })}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (!page) {
    return <View style={{ flex: 1, backgroundColor: colors.readerPaper }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: focus ? colors.readerPaper : colors.surface }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, backgroundColor: colors.readerPaper }}>
        {/* top bar */}
        {!focus ? (
          <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Press
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/quran'))}
                accessibilityLabel="رجوع"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
              </Press>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Press
                  onPress={() => setSheet('surah')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: colors.surface2,
                    borderRadius: 10,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                  }}
                >
                  <Txt size={15} weight={700} amiri color={colors.text}>
                    {currentSurahName}
                  </Txt>
                  <Icon name="chevronDown" size={12} color={colors.text} strokeWidth={2} />
                </Press>
                <Press
                  onPress={() => setSheet('juz')}
                  style={{ backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11 }}
                >
                  <Txt size={11.5} weight={600} color={colors.text2}>
                    الجزء {toArabicDigits(juz ?? 0)}
                  </Txt>
                </Press>
                <Press
                  onPress={() => setSheet('page')}
                  style={{ backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11 }}
                >
                  <Txt size={11.5} weight={600} color={colors.text2}>
                    ص {toArabicDigits(page)}
                  </Txt>
                </Press>
              </View>
              <Press
                onPress={() => setSheet('readSettings')}
                accessibilityLabel="خيارات"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="dots" size={20} color={colors.text} />
              </Press>
            </View>
            <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
              <SegmentedTabs items={['المصحف', 'وضع القراءة']} active={mode === 'mushaf' ? 0 : 1} onChange={setModePersist} height={34} />
            </View>
          </View>
        ) : null}

        {/* reading surface */}
        <Pressable style={{ flex: 1 }} onPress={() => setFocus((f) => !f)}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 22 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: pageAnim,
                transform: [
                  { translateX: pageAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
                ],
              }}
            >
              {mode === 'mushaf' && mushafPage ? (
                <MushafPage
                  page={mushafPage}
                  fontStep={fontStep}
                  selectedKey={selectedKey}
                  onAyahPress={openVerse}
                />
              ) : (
                <View
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.gold,
                    borderRadius: 16,
                    padding: 8,
                  }}
                >
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 11,
                      paddingVertical: 18,
                      paddingHorizontal: 16,
                    }}
                  >
                    {mode === 'mushaf' ? renderMushafLines() : renderReadingFlow()}
                    <View
                      style={{
                        marginTop: 18,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderStyle: 'dashed',
                        borderTopColor: colors.border,
                      }}
                    >
                      <Txt size={9.5} color={colors.text3} align="center">
                        النص القرآني معروض من مصدر معتمد (نسخة عثمانية موثّقة)
                      </Txt>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </Pressable>

        {/* focus hint */}
        {focus ? (
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,.5)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 }}>
              <Txt size={11} color="#fff" align="center">
                اضغط لإظهار الأدوات
              </Txt>
            </View>
          </View>
        ) : null}

        {/* bottom bars */}
        {!focus ? (
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Txt size={11} color={colors.text3} align="center">
                الصفحة {toArabicDigits(page)}
              </Txt>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 22,
                paddingTop: 4,
                paddingBottom: 14,
              }}
            >
              <Press
                onPress={() => turnPage(page + 1)}
                accessibilityLabel="الصفحة التالية"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="chevronForward" size={20} color={colors.text} strokeWidth={1.9} />
              </Press>
              <Press
                onPress={() => setSheet('readSettings')}
                accessibilityLabel="حجم الخط"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={15} weight={700} color={colors.text} align="center">
                  أ
                </Txt>
              </Press>
              <Press
                onPress={() => {
                  const meta = getSurahOpeningMeta(currentSurahNumber);
                  startTrack({
                    surahNumber: currentSurahNumber,
                    surahName: currentSurahName.replace(/^سُورَةُ\s*/, ''),
                    ayahCount: meta.ayahCount ?? 10,
                    reciter: RECITERS[1],
                  });
                  showToast('جارٍ التشغيل');
                }}
                accessibilityLabel="تشغيل التلاوة"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: colors.emerald,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.emerald,
                  shadowOpacity: 0.45,
                  shadowRadius: 11,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                }}
              >
                <Icon name="play" size={22} color="#fff" />
              </Press>
              <Press
                onPress={() => setSheet('readSettings')}
                accessibilityLabel="إعدادات القراءة"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="sliders" size={20} color={colors.text} />
              </Press>
              <Press
                onPress={() => turnPage(page - 1)}
                accessibilityLabel="الصفحة السابقة"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
              </Press>
            </View>
          </View>
        ) : null}
      </View>

      {/* verse actions */}
      <VerseActionSheet verse={selectedVerse} onClose={() => setSelectedVerse(null)} />

      {/* surah picker */}
      <BottomSheet visible={sheet === 'surah'} onClose={() => setSheet(null)} scrollable={false}>
        <Txt size={16} weight={700} color={colors.text} style={{ marginBottom: 14 }}>
          اختر السورة
        </Txt>
        <FlatList
          data={surahList}
          keyExtractor={(s) => String(s.number)}
          style={{ maxHeight: 480 }}
          renderItem={({ item: s }: { item: SurahListItem }) => (
            <Press
              onPress={() => {
                setSheet(null);
                turnPage(s.firstPage);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 13,
                paddingHorizontal: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={12} weight={700} color={colors.emerald} align="center">
                  {toArabicDigits(s.number)}
                </Txt>
              </View>
              <Txt size={17} weight={700} amiri color={colors.text} style={{ flex: 1 }}>
                {stripSurahPrefix(s.nameArabic)}
              </Txt>
              <Txt size={11} color={colors.text2}>
                {toArabicDigits(s.ayahCount)} آية • ص {toArabicDigits(s.firstPage)}
              </Txt>
            </Press>
          )}
        />
      </BottomSheet>

      {/* juz picker */}
      <BottomSheet visible={sheet === 'juz'} onClose={() => setSheet(null)}>
        <Txt size={16} weight={700} color={colors.text} style={{ marginBottom: 14 }}>
          اختر الجزء
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
            <Press
              key={j}
              onPress={() => {
                setSheet(null);
                turnPage(juzStartPages.get(j) ?? 1);
              }}
              style={{
                flexBasis: '30%',
                flexGrow: 1,
                paddingVertical: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bg,
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
      </BottomSheet>

      {/* page jump */}
      <BottomSheet visible={sheet === 'page'} onClose={() => setSheet(null)}>
        <Txt size={16} weight={700} color={colors.text} style={{ marginBottom: 6 }}>
          الانتقال إلى صفحة
        </Txt>
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
            backgroundColor: colors.bg,
            borderWidth: 1.5,
            borderColor: colors.emerald,
            marginBottom: 16,
          }}
        >
          <TextInput
            value={pageInput}
            onChangeText={(t) => setPageInput(t.replace(/[^0-9٠-٩]/g, ''))}
            keyboardType="number-pad"
            placeholder={toArabicDigits(page)}
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
              setSheet(null);
              setPageInput('');
              turnPage(n);
            }
          }}
        />
      </BottomSheet>

      {/* reading settings */}
      <BottomSheet visible={sheet === 'readSettings'} onClose={() => setSheet(null)}>
        <Txt size={16} weight={700} color={colors.text} style={{ marginBottom: 16 }}>
          إعدادات القراءة
        </Txt>
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Txt size={13} weight={600} color={colors.text}>
              حجم خط القرآن
            </Txt>
            <Txt size={12} weight={700} color={colors.emerald}>
              {FONT_STEP_LABELS[fontStep]}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt size={11} color={colors.text2}>
              أ
            </Txt>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 0 }}>
              {FONT_STEP_LABELS.map((_, i) => (
                <Press
                  key={i}
                  onPress={() => setFontStep(i)}
                  style={{ flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      width: i === fontStep ? 18 : 10,
                      height: i === fontStep ? 18 : 10,
                      borderRadius: 9,
                      backgroundColor: i <= fontStep ? colors.emerald : colors.border,
                    }}
                  />
                </Press>
              ))}
            </View>
            <Txt size={18} color={colors.text2}>
              أ
            </Txt>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Txt size={13} color={colors.text}>
            إبقاء الشاشة مضاءة
          </Txt>
          <PillSwitch value={keepAwake} onToggle={() => toggleFlag('keepAwake')} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
