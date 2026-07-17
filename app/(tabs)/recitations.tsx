import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../src/components/basirah/Icon';
import { Press, SegmentedTabs } from '../../src/components/basirah/primitives';
import { useToast } from '../../src/components/basirah/Toast';
import Txt from '../../src/components/basirah/Txt';
import { usePlayback, RECITERS } from '../../src/hooks/usePlayback';
import { FONT } from '../../src/theme/fonts';
import { useTheme } from '../../src/theme/ThemeContext';
import { LAYOUT } from '../../src/theme/tokens';
import { toArabicDigits } from '../../src/utils/numerals';

const TABS = ['القراء', 'السور', 'التنزيلات', 'قوائمي'];
const FILTERS = ['حفص عن عاصم', 'ترتيل', 'تجويد', 'جودة عالية', 'متاح دون إنترنت'];

export default function RecitationsScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { startTrack } = usePlayback();
  const [tab, setTab] = useState(0);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const filtered = RECITERS.filter((r) => !query.trim() || r.name.includes(query.trim()));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Txt size={24} weight={700} color={colors.text} style={{ marginHorizontal: LAYOUT.screenX, marginTop: 8, marginBottom: 16 }}>
          التلاوات
        </Txt>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 46,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginHorizontal: LAYOUT.screenX,
            marginBottom: 16,
          }}
        >
          <Icon name="search" size={18} color={colors.text2} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن قارئ أو سورة"
            placeholderTextColor={colors.text2}
            style={{ flex: 1, fontFamily: FONT.ui400, fontSize: 13, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
          />
        </View>

        <View style={{ marginHorizontal: LAYOUT.screenX, marginBottom: 16 }}>
          <SegmentedTabs items={TABS} active={tab} onChange={setTab} height={36} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, gap: 8, paddingBottom: 16 }}
        >
          {FILTERS.map((f) => (
            <View
              key={f}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 13,
                borderRadius: 12,
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Txt size={11.5} color={colors.text2}>
                {f}
              </Txt>
            </View>
          ))}
        </ScrollView>

        <Txt size={15} weight={700} color={colors.text} style={{ marginHorizontal: LAYOUT.screenX, marginBottom: 12 }}>
          {tab === 3 ? 'قوائمي' : 'القرّاء'}
        </Txt>

        <View style={{ paddingHorizontal: LAYOUT.screenX, gap: 10 }}>
          {filtered.map((r) => {
            const fav = !!favorites[r.id];
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  padding: 13,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <LinearGradient
                  colors={r.gradient}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={{ width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Txt size={20} color="#F7F2E5" align="center" style={{ fontFamily: FONT.amiriBold }}>
                    {r.mono}
                  </Txt>
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={14} weight={700} color={colors.text}>
                    {r.name}
                  </Txt>
                  <Txt size={11.5} color={colors.text2}>
                    {r.type} • {toArabicDigits(114)} سورة
                  </Txt>
                </View>
                <Press
                  onPress={() => {
                    setFavorites((prev) => ({ ...prev, [r.id]: !prev[r.id] }));
                    showToast(fav ? 'أُزيلت من المفضلة' : 'أُضيفت إلى المفضلة');
                  }}
                  accessibilityLabel="مفضلة"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="heart" size={17} color={fav ? colors.error : colors.text2} filled={fav} strokeWidth={1.7} />
                </Press>
                <Press
                  onPress={() => {
                    startTrack({ surahNumber: 67, surahName: 'الملك', ayahCount: 30, reciter: r });
                    router.push('/player');
                  }}
                  accessibilityLabel="تشغيل"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    backgroundColor: colors.emerald,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="play" size={17} color="#fff" />
                </Press>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
