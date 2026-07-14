import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import { COLORS } from '../src/constants/colors';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { loadTafseerData } from '../src/utils/dataLoader';

const FEATURES = (strings: ReturnType<typeof useAppLanguage>['strings']) => [
  { icon: '✦', label: strings.featureTafseer },
  { icon: '۞', label: strings.featureLocalSearch },
  { icon: '⛔', label: strings.featureNoAI },
  { icon: '🔒', label: strings.featurePrivacy },
];

export default function HomeScreen() {
  const { strings, toggleLang } = useAppLanguage();
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadTafseerData()
      .then(() => mounted && setDataReady(true))
      .catch(() => mounted && setDataReady(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.langRow}>
          <AppButton variant="goldOutline" size="sm" onPress={toggleLang}>
            {strings.langToggle}
          </AppButton>
        </View>

        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Svg viewBox="0 0 44 44" width={64} height={64} style={{ position: 'absolute' }}>
              <Path
                d="M22 2l4.9 10.3L38 8l-4.3 11.1L44 22l-10.3 2.9L38 36l-11.1-4.3L22 42l-4.9-10.3L6 36l4.3-11.1L0 22l10.3-2.9L6 8l11.1 4.3z"
                fill={COLORS.gold}
                opacity={0.9}
              />
            </Svg>
            <Svg viewBox="0 0 24 24" width={30} height={30}>
              <Path
                d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 0 4 18.5zM6.5 18H18v1.5H6.5a.75.75 0 0 1 0-1.5zM7 6h10v2H7z"
                fill={COLORS.forestDeep}
              />
            </Svg>
          </View>
          <Text style={styles.appTitle}>{strings.appTitle}</Text>
          <Text style={styles.tagline}>{strings.homeTagline}</Text>
        </View>

        <AppButton
          variant="primary"
          onPress={() => router.push('/chat')}
          style={styles.ctaButton}
        >
          {strings.startChat}
        </AppButton>

        <AppButton
          variant="goldOutline"
          onPress={() => router.push('/quran')}
          style={styles.quranButton}
        >
          {strings.quranNavCard}
        </AppButton>

        {!dataReady && <Text style={styles.dataHint}>{strings.dataLoading}</Text>}

        <View style={styles.grid}>
          {FEATURES(strings).map((f) => (
            <AppCard key={f.label} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </AppCard>
          ))}
        </View>

        <Text style={styles.footer}>{strings.footer}</Text>

        <View style={styles.navRow}>
          <AppButton variant="ghost" size="sm" onPress={() => router.push('/about')}>
            {strings.navAbout}
          </AppButton>
          <AppButton variant="ghost" size="sm" onPress={() => router.push('/privacy')}>
            {strings.navPrivacy}
          </AppButton>
          <AppButton variant="ghost" size="sm" onPress={() => router.push('/security')}>
            {strings.navSecurity}
          </AppButton>
        </View>
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
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  langRow: {
    alignItems: 'flex-end',
    marginTop: SPACING.sm,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    borderWidth: 2,
    borderColor: 'rgba(178,138,62,0.4)',
  },
  appTitle: {
    marginTop: SPACING.lg,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.forest,
  },
  tagline: {
    marginTop: SPACING.xs,
    fontSize: 14,
    color: COLORS.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaButton: {
    marginTop: SPACING.xxl,
  },
  quranButton: {
    marginTop: SPACING.sm,
  },
  dataHint: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  grid: {
    marginTop: SPACING.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  featureIcon: {
    fontSize: 22,
    color: COLORS.gold,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: COLORS.ink,
  },
  footer: {
    marginTop: SPACING.xxl,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: 'rgba(41,51,46,0.7)',
  },
  navRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
});
