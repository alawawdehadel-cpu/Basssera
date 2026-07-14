import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../src/constants/colors';
import { LanguageProvider } from '../src/hooks/useAppLanguage';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    UthmanicHafs: require('../assets/fonts/UthmanicHafs.ttf'),
    UthmanTN1: require('../assets/fonts/UthmanTN1.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.parchment },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="about" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="security" />
          <Stack.Screen name="quran/index" />
          <Stack.Screen name="quran/surahs" />
          <Stack.Screen name="quran/surah/[number]" />
          <Stack.Screen name="quran/search" />
          <Stack.Screen name="quran/bookmarks" />
          <Stack.Screen name="quran/mushaf/[pageNumber]" />
        </Stack>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
