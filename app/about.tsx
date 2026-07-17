import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../src/components/basirah/Icon';
import { ArchFrame, BookStarGlyph } from '../src/components/basirah/LogoMark';
import { Card, Press } from '../src/components/basirah/primitives';
import Txt from '../src/components/basirah/Txt';
import { useTheme } from '../src/theme/ThemeContext';
import { LAYOUT } from '../src/theme/tokens';
import { toArabicDigits } from '../src/utils/numerals';

const SECTIONS = [
  {
    title: 'عن بصيرة',
    body: 'بصيرة تطبيق لقراءة القرآن الكريم وتدبّره: مصحف بخط عثماني، تفسير موثّق، بحث في معاني الآيات، تلاوات، ومساعد يجيب من مصادر معتمدة فقط.',
  },
  {
    title: 'مصادر القرآن والتفسير',
    body: 'يُعرض النص القرآني من نسخة عثمانية موثّقة، والتفسير من «تيسير الكريم الرحمن» للشيخ عبد الرحمن السعدي. لا يولّد التطبيق نصًا دينيًا ولا يستخدم أي خدمة ذكاء اصطناعي خارجية.',
  },
  {
    title: 'خصوصيتك',
    body: 'كل البيانات (العلامات، الملاحظات، الإعدادات، سجل القراءة) تُحفظ على جهازك فقط. لا يجمع التطبيق بياناتك ولا يرسلها إلى أي خادم.',
  },
];

export default function AboutScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: LAYOUT.screenX, paddingVertical: 12, paddingBottom: 18 }}>
        <Press
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          accessibilityLabel="رجوع"
          style={{ width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chevronBack" size={20} color={colors.text} strokeWidth={1.9} />
        </Press>
        <Txt size={22} weight={700} color={colors.text}>
          عن بصيرة
        </Txt>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 30 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <ArchFrame size={96} borderColor={colors.gold} backgroundColor={colors.surface}>
            <BookStarGlyph width={52} lines={colors.emerald} bookFill={colors.emerald} spine={colors.gold} star={colors.gold} />
          </ArchFrame>
          <Txt amiri size={34} weight={700} color={colors.emerald} align="center" style={{ marginTop: 14 }}>
            بصيرة
          </Txt>
          <Txt size={12.5} color={colors.text2} align="center" style={{ marginTop: 4 }}>
            القرآن بفهمٍ أعمق • الإصدار {toArabicDigits('1.0.0')}
          </Txt>
        </View>

        <View style={{ gap: 14 }}>
          {SECTIONS.map((s) => (
            <Card key={s.title} padding={18} radius={16}>
              <Txt size={14} weight={700} color={colors.text} style={{ marginBottom: 8 }}>
                {s.title}
              </Txt>
              <Txt size={13.5} lh={1.9} color={colors.text2} style={{ textAlign: 'justify' }}>
                {s.body}
              </Txt>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
