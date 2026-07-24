import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HadithResults from '../src/components/basirah/hadith/HadithResults';
import Icon from '../src/components/basirah/Icon';
import { Press } from '../src/components/basirah/primitives';
import Txt from '../src/components/basirah/Txt';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { useHadithSearch } from '../src/hooks/useHadithSearch';
import { FONT } from '../src/theme/fonts';
import { useTheme } from '../src/theme/ThemeContext';
import { LAYOUT } from '../src/theme/tokens';

/** Dedicated hadith search screen (الموسوعة الحديثية — الدرر السنية). */
export default function HadithScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const { t, isRTL } = useAppLanguage();
  const search = useHadithSearch();
  const inputRef = useRef<TextInput>(null);
  const seededRef = useRef<string | null>(null);

  // Allow deep-linking a query in, e.g. from Smart Search.
  useEffect(() => {
    if (params.q && params.q !== seededRef.current) {
      seededRef.current = params.q;
      search.submit(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

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
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          accessibilityLabel={t('common.back')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
        </Press>
        <Txt size={20} weight={700} color={colors.text}>
          {t('hadith.title')}
        </Txt>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 30 }}
      >
        {/* search field */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 54,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.emerald,
            marginBottom: 14,
          }}
        >
          <Icon name="search" size={20} color={colors.emerald} strokeWidth={1.9} />
          <TextInput
            ref={inputRef}
            value={search.query}
            onChangeText={search.setQuery}
            onSubmitEditing={() => search.submit()}
            returnKeyType="search"
            placeholder={t('hadith.searchPlaceholder')}
            placeholderTextColor={colors.text2}
            accessibilityLabel={t('hadith.searchLabel')}
            style={{
              flex: 1,
              fontFamily: FONT.ui400,
              fontSize: 13.5,
              color: colors.text,
              textAlign: isRTL ? 'right' : 'left',
              paddingVertical: 0,
            }}
          />
          {search.query ? (
            <Press
              onPress={() => {
                search.setQuery('');
                search.reset();
                inputRef.current?.focus();
              }}
              accessibilityLabel={t('states.close')}
              style={{ width: 30, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={16} color={colors.text2} strokeWidth={2} />
            </Press>
          ) : null}
        </View>

        <HadithResults search={search} />
      </ScrollView>
    </SafeAreaView>
  );
}
