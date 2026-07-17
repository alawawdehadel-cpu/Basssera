import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../src/components/basirah/Icon';
import { LogoTile } from '../../src/components/basirah/LogoMark';
import {
  AyahBadge,
  Card,
  IconButton,
  Press,
  ProgressBar,
  SectionHeader,
} from '../../src/components/basirah/primitives';
import { useToast } from '../../src/components/basirah/Toast';
import Txt from '../../src/components/basirah/Txt';
import { usePlayback, RECITERS } from '../../src/hooks/usePlayback';
import { useUserData, WIRD_GOAL_PAGES } from '../../src/hooks/useUserData';
import { FONT } from '../../src/theme/fonts';
import { getHijriDateLabel } from '../../src/theme/hijri';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';
import type { QuranAyah, LastMushafPosition } from '../../src/types/quran.types';
import { stripSurahPrefix, toArabicDigits } from '../../src/utils/numerals';
import { getAyah, getSurahMeta, loadQuranData } from '../../src/utils/quranDataLoader';
import { getSurahsOnMushafPage } from '../../src/utils/mushafLayout';
import { loadLastMushafPage, loadLastPosition } from '../../src/utils/storage';
import { TOTAL_MUSHAF_PAGES, type LastReadingPosition } from '../../src/types/quran.types';

/** Deterministic "آية اليوم" pick — rotates daily over the real mushaf text. */
function verseOfDayIndex(total: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return (day * 379 + now.getFullYear() * 7) % total;
}

const FEATURES = [
  { title: 'القرآن الكريم', icon: 'book' as const, gold: false, href: '/(tabs)/quran' },
  { title: 'التفسير', icon: 'layers' as const, gold: true, href: 'tafsir' },
  { title: 'البحث الذكي', icon: 'search' as const, gold: false, href: '/(tabs)/search' },
  { title: 'اسأل بصيرة', icon: 'spark' as const, gold: true, href: '/(tabs)/assistant' },
  { title: 'التلاوات', icon: 'headphones' as const, gold: false, href: '/(tabs)/recitations' },
  { title: 'العلامات المرجعية', icon: 'bookmark' as const, gold: true, href: '/(tabs)/library' },
];

export default function HomeScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const { bookmarks, wirdPagesRead, isBookmarked, toggleVerseBookmark } = useUserData();

  const [verseOfDay, setVerseOfDay] = useState<QuranAyah | null>(null);
  const [lastPage, setLastPage] = useState<LastMushafPosition | null>(null);
  const [lastPosition, setLastPosition] = useState<LastReadingPosition | null>(null);

  useEffect(() => {
    loadQuranData().then((ayahs) => {
      if (ayahs.length) setVerseOfDay(ayahs[verseOfDayIndex(ayahs.length)]);
    });
    loadLastMushafPage().then(setLastPage);
    loadLastPosition().then(setLastPosition);
  }, []);

  const hijri = useMemo(() => getHijriDateLabel(), []);

  const continuePage = lastPage?.pageNumber ?? 1;
  const continueSurah = stripSurahPrefix(
    getSurahsOnMushafPage(continuePage)[0] ??
      (lastPosition ? lastPosition.surahNameArabic : 'الفاتحة'),
  );

  const wirdFraction = Math.min(1, wirdPagesRead / WIRD_GOAL_PAGES);

  const vodBookmarked = verseOfDay
    ? isBookmarked(verseOfDay.surahNumber, verseOfDay.ayahNumber)
    : false;

  const toggleVod = async () => {
    if (!verseOfDay) return;
    const added = await toggleVerseBookmark({
      id: `${verseOfDay.surahNumber}:${verseOfDay.ayahNumber}`,
      surahNumber: verseOfDay.surahNumber,
      ayahNumber: verseOfDay.ayahNumber,
      surahNameArabic: verseOfDay.surahNameArabic,
      surahNameEnglish: verseOfDay.surahNameEnglish,
    });
    showToast(added ? 'تمت إضافة العلامة' : 'أُزيلت العلامة');
  };

  const latestBookmarks = useMemo(
    () =>
      [...bookmarks]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 2)
        .map((b) => ({ ...b, text: getAyah(b.surahNumber, b.ayahNumber)?.textUthmani ?? '' })),
    [bookmarks],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingTop: 6, paddingBottom: 30 }}
      >
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <LogoTile />
            <View>
              <Txt size={15} weight={700} color={colors.text}>
                السلام عليكم
              </Txt>
              <Txt size={11.5} color={colors.text2}>
                {hijri}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={isDark ? 'sun' : 'moon'} onPress={toggleTheme} label="تبديل المظهر" />
            <IconButton icon="bell" badge label="الإشعارات" onPress={() => showToast('لا إشعارات جديدة')} />
            <IconButton icon="gear" label="الإعدادات" iconSize={20} onPress={() => router.push('/settings')} />
          </View>
        </View>

        {/* وردك اليوم hero */}
        <View
          style={{
            borderRadius: 22,
            overflow: 'hidden',
            marginBottom: 16,
            shadowColor: colors.emerald,
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <LinearGradient
            colors={[colors.heroFrom, colors.heroTo]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ padding: 22 }}
          >
            <View
              style={{
                position: 'absolute',
                top: -30,
                left: -20,
                width: 120,
                height: 120,
                borderRadius: 60,
                borderWidth: 1,
                borderColor: 'rgba(223,201,108,.3)',
              }}
            />
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 5,
                paddingHorizontal: 11,
                borderRadius: 20,
                backgroundColor: 'rgba(223,201,108,.18)',
                marginBottom: 12,
              }}
            >
              <Txt size={11} weight={600} color="#DFC96C">
                ✦ وِردك اليوم
              </Txt>
            </View>
            <Txt size={21} weight={700} color="#F7F2E5" style={{ marginBottom: 6 }}>
              خصّص دقائق للتدبر
            </Txt>
            <Txt size={13} color="rgba(247,242,229,.75)" style={{ marginBottom: 16 }}>
              أكملت {toArabicDigits(wirdPagesRead)} من {toArabicDigits(WIRD_GOAL_PAGES)} صفحات لهذا اليوم
            </Txt>
            <View
              style={{ height: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,.15)', overflow: 'hidden', marginBottom: 16 }}
            >
              <LinearGradient
                colors={['#DFC96C', '#C9A227']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: '100%', width: `${wirdFraction * 100}%`, borderRadius: 5, alignSelf: 'flex-start' }}
              />
            </View>
            <Press
              onPress={() => router.push('/reader')}
              style={{
                alignSelf: 'flex-start',
                height: 44,
                paddingHorizontal: 22,
                borderRadius: 13,
                backgroundColor: '#F7F2E5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={14} weight={700} color={colors.emerald2}>
                ابدأ الورد
              </Txt>
            </Press>
          </LinearGradient>
        </View>

        {/* تابع القراءة */}
        <Press onPress={() => router.push('/reader')}>
          <Card
            padding={15}
            radius={18}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bookOpen" size={26} color={colors.emerald} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt size={11} color={colors.text2} style={{ marginBottom: 3 }}>
                تابع القراءة
              </Txt>
              <Txt size={15} weight={700} color={colors.text}>
                سورة {continueSurah}
              </Txt>
              <Txt size={11.5} color={colors.text2} style={{ marginVertical: 5 }}>
                الصفحة {toArabicDigits(continuePage)}
                {lastPosition ? ` • الآية ${toArabicDigits(lastPosition.ayahNumber)}` : ''}
              </Txt>
              <ProgressBar fraction={continuePage / TOTAL_MUSHAF_PAGES} height={5} />
            </View>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                backgroundColor: colors.emerald,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="chevronForward" size={16} color="#fff" strokeWidth={2.4} />
            </View>
          </Card>
        </Press>

        {/* feature grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginBottom: 26 }}>
          {FEATURES.map((f) => (
            <Press
              key={f.title}
              onPress={() => {
                if (f.href === 'tafsir') {
                  const s = lastPosition?.surahNumber ?? 1;
                  const a = lastPosition?.ayahNumber ?? 1;
                  router.push({ pathname: '/tafsir', params: { surah: String(s), ayah: String(a) } });
                } else {
                  router.push(f.href as never);
                }
              }}
              style={{
                flexBasis: '30%',
                flexGrow: 1,
                alignItems: 'center',
                gap: 9,
                paddingVertical: 16,
                paddingHorizontal: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: f.gold ? colors.goldTint : colors.emeraldTint,
                }}
              >
                <Icon
                  name={f.icon}
                  size={22}
                  color={f.gold ? colors.gold : colors.emerald}
                  filled={f.icon === 'bookmark'}
                />
              </View>
              <Txt size={12} weight={600} color={colors.text} align="center">
                {f.title}
              </Txt>
            </Press>
          ))}
        </View>

        {/* آية اليوم */}
        <SectionHeader
          title="آية اليوم"
          trailing={
            <Txt size={11} weight={600} color={colors.gold}>
              ✦
            </Txt>
          }
        />
        <View
          style={{
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginBottom: 26,
          }}
        >
          {verseOfDay ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Txt size={12} weight={700} color={colors.emerald}>
                  سورة {stripSurahPrefix(verseOfDay.surahNameArabic)} • الآية {toArabicDigits(verseOfDay.ayahNumber)}
                </Txt>
                <AyahBadge number={verseOfDay.ayahNumber} />
              </View>
              <Txt
                size={24}
                lh={1.9}
                align="center"
                color={colors.readerText}
                style={{ fontFamily: FONT.quran, paddingVertical: 10 }}
              >
                {verseOfDay.textUthmani}
              </Txt>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 14,
                  marginTop: 14,
                }}
              >
                <Press
                  onPress={() => {
                    const meta = getSurahMeta(verseOfDay.surahNumber);
                    startTrack({
                      surahNumber: verseOfDay.surahNumber,
                      surahName: verseOfDay.surahNameArabic,
                      ayahCount: meta?.ayahCount ?? 10,
                      reciter: RECITERS[1],
                    });
                    showToast('جارٍ التشغيل');
                  }}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: colors.surface2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="play" size={15} color={colors.text} />
                  <Txt size={12} weight={600} color={colors.text}>
                    استمع
                  </Txt>
                </Press>
                <Press
                  onPress={toggleVod}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: colors.surface2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Icon
                    name="bookmark"
                    size={15}
                    color={vodBookmarked ? colors.gold : colors.text}
                    filled={vodBookmarked}
                  />
                  <Txt size={12} weight={600} color={vodBookmarked ? colors.gold : colors.text}>
                    احفظ
                  </Txt>
                </Press>
                <Press
                  onPress={() =>
                    router.push({
                      pathname: '/tafsir',
                      params: { surah: String(verseOfDay.surahNumber), ayah: String(verseOfDay.ayahNumber) },
                    })
                  }
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: colors.surface2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="book" size={15} color={colors.text} />
                  <Txt size={12} weight={600} color={colors.text}>
                    تفسير
                  </Txt>
                </Press>
              </View>
            </>
          ) : null}
        </View>

        {/* استمع الآن */}
        <SectionHeader
          title="استمع الآن"
          actionLabel="عرض الكل"
          onAction={() => router.push('/(tabs)/recitations')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -LAYOUT.screenX, marginBottom: 26 }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, gap: 12 }}
        >
          {RECITERS.map((r) => (
            <Card key={r.id} padding={14} radius={18} style={{ width: 150 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <LinearGradient
                  colors={r.gradient}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Txt size={18} color="#F7F2E5" align="center" style={{ fontFamily: FONT.amiriBold }}>
                    {r.mono}
                  </Txt>
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={12.5} weight={700} color={colors.text} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt size={10.5} color={colors.text2}>
                    {r.type}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt size={11} color={colors.text2}>
                  سورة الملك
                </Txt>
                <Press
                  onPress={() => {
                    startTrack({ surahNumber: 67, surahName: 'الملك', ayahCount: 30, reciter: r });
                    showToast('جارٍ التشغيل');
                  }}
                  accessibilityLabel="تشغيل"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.emerald,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="play" size={14} color="#fff" />
                </Press>
              </View>
            </Card>
          ))}
        </ScrollView>

        {/* آخر المحفوظات */}
        {latestBookmarks.length > 0 ? (
          <>
            <SectionHeader
              title="آخر المحفوظات"
              actionLabel="عرض الكل"
              onAction={() => router.push('/(tabs)/library')}
            />
            <View style={{ gap: 10 }}>
              {latestBookmarks.map((b) => (
                <Press
                  key={b.id}
                  onPress={() =>
                    router.push({
                      pathname: '/tafsir',
                      params: { surah: String(b.surahNumber), ayah: String(b.ayahNumber) },
                    })
                  }
                >
                  <Card padding={13} radius={15} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                      <Txt size={11.5} color={colors.text2} numberOfLines={1}>
                        {b.text}
                      </Txt>
                    </View>
                  </Card>
                </Press>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
