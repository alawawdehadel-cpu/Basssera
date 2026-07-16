import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AppButton from '../../src/components/ui/AppButton';
import AppCard from '../../src/components/ui/AppCard';
import Alert from '../../src/components/ui/Alert';
import { COLORS } from '../../src/constants/colors';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { useAppLanguage } from '../../src/hooks/useAppLanguage';
import { getAyah, getQuranValidation } from '../../src/utils/quranDataLoader';
import { getTotalMushafPages } from '../../src/utils/mushafLayout';
import { loadLastMushafPage, loadLastPosition } from '../../src/utils/storage';
import type { LastMushafPosition, LastReadingPosition } from '../../src/types/quran.types';

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

interface QuickLink {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export default function QuranHomeScreen() {
  const { lang, strings } = useAppLanguage();
  const [lastMushafPage, setLastMushafPage] = useState<LastMushafPosition | null>(null);
  const [lastPosition, setLastPosition] = useState<LastReadingPosition | null>(null);
  const validation = getQuranValidation();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      loadLastMushafPage().then((pos) => mounted && setLastMushafPage(pos));
      loadLastPosition().then((pos) => mounted && setLastPosition(pos));
      return () => {
        mounted = false;
      };
    }, []),
  );

  const quickLinks: QuickLink[] = [
    {
      icon: '📖',
      title: strings.mushafMode,
      subtitle: strings.mushafModeSubtitle,
      onPress: () => router.push(`/quran/mushaf/${lastMushafPage?.pageNumber ?? 1}`),
    },
    {
      icon: '☰',
      title: strings.browseSurahs,
      onPress: () => router.push('/quran/surahs'),
    },
    {
      icon: '🔍',
      title: strings.quranSearch,
      onPress: () => router.push('/quran/search'),
    },
    {
      icon: '★',
      title: strings.bookmarks,
      onPress: () => router.push('/quran/bookmarks'),
    },
  ];

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <ChevronIcon />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>{strings.quranHomeTitle}</Text>
            <Text style={styles.subtitle}>{strings.quranHomeSubtitle}</Text>
          </View>
        </View>

        {!validation.valid && (
          <View style={styles.alertWrap}>
            <Alert variant="warning">
              {strings.quranDataInvalidBadge(validation.count, validation.expected)}
            </Alert>
          </View>
        )}

        {lastMushafPage ? (
          <Pressable onPress={() => router.push(`/quran/mushaf/${lastMushafPage.pageNumber}`)}>
            <AppCard style={styles.continueCard}>
              <Text style={styles.continueLabel}>{strings.continueReading}</Text>
              <Text style={styles.continueValue}>
                {strings.pageOf(lastMushafPage.pageNumber, getTotalMushafPages())}
              </Text>
            </AppCard>
          </Pressable>
        ) : (
          lastPosition && (
            <Pressable
              onPress={() => {
                const page = getAyah(lastPosition.surahNumber, lastPosition.ayahNumber)?.page;
                router.push(
                  page
                    ? `/quran/mushaf/${page}`
                    : `/quran/surah/${lastPosition.surahNumber}?ayah=${lastPosition.ayahNumber}`,
                );
              }}
            >
              <AppCard style={styles.continueCard}>
                <Text style={styles.continueLabel}>{strings.continueReading}</Text>
                <Text style={styles.continueValue}>
                  {strings.continueReadingFrom(
                    lang === 'ar' ? lastPosition.surahNameArabic : lastPosition.surahNameEnglish,
                    lastPosition.ayahNumber,
                  )}
                </Text>
              </AppCard>
            </Pressable>
          )
        )}

        <View style={styles.links}>
          {quickLinks.map((link) => (
            <Pressable
              key={link.title}
              onPress={link.onPress}
              style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
            >
              <Text style={styles.linkIcon}>{link.icon}</Text>
              <View style={styles.linkTextBlock}>
                <Text style={styles.linkTitle}>{link.title}</Text>
                {link.subtitle && <Text style={styles.linkSubtitle}>{link.subtitle}</Text>}
              </View>
              <ChevronIcon />
            </Pressable>
          ))}
        </View>

        <AppButton
          variant="goldOutline"
          onPress={() => router.push('/quran/mushaf/1')}
          style={styles.startButton}
        >
          {strings.startFromBeginning}
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  scroll: {
    flexGrow: 1,
    padding: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleX: -1 }],
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.forest,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  alertWrap: {
    marginTop: SPACING.lg,
  },
  continueCard: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.forest,
    borderColor: 'rgba(178,138,62,0.5)',
  },
  continueLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  continueValue: {
    marginTop: SPACING.xs,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream,
  },
  links: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,138,62,0.3)',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  linkRowPressed: {
    backgroundColor: COLORS.parchmentDeep,
  },
  linkIcon: {
    fontSize: 18,
    color: COLORS.gold,
    width: 24,
    textAlign: 'center',
  },
  linkTextBlock: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  linkSubtitle: {
    marginTop: 1,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  startButton: {
    marginTop: SPACING.xl,
  },
});
