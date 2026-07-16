import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoadingState from '../src/components/ui/LoadingState';
import { COLORS } from '../src/constants/colors';
import { LanguageProvider } from '../src/hooks/useAppLanguage';

export default function RootLayout() {
  // The dedicated Quran font must be ready before any Quran text renders,
  // otherwise the reader would flash broken/fallback Uthmani glyphs.
  const [fontsLoaded] = useFonts({
    QuranFont: require('../assets/fonts/QuranFont.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.parchment, justifyContent: 'center' }}>
          <LoadingState label="…" />
        </View>
      </SafeAreaProvider>
    );
  }

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
