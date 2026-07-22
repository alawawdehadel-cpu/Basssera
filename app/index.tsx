import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArchFrame, BookStarGlyph } from '../src/components/basirah/LogoMark';
import Txt from '../src/components/basirah/Txt';
import { useAppLanguage } from '../src/hooks/useAppLanguage';

export const ONBOARDED_KEY = 'basirah-onboarded-v1';

const SPLASH_MS = 2300;

/**
 * Splash — full-bleed emerald gradient, centered mark, Amiri wordmark,
 * spinning gold loader. Auto-advances after ~2.3s (or on tap) to
 * onboarding on first launch, straight to the tabs afterwards.
 */
export default function SplashScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const { t } = useAppLanguage();
  const navigatedRef = useRef(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const advance = async () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    let onboarded = false;
    try {
      onboarded = (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
    } catch {
      /* treat as first launch */
    }
    router.replace(onboarded ? '/(tabs)/home' : '/onboarding');
  };

  useEffect(() => {
    const t = setTimeout(advance, SPLASH_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable style={{ flex: 1 }} onPress={advance}>
      <LinearGradient
        colors={['#0F6B50', '#084C3C', '#06362D']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* faint star-dot texture */}
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', opacity: 0.1 }}
          viewBox="0 0 393 852"
          preserveAspectRatio="xMidYMid slice"
        >
          {[
            [60, 90], [280, 60], [180, 160], [330, 220], [40, 300], [230, 330],
            [120, 460], [320, 480], [70, 620], [200, 580], [300, 700], [140, 740],
          ].map(([cx, cy], i) => (
            <Circle key={i} cx={cx} cy={cy} r={1.3} fill="#fff" />
          ))}
        </Svg>
        {/* skyline silhouette */}
        <Svg
          width="100%"
          height={150}
          viewBox="0 0 393 150"
          preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, opacity: 0.35 }}
        >
          <Path
            d="M0 150 V95 h40 v-18 a26 26 0 0 1 52 0 v18 h30 V70 l24 -22 24 22 v25 h30 v-30 a30 30 0 0 1 60 0 v30 h28 V80 l22 -20 22 20 v70 Z"
            fill="#052a22"
          />
        </Svg>

        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 126, height: 126, alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
            <View
              style={{
                position: 'absolute',
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: 'rgba(223,201,108,.18)',
              }}
            />
            <ArchFrame size={118} borderColor="rgba(223,201,108,.55)">
              <BookStarGlyph width={66} lines="#0F6B50" />
            </ArchFrame>
          </View>
          <Txt amiri size={52} weight={700} color="#F7F2E5" align="center" style={{ letterSpacing: 1 }}>
            بصيرة
          </Txt>
          <Txt size={15} weight={500} color="#DFC96C" align="center" style={{ marginTop: 14 }}>
            {t('splash.tagline')}
          </Txt>
          <Txt size={12} color="rgba(247,242,229,.55)" align="center" style={{ marginTop: 8 }}>
            {t('splash.sub')}
          </Txt>
        </View>

        <Animated.View
          style={{
            position: 'absolute',
            bottom: 64,
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2.5,
            borderColor: 'rgba(223,201,108,.25)',
            borderTopColor: '#DFC96C',
            transform: [{ rotate }],
          }}
        />
      </LinearGradient>
    </Pressable>
  );
}
