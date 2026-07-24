import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../src/components/basirah/Icon';
import { AyahBadge, Card, Chip, Press } from '../src/components/basirah/primitives';
import { useToast } from '../src/components/basirah/Toast';
import Txt from '../src/components/basirah/Txt';
import { usePlayback, RECITERS } from '../src/hooks/usePlayback';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { useUserData } from '../src/hooks/useUserData';
import { FONT } from '../src/theme/fonts';
import { useTheme } from '../src/theme/ThemeContext';
import { LAYOUT } from '../src/theme/tokens';
import type { TafseerGroup } from '../src/types/data.types';
import { loadTafseerData } from '../src/utils/dataLoader';
import { formatNumber, stripSurahPrefix } from '../src/utils/numerals';
import { getAyah, getSurahMeta } from '../src/utils/quranDataLoader';

const SOURCES = [
  { key: 'muyassar', labelKey: 'tafsir.source.muyassar' as const, available: false },
  { key: 'kathir', labelKey: 'tafsir.source.kathir' as const, available: false },
  { key: 'saadi', labelKey: 'tafsir.source.saadi' as const, available: true },
  { key: 'tabari', labelKey: 'tafsir.source.tabari' as const, available: false },
];

const SECTIONS = [
  { key: 'words', glyph: '﷽', titleKey: 'tafsir.section.words' as const },
  { key: 'reasons', glyph: '◈', titleKey: 'tafsir.section.reasons' as const },
  { key: 'benefits', glyph: '✦', titleKey: 'tafsir.section.benefits' as const },
  { key: 'related', glyph: '❖', titleKey: 'tafsir.section.related' as const },
];

export default function TafsirScreen() {
  const params = useLocalSearchParams<{ surah?: string; ayah?: string }>();
  const surahNumber = Math.max(1, Math.min(114, Number(params.surah) || 1));
  const ayahNumber = Math.max(1, Number(params.ayah) || 1);

  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const { isBookmarked, toggleVerseBookmark } = useUserData();

  const [groups, setGroups] = useState<TafseerGroup[] | null>(null);
  const [source, setSource] = useState('saadi');
  const [open, setOpen] = useState<Record<string, boolean>>({ related: true });

  useEffect(() => {
    loadTafseerData()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  const verse = getAyah(surahNumber, ayahNumber);
  const surahName = stripSurahPrefix(
    verse?.surahNameArabic ?? getSurahMeta(surahNumber)?.nameArabic ?? '',
  );
  const refLabel = `${t('common.surah')} ${surahName} • ${t('common.ayah')} ${formatNumber(ayahNumber)}`;

  const group = useMemo(
    () =>
      groups?.find(
        (g) => g.surah === surahNumber && g.ayah_start <= ayahNumber && g.ayah_end >= ayahNumber,
      ) ?? null,
    [groups, surahNumber, ayahNumber],
  );

  const bookmarked = isBookmarked(surahNumber, ayahNumber);
  const sourceAvailable = SOURCES.find((s) => s.key === source)?.available ?? false;

  const relatedAyahs = useMemo(() => {
    if (!group) return [];
    return group.ayahs.filter((a) => a.number !== ayahNumber).slice(0, 6);
  }, [group, ayahNumber]);

  /** Short retrieval-only summary: the opening of the Saadi explanation. */
  const aiSummary = useMemo(() => {
    if (!group) return null;
    const text = group.explanation.trim().replace(/\s+/g, ' ');
    if (text.length <= 220) return text;
    const cut = text.slice(0, 220);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 180))}…`;
  }, [group]);

  const toggleBm = async () => {
    if (!verse) return;
    const added = await toggleVerseBookmark({
      id: `${surahNumber}:${ayahNumber}`,
      surahNumber,
      ayahNumber,
      surahNameArabic: verse.surahNameArabic,
      surahNameEnglish: verse.surahNameEnglish,
    });
    showToast(added ? t('bookmark.added') : t('bookmark.removed'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: LAYOUT.screenX,
          paddingVertical: 12,
        }}
      >
        <Press
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel={t('common.back')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
        </Press>
        <View>
          <Txt size={18} weight={700} color={colors.text}>
            {t('tafsir.title')}
          </Txt>
          <Txt size={12} color={colors.text2}>
            {refLabel}
          </Txt>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 110 }}
      >
        {/* verse card */}
        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.gold,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <LinearGradient
            colors={[colors.surface, colors.surface2]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{ padding: 18 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Txt size={10} weight={700} color={colors.gold} style={{ letterSpacing: 0.5 }}>
                {t('tafsir.quranText')}
              </Txt>
              <AyahBadge number={ayahNumber} size={24} />
            </View>
            <Txt
              size={22}
              lh={2}
              align="center"
              color={colors.readerText}
              style={{ fontFamily: FONT.quran, paddingVertical: 8 }}
            >
              {verse?.textUthmani ?? '—'}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 12,
                marginTop: 6,
              }}
            >
              <Press
                onPress={() => {
                  const meta = getSurahMeta(surahNumber);
                  startTrack({
                    surahNumber,
                    surahName,
                    ayahCount: meta?.ayahCount ?? 10,
                    reciter: RECITERS[1],
                  });
                  showToast(t('playback.starting'));
                }}
                accessibilityLabel={t('verse.listen')}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.emerald,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="play" size={15} color="#fff" />
              </Press>
              <Press
                onPress={toggleBm}
                accessibilityLabel={t('verse.save')}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="bookmark" size={15} color={bookmarked ? colors.gold : colors.text} filled={bookmarked} />
              </Press>
              <Press
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(`${verse?.textUthmani ?? ''}\n${refLabel}`);
                    showToast(t('common.copied'));
                  } catch {
                    showToast(t('common.copyFailed'));
                  }
                }}
                accessibilityLabel={t('verse.copy')}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="copy" size={15} color={colors.text} />
              </Press>
            </View>
          </LinearGradient>
        </View>

        {/* source chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -LAYOUT.screenX, marginBottom: 20 }}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, gap: 8 }}
        >
          {SOURCES.map((s) => (
            <Chip key={s.key} label={t(s.labelKey)} active={source === s.key} onPress={() => setSource(s.key)} height={36} />
          ))}
        </ScrollView>

        {/* tafsir body */}
        {sourceAvailable ? (
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Txt size={15} weight={700} color={colors.text}>
                {t('tafsir.saadi')}
              </Txt>
              <View style={{ backgroundColor: colors.surface2, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 }}>
                <Txt size={10} color={colors.text2}>
                  {t('tafsir.trustedSource')}
                </Txt>
              </View>
              {group && (group.ayah_start !== group.ayah_end) ? (
                <Txt size={10} color={colors.text3}>
                  {t('tafsir.ayatRange', { from: formatNumber(group.ayah_start), to: formatNumber(group.ayah_end) })}
                </Txt>
              ) : null}
            </View>
            {groups === null ? (
              <Txt size={13} color={colors.text3}>
                {t('tafsir.loading')}
              </Txt>
            ) : group ? (
              <Txt size={15} lh={2} color={colors.text2} style={{ textAlign: 'justify' }}>
                {formatNumber(group.explanation.trim())}
              </Txt>
            ) : (
              <Txt size={13} lh={1.9} color={colors.text2}>
                {t('tafsir.notAvailable')}
              </Txt>
            )}
          </View>
        ) : (
          <View style={{ marginBottom: 18 }}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.gold,
                backgroundColor: colors.goldTint,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <Txt size={13} weight={700} color={colors.text} align="center" style={{ marginBottom: 6 }}>
                {t('tafsir.sourceUnavailable')}
              </Txt>
              <Txt size={12.5} lh={1.7} color={colors.text2} align="center">
                {t('tafsir.sourceUnavailableBody')}
              </Txt>
            </View>
          </View>
        )}

        {/* accordion sections */}
        <Card padding={0} style={{ overflow: 'hidden', marginBottom: 12 }}>
          {SECTIONS.map((sec, i) => {
            const isOpen = !!open[sec.key];
            return (
              <View key={sec.key}>
                <Press
                  onPress={() => setOpen((o) => ({ ...o, [sec.key]: !o[sec.key] }))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 15,
                    paddingHorizontal: 16,
                    borderBottomWidth: i < SECTIONS.length - 1 || isOpen ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt size={14} color={colors.emerald}>
                      {sec.glyph}
                    </Txt>
                    <Txt size={14} weight={600} color={colors.text}>
                      {t(sec.titleKey)}
                    </Txt>
                  </View>
                  <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                    <Icon name="chevronDown" size={16} color={colors.text2} strokeWidth={2} />
                  </View>
                </Press>
                {isOpen ? (
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 16,
                      paddingTop: 4,
                      borderBottomWidth: i < SECTIONS.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    {sec.key === 'related' ? (
                      relatedAyahs.length > 0 ? (
                        <View style={{ gap: 10 }}>
                          {relatedAyahs.map((a) => (
                            <Press
                              key={a.number}
                              onPress={() =>
                                router.push({
                                  pathname: '/tafsir',
                                  params: { surah: String(surahNumber), ayah: String(a.number) },
                                })
                              }
                              style={{
                                borderRadius: 12,
                                backgroundColor: colors.surface2,
                                padding: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <AyahBadge number={a.number} size={22} />
                              <Txt
                                size={15}
                                lh={1.7}
                                color={colors.readerText}
                                style={{ fontFamily: FONT.quran, flex: 1 }}
                                numberOfLines={2}
                              >
                                {a.text}
                              </Txt>
                            </Press>
                          ))}
                        </View>
                      ) : (
                        <Txt size={13} lh={1.9} color={colors.text2}>
                          {t('tafsir.noRelated')}
                        </Txt>
                      )
                    ) : (
                      <Txt size={13} lh={1.9} color={colors.text2}>
                        {t('tafsir.sectionUnavailable')}
                      </Txt>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        {/* AI-style summary — retrieval only, visually distinct */}
        {aiSummary ? (
          <View
            style={{
              marginTop: 8,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.gold,
              backgroundColor: colors.goldTint,
            }}
          >
            <Txt size={10} weight={700} color={colors.gold} style={{ marginBottom: 6 }}>
              {t('tafsir.assistantExplain')}
            </Txt>
            <Txt size={13} lh={1.9} color={colors.text2}>
              {formatNumber(aiSummary)}
            </Txt>
            <Txt size={9.5} color={colors.text3} style={{ marginTop: 8 }}>
              {t('tafsir.assistantNote')}
            </Txt>
          </View>
        ) : null}
      </ScrollView>

      {/* floating CTA */}
      <Press
        onPress={() =>
          router.push({
            pathname: '/(tabs)/assistant',
            params: { ask: t('verse.askTafsirOf', { ayah: formatNumber(ayahNumber), surah: surahName }) },
          })
        }
        style={{
          position: 'absolute',
          bottom: 24,
          left: LAYOUT.screenX,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 50,
          paddingHorizontal: 22,
          borderRadius: 16,
          backgroundColor: colors.emerald,
          shadowColor: colors.emerald,
          shadowOpacity: 0.5,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Icon name="spark" size={18} color="#DFC96C" strokeWidth={1.8} />
        <Txt size={14} weight={700} color="#fff">
          {t('tafsir.askAboutVerse')}
        </Txt>
      </Press>
    </SafeAreaView>
  );
}
