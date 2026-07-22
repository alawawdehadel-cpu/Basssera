import {
  Amiri_400Regular,
  Amiri_700Bold,
} from '@expo-google-fonts/amiri';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, I18nManager, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../src/components/basirah/Toast';
import { PlaybackProvider } from '../src/hooks/usePlayback';
import { PrayerTimesProvider } from '../src/hooks/usePrayerTimes';
import { SettingsProvider } from '../src/hooks/useSettings';
import { useUserData, UserDataProvider } from '../src/hooks/useUserData';
import { LanguageProvider } from '../src/hooks/useAppLanguage';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { LIGHT } from '../src/theme/tokens';

/**
 * The whole app is Arabic RTL. On native this needs I18nManager (applies
 * from the next app start on the very first launch); on web the document
 * direction drives CSS flex row direction natively.
 */
if (Platform.OS === 'web') {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  }
  const rnwI18n = I18nManager as unknown as { setPreferredLanguageRTL?: (rtl: boolean) => void };
  rnwI18n.setPreferredLanguageRTL?.(true);
} else {
  I18nManager.allowRTL(true);
  if (!I18nManager.isRTL) I18nManager.forceRTL(true);
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  useUserData(); // warm user data early so Home renders with real state
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
          animationDuration: 260,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reader" />
        <Stack.Screen name="tafsir" />
        <Stack.Screen name="player" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="prayer-times" />
        <Stack.Screen name="about" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    QuranFont: require('../assets/fonts/QuranFont.ttf'),
    Amiri_400Regular,
    Amiri_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: LIGHT.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={LIGHT.emerald} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <UserDataProvider>
              <PlaybackProvider>
                <ToastProvider>
                  <PrayerTimesProvider>
                    <ThemedApp />
                  </PrayerTimesProvider>
                </ToastProvider>
              </PlaybackProvider>
            </UserDataProvider>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
