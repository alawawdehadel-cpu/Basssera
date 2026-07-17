import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../src/components/basirah/Icon';
import { AyahBadge, Press, SegmentedTabs } from '../../src/components/basirah/primitives';
import { EmptyState } from '../../src/components/basirah/states';
import { useToast } from '../../src/components/basirah/Toast';
import Txt from '../../src/components/basirah/Txt';
import { useUserData } from '../../src/hooks/useUserData';
import { FONT } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';
import { stripSurahPrefix, toArabicDigits } from '../../src/utils/numerals';
import { getAyah } from '../../src/utils/quranDataLoader';

const TABS = ['العلامات', 'الملاحظات', 'المحفوظات', 'سجل القراءة'];

function relativeTime(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return 'أُضيفت اليوم';
  if (days === 1) return 'أُضيفت أمس';
  if (days < 7) return `أُضيفت قبل ${toArabicDigits(days)} أيام`;
  if (days < 14) return 'أُضيفت قبل أسبوع';
  if (days < 30) return `أُضيفت قبل ${toArabicDigits(Math.floor(days / 7))} أسابيع`;
  return `أُضيفت قبل ${toArabicDigits(Math.floor(days / 30))} أشهر`;
}

export default function LibraryScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { bookmarks, notes, savedAnswers, readingLog, toggleVerseBookmark, removeSavedAnswer } = useUserData();
  const [tab, setTab] = useState(0);

  const noteEntries = useMemo(() => Object.entries(notes), [notes]);

  const collections = useMemo(
    () => [
      { name: 'العلامات', count: bookmarks.length, icon: 'bookmark' as const },
      { name: 'الملاحظات', count: noteEntries.length, icon: 'pencil' as const },
      { name: 'الإجابات المحفوظة', count: savedAnswers.length, icon: 'spark' as const },
      { name: 'سجل القراءة', count: readingLog.length, icon: 'clock' as const },
    ],
    [bookmarks.length, noteEntries.length, savedAnswers.length, readingLog.length],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Txt size={24} weight={700} color={colors.text} style={{ marginHorizontal: LAYOUT.screenX, marginTop: 8, marginBottom: 16 }}>
          مكتبتي
        </Txt>

        <View style={{ marginHorizontal: LAYOUT.screenX, marginBottom: 16 }}>
          <SegmentedTabs items={TABS} active={tab} onChange={setTab} height={36} />
        </View>

        {/* collections rail */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: LAYOUT.screenX, marginBottom: 12 }}>
          <Txt size={15} weight={700} color={colors.text}>
            المجموعات
          </Txt>
          <Press
            onPress={() => showToast('إنشاء مجموعة جديدة غير متاح بعد')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="plus" size={14} color={colors.emerald} strokeWidth={2} />
            <Txt size={12} weight={600} color={colors.emerald}>
              إنشاء
            </Txt>
          </Press>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, gap: 11, paddingBottom: 18 }}
        >
          {collections.map((c) => (
            <View
              key={c.name}
              style={{
                width: 135,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <LinearGradient colors={[colors.surface, colors.surface2]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ padding: 15 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: colors.goldTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Icon name={c.icon} size={17} color={colors.gold} filled={c.icon === 'bookmark'} strokeWidth={1.7} />
                </View>
                <Txt size={13.5} weight={700} color={colors.text} style={{ marginBottom: 3 }}>
                  {c.name}
                </Txt>
                <Txt size={11} color={colors.text2}>
                  {toArabicDigits(c.count)} عنصر
                </Txt>
              </LinearGradient>
            </View>
          ))}
        </ScrollView>

        {/* tab content */}
        <View style={{ paddingHorizontal: LAYOUT.screenX }}>
          {tab === 0 ? (
            bookmarks.length === 0 ? (
              <EmptyState
                icon="bookmark"
                title="لم تحفظ أي آية بعد"
                body="يمكنك الضغط على رمز العلامة أثناء القراءة للعودة إلى الآية لاحقًا."
                ctaLabel="ابدأ القراءة"
                onCta={() => router.push('/reader')}
              />
            ) : (
              <View style={{ gap: 11 }}>
                {[...bookmarks]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((b) => {
                    const ayah = getAyah(b.surahNumber, b.ayahNumber);
                    const hasNote = !!notes[b.id];
                    return (
                      <View
                        key={b.id}
                        style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View>
                            <Txt size={13.5} weight={700} color={colors.emerald} style={{ marginBottom: 2 }}>
                              سورة {stripSurahPrefix(b.surahNameArabic)} • الآية {toArabicDigits(b.ayahNumber)}
                            </Txt>
                            <Txt size={10.5} color={colors.text2}>
                              {relativeTime(b.createdAt)}
                            </Txt>
                          </View>
                          <Press
                            onPress={async () => {
                              await toggleVerseBookmark({
                                id: b.id,
                                surahNumber: b.surahNumber,
                                ayahNumber: b.ayahNumber,
                                surahNameArabic: b.surahNameArabic,
                                surahNameEnglish: b.surahNameEnglish,
                              });
                              showToast('أُزيلت العلامة');
                            }}
                            accessibilityLabel="إزالة العلامة"
                            style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Icon name="bookmark" size={16} color={colors.gold} filled />
                          </Press>
                        </View>
                        <Press
                          onPress={() => {
                            if (ayah) router.push({ pathname: '/reader', params: { page: String(ayah.page) } });
                          }}
                        >
                          <Txt size={17} lh={1.8} align="right" color={colors.readerText} style={{ fontFamily: FONT.quran, marginBottom: hasNote ? 10 : 0 }} numberOfLines={3}>
                            {ayah?.textUthmani ?? '﴿ … ﴾'}
                          </Txt>
                        </Press>
                        {hasNote ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldTint, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9 }}>
                            <Icon name="pencil" size={13} color={colors.gold} strokeWidth={1.7} />
                            <Txt size={11} color={colors.gold} numberOfLines={1} style={{ flex: 1 }}>
                              {notes[b.id]}
                            </Txt>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
            )
          ) : null}

          {tab === 1 ? (
            noteEntries.length === 0 ? (
              <EmptyState
                icon="pencil"
                title="لا ملاحظات بعد"
                body="اكتب ملاحظة على أي آية من ورقة إجراءات الآية لتظهر هنا."
                ctaLabel="ابدأ القراءة"
                onCta={() => router.push('/reader')}
              />
            ) : (
              <View style={{ gap: 11 }}>
                {noteEntries.map(([id, note]) => {
                  const [s, a] = id.split(':').map(Number);
                  const ayah = getAyah(s, a);
                  return (
                    <Press
                      key={id}
                      onPress={() => {
                        if (ayah) router.push({ pathname: '/tafsir', params: { surah: String(s), ayah: String(a) } });
                      }}
                      style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15 }}
                    >
                      <Txt size={13} weight={700} color={colors.emerald} style={{ marginBottom: 8 }}>
                        سورة {stripSurahPrefix(ayah?.surahNameArabic ?? '')} • الآية {toArabicDigits(a)}
                      </Txt>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.goldTint, padding: 11, borderRadius: 12 }}>
                        <Icon name="pencil" size={14} color={colors.gold} strokeWidth={1.7} />
                        <Txt size={13} lh={1.7} color={colors.text2} style={{ flex: 1 }}>
                          {note}
                        </Txt>
                      </View>
                    </Press>
                  );
                })}
              </View>
            )
          ) : null}

          {tab === 2 ? (
            savedAnswers.length === 0 ? (
              <EmptyState
                icon="spark"
                title="لا إجابات محفوظة"
                body="احفظ إجابات «اسأل بصيرة» للرجوع إليها لاحقًا من زر الحفظ أسفل الإجابة."
                ctaLabel="اسأل بصيرة"
                onCta={() => router.push('/(tabs)/assistant')}
              />
            ) : (
              <View style={{ gap: 11 }}>
                {savedAnswers.map((ans) => (
                  <View key={ans.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 15 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Icon name="spark" size={15} color={colors.gold} strokeWidth={1.8} />
                        <Txt size={13} weight={700} color={colors.text} numberOfLines={1} style={{ flex: 1 }}>
                          {ans.question}
                        </Txt>
                      </View>
                      <Press onPress={() => { removeSavedAnswer(ans.id); showToast('حُذفت الإجابة'); }} accessibilityLabel="حذف">
                        <Icon name="close" size={16} color={colors.text3} strokeWidth={1.8} />
                      </Press>
                    </View>
                    <Txt size={13} lh={1.8} color={colors.text2} numberOfLines={3}>
                      {ans.summary}
                    </Txt>
                  </View>
                ))}
              </View>
            )
          ) : null}

          {tab === 3 ? (
            readingLog.length === 0 ? (
              <EmptyState
                icon="clock"
                title="لا سجل قراءة بعد"
                body="سيظهر هنا آخر ما قرأته من صفحات المصحف تلقائيًا."
                ctaLabel="ابدأ القراءة"
                onCta={() => router.push('/reader')}
              />
            ) : (
              <View style={{ gap: 10 }}>
                {readingLog.map((e, i) => (
                  <Press
                    key={`${e.page}-${e.at}-${i}`}
                    onPress={() => router.push({ pathname: '/reader', params: { page: String(e.page) } })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      padding: 13,
                    }}
                  >
                    <AyahBadge number={e.page} size={34} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt size={13.5} weight={700} color={colors.text}>
                        سورة {stripSurahPrefix(e.surahName)}
                      </Txt>
                      <Txt size={11} color={colors.text2}>
                        الصفحة {toArabicDigits(e.page)}
                        {e.ayahNumber ? ` • الآية ${toArabicDigits(e.ayahNumber)}` : ''}
                      </Txt>
                    </View>
                    <Icon name="chevronBack" size={16} color={colors.text2} strokeWidth={1.9} />
                  </Press>
                ))}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
