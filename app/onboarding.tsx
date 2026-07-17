import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import { ArchFrame } from '../src/components/basirah/LogoMark';
import { Press, PrimaryButton } from '../src/components/basirah/primitives';
import Txt from '../src/components/basirah/Txt';
import { useTheme } from '../src/theme/ThemeContext';
import { ONBOARDED_KEY } from './index';

const SLIDES = [
  {
    title: 'القرآن الكريم بين يديك',
    desc: 'اقرأ القرآن الكريم بخطٍّ واضح وتجربةٍ مريحة مصمّمة للتدبر والتركيز.',
    caption: 'مصحف مفتوح',
    btn: 'التالي',
  },
  {
    title: 'افهم الآيات بعمق',
    desc: 'استكشف تفاسير موثوقة، أسباب النزول، ومعاني الكلمات بسهولة.',
    caption: 'صفحة + بطاقات معرفة',
    btn: 'التالي',
  },
  {
    title: 'اسأل بصيرة',
    desc: 'ابحث عن الآيات والموضوعات، واحصل على إجاباتٍ مرتبطة بالمصادر والتفاسير المعتمدة.',
    caption: 'محادثة ذكية + مصادر',
    btn: 'ابدأ رحلتك',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const float = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* non-fatal */
    }
    router.replace('/(tabs)/home');
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1)), 120);
  };

  const slide = SLIDES[index];
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {/* skip — trailing (left) edge per spec */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 14 }}>
        <Press onPress={finish} accessibilityLabel="تخطي">
          <Txt size={14} weight={600} color={colors.text2}>
            تخطي
          </Txt>
        </Press>
      </View>

      <Animated.View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, opacity: fade }}
      >
        {/* illustration card */}
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 32,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginBottom: 40,
          }}
        >
          <Svg width={240} height={240} style={{ position: 'absolute', opacity: 0.5 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <Line
                key={i}
                x1={-40 + i * 26}
                y1={260}
                x2={-40 + i * 26 + 260}
                y2={0}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="1 12"
              />
            ))}
          </Svg>
          <Animated.View style={{ transform: [{ translateY }] }}>
            <ArchFrame size={150} borderColor={colors.emerald} backgroundColor={colors.surface}>
              <Svg width={80} height={82} viewBox="0 0 66 72" fill="none">
                <Path
                  d="M6 46 Q33 32 33 32 Q33 32 60 46 L60 60 Q33 48 6 60 Z"
                  fill={colors.emerald}
                  fillOpacity={0.14}
                  stroke={colors.emerald}
                  strokeWidth={1.5}
                />
                <Path d="M33 32 V60" stroke={colors.gold} strokeWidth={1.5} />
                <Path
                  d="M33 6 l2.8 5.8 6.4 .9 -4.6 4.5 1.1 6.3 -5.7 -3 -5.7 3 1.1 -6.3 -4.6 -4.5 6.4 -.9 Z"
                  fill={colors.gold}
                />
              </Svg>
            </ArchFrame>
          </Animated.View>
          <Txt
            size={9.5}
            color={colors.text3}
            align="center"
            style={{
              position: 'absolute',
              bottom: 16,
              fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
            }}
          >
            {slide.caption}
          </Txt>
        </View>

        <Txt size={26} weight={700} color={colors.text} align="center" style={{ marginBottom: 14 }}>
          {slide.title}
        </Txt>
        <Txt size={15} lh={1.9} color={colors.text2} align="center" style={{ maxWidth: 300 }}>
          {slide.desc}
        </Txt>
      </Animated.View>

      <View style={{ paddingHorizontal: 34, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 26 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.emerald : colors.border,
              }}
            />
          ))}
        </View>
        <PrimaryButton title={slide.btn} onPress={next} />
      </View>
    </SafeAreaView>
  );
}
