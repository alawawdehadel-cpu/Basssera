import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../src/components/basirah/Icon';
import { PillSwitch, Press } from '../src/components/basirah/primitives';
import { useToast } from '../src/components/basirah/Toast';
import Txt from '../src/components/basirah/Txt';
import { FONT_STEP_LABELS, useSettings } from '../src/hooks/useSettings';
import { useTheme, type ThemeMode } from '../src/theme/ThemeContext';
import { LAYOUT } from '../src/theme/tokens';
import { toArabicDigits } from '../src/utils/numerals';

function GroupCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

function GroupTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Txt size={12} weight={700} color={colors.emerald} style={{ marginBottom: 10 }}>
      {title}
    </Txt>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { showToast } = useToast();
  const { quranFontSize, fontStep, setFontStep, keepAwake, showSources, wifiOnly, dailyReminder, toggleFlag } =
    useSettings();

  const themeOptions: { key: ThemeMode; label: string }[] = [
    { key: 'light', label: 'فاتح' },
    { key: 'dark', label: 'داكن' },
    { key: 'system', label: 'حسب النظام' },
  ];

  const toggleRows: { label: string; value: boolean; key: 'keepAwake' | 'showSources' }[] = [
    { label: 'إبقاء الشاشة مضاءة', value: keepAwake, key: 'keepAwake' },
    { label: 'إظهار المصادر دائمًا', value: showSources, key: 'showSources' },
  ];

  const valueRows: { label: string; value: string; key?: 'wifiOnly' }[] = [
    { label: 'جودة الصوت', value: 'عالية' },
    { label: 'التنزيل عبر Wi-Fi فقط', value: wifiOnly ? 'مُفعّل' : 'مغلق', key: 'wifiOnly' },
    { label: 'مدة التقديم والتأخير', value: `${toArabicDigits(10)} ث` },
    { label: 'تذكير الورد اليومي', value: dailyReminder ? `${toArabicDigits(6)}:${toArabicDigits('00')} ص` : 'مغلق' },
  ];

  const aboutRows = ['عن بصيرة', 'مصادر القرآن والتفسير', 'سياسة الخصوصية', 'تواصل معنا'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: LAYOUT.screenX, paddingVertical: 12, paddingBottom: 18 }}>
        <Press
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="رجوع"
          style={{ width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
        </Press>
        <Txt size={22} weight={700} color={colors.text}>
          الإعدادات
        </Txt>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 30 }}>
        {/* المظهر */}
        <View style={{ marginBottom: 20 }}>
          <GroupTitle title="المظهر" />
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 6, flexDirection: 'row', gap: 4 }}>
            {themeOptions.map((opt) => {
              const active = mode === opt.key;
              return (
                <Press
                  key={opt.key}
                  onPress={() => setMode(opt.key)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: active ? colors.emerald : colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={13} weight={600} color={active ? '#fff' : colors.text2} align="center">
                    {opt.label}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </View>

        {/* القراءة */}
        <View style={{ marginBottom: 20 }}>
          <GroupTitle title="القراءة" />
          <GroupCard>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Txt size={13.5} weight={600} color={colors.text}>
                  حجم خط القرآن
                </Txt>
                <Txt size={12} weight={700} color={colors.emerald}>
                  {FONT_STEP_LABELS[fontStep]}
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt size={11} color={colors.text2}>
                  أ
                </Txt>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  {FONT_STEP_LABELS.map((_, i) => (
                    <Press key={i} onPress={() => setFontStep(i)} style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                      <View
                        style={{
                          width: i === fontStep ? 18 : 10,
                          height: i === fontStep ? 18 : 10,
                          borderRadius: 9,
                          backgroundColor: i <= fontStep ? colors.emerald : colors.border,
                        }}
                      />
                    </Press>
                  ))}
                </View>
                <Txt size={18} color={colors.text2}>
                  أ
                </Txt>
              </View>
              <Txt size={22} align="center" color={colors.readerText} style={{ fontFamily: 'QuranFont', fontSize: quranFontSize, marginTop: 10 }} numberOfLines={1}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </Txt>
            </View>
            {toggleRows.map((row, i) => (
              <View
                key={row.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderBottomWidth: i < toggleRows.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Txt size={13.5} color={colors.text}>
                  {row.label}
                </Txt>
                <PillSwitch value={row.value} onToggle={() => toggleFlag(row.key)} />
              </View>
            ))}
          </GroupCard>
        </View>

        {/* الصوت والتنزيلات */}
        <View style={{ marginBottom: 20 }}>
          <GroupTitle title="الصوت والتنزيلات" />
          <GroupCard>
            {valueRows.map((row, i) => (
              <Press
                key={row.label}
                onPress={() => {
                  if (row.key === 'wifiOnly') toggleFlag('wifiOnly');
                  else showToast('هذا الخيار للعرض في هذه النسخة');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderBottomWidth: i < valueRows.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Txt size={13.5} color={colors.text}>
                  {row.label}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Txt size={12} color={colors.text2}>
                    {row.value}
                  </Txt>
                  <Icon name="chevronBack" size={15} color={colors.text2} strokeWidth={2} />
                </View>
              </Press>
            ))}
          </GroupCard>
        </View>

        {/* عن بصيرة */}
        <View style={{ marginBottom: 20 }}>
          <GroupTitle title="عن بصيرة" />
          <GroupCard>
            {aboutRows.map((label, i) => (
              <Press
                key={label}
                onPress={() => router.push('/about')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderBottomWidth: i < aboutRows.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Txt size={13.5} color={colors.text}>
                  {label}
                </Txt>
                <Icon name="chevronBack" size={15} color={colors.text2} strokeWidth={2} />
              </Press>
            ))}
          </GroupCard>
        </View>

        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <Txt size={11} color={colors.text3} align="center">
            بصيرة • الإصدار {toArabicDigits('1.0.0')}
          </Txt>
          <Txt size={10.5} color={colors.text3} align="center" style={{ marginTop: 4 }}>
            المحتوى القرآني والتفسير من مصادر معتمدة
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
