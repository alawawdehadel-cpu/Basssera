import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import Icon from '../src/components/basirah/Icon';
import { Press } from '../src/components/basirah/primitives';
import { useToast } from '../src/components/basirah/Toast';
import Txt from '../src/components/basirah/Txt';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { usePlayback } from '../src/hooks/usePlayback';
import { FONT } from '../src/theme/fonts';
import { useTheme } from '../src/theme/ThemeContext';
import { getAyah } from '../src/utils/quranDataLoader';
import { formatNumber, stripSurahPrefix, toArabicTime } from '../src/utils/numerals';

export default function PlayerScreen() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { showToast } = useToast();
  const { track, playing, position, duration, speed, repeatOn, togglePlay, seekBy, cycleSpeed, toggleRepeat } =
    usePlayback();

  // If somehow opened with nothing playing, go back.
  useEffect(() => {
    if (!track) router.replace('/(tabs)/recitations');
  }, [track]);

  if (!track) return <View style={{ flex: 1, backgroundColor: colors.emerald2 }} />;

  const fraction = duration > 0 ? position / duration : 0;
  // "synced" current ayah, estimated from progress over the surah.
  const currentAyahNumber = Math.min(track.ayahCount, Math.max(1, Math.ceil(fraction * track.ayahCount) || 1));
  const currentAyah = getAyah(track.surahNumber, currentAyahNumber);

  const secondaryButtons: { label: string; icon: Parameters<typeof Icon>[0]['name']; active?: boolean; onPress: () => void }[] = [
    { label: t('player.speed', { value: formatNumber(speed % 1 === 0 ? speed : speed.toFixed(2)) }), icon: 'bolt', active: speed !== 1, onPress: cycleSpeed },
    { label: t('player.timer'), icon: 'timer', onPress: () => showToast(t('player.timerUnavailable')) },
    { label: t('player.repeat'), icon: 'repeat', active: repeatOn, onPress: toggleRepeat },
    { label: t('player.download'), icon: 'download', onPress: () => showToast(t('player.downloadUnavailable')) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.emerald2 }}>
      <LinearGradient
        colors={[colors.emerald2, colors.emerald3]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 26 }}>
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Press
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/recitations'))}
                accessibilityLabel={t('player.close')}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="chevronDown" size={22} color="#F7F2E5" strokeWidth={1.9} />
              </Press>
              <Txt size={12} color="rgba(247,242,229,.7)">
                {t('player.nowPlaying')}
              </Txt>
              <Press
                onPress={() => showToast(t('player.noOptions'))}
                accessibilityLabel={t('player.options')}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="dots" size={22} color="#F7F2E5" />
              </Press>
            </View>

            {/* artwork */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 230,
                  height: 230,
                  borderRadius: 32,
                  borderWidth: 1,
                  borderColor: 'rgba(223,201,108,.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 30,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,.08)', 'rgba(0,0,0,.15)']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                />
                <Svg width={230} height={230} style={{ position: 'absolute' }}>
                  <Circle cx={115} cy={115} r={95} stroke="rgba(223,201,108,.25)" strokeWidth={1} fill="none" />
                  <Circle cx={115} cy={115} r={75} stroke="rgba(223,201,108,.2)" strokeWidth={1} fill="none" />
                </Svg>
                <Svg width={70} height={74} viewBox="0 0 66 72" fill="none">
                  <Path d="M6 46 Q33 32 33 32 Q33 32 60 46 L60 60 Q33 48 6 60 Z" fill="#F7F2E5" fillOpacity={0.9} />
                  <Path d="M33 32V60" stroke="#C9A227" strokeWidth={1.6} />
                  <Path d="M33 8l2.6 5.4 6 .8-4.3 4.2 1 5.9-5.3-2.8-5.3 2.8 1-5.9-4.3-4.2 6-.8Z" fill="#DFC96C" />
                </Svg>
              </View>
              <Txt size={28} weight={700} amiri color="#F7F2E5" align="center">
                {t('common.surah')} {stripSurahPrefix(track.surahName)}
              </Txt>
              <Txt size={14} color="#DFC96C" align="center" style={{ marginTop: 6 }}>
                {t(track.reciter.nameKey)}
              </Txt>
              <Txt size={11.5} color="rgba(247,242,229,.6)" align="center" style={{ marginTop: 4 }}>
                {t('player.surahMeta', { number: formatNumber(track.surahNumber), count: formatNumber(track.ayahCount) })}
              </Txt>
            </View>

            {/* progress */}
            <View style={{ marginBottom: 22 }}>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.15)', overflow: 'hidden', marginBottom: 8 }}>
                <LinearGradient
                  colors={['#DFC96C', '#C9A227']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: '100%', width: `${fraction * 100}%`, borderRadius: 3, alignSelf: 'flex-start' }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt size={11} color="rgba(247,242,229,.6)">
                  {toArabicTime(position)}
                </Txt>
                <Txt size={11} color="rgba(247,242,229,.6)">
                  {toArabicTime(duration)}
                </Txt>
              </View>
            </View>

            {/* transport */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <Press onPress={() => seekBy(-duration)} accessibilityLabel={t('player.prev')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="skipPrev" size={26} color="#F7F2E5" />
              </Press>
              <Press onPress={() => seekBy(-10)} accessibilityLabel={t('player.seekBack')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="seekBack10" size={24} color="#F7F2E5" strokeWidth={1.7} />
              </Press>
              <Press
                onPress={togglePlay}
                accessibilityLabel={playing ? t('player.pause') : t('player.play')}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#F7F2E5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.5,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 8,
                }}
              >
                <Icon name={playing ? 'pause' : 'play'} size={30} color={colors.emerald2} />
              </Press>
              <Press onPress={() => seekBy(10)} accessibilityLabel={t('player.seekForward')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="seekFwd10" size={24} color="#F7F2E5" strokeWidth={1.7} />
              </Press>
              <Press onPress={() => seekBy(duration)} accessibilityLabel={t('player.next')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="skipNext" size={26} color="#F7F2E5" />
              </Press>
            </View>

            {/* secondary controls */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,.12)',
                marginBottom: 16,
              }}
            >
              {secondaryButtons.map((b) => (
                <Press key={b.label} onPress={b.onPress} style={{ alignItems: 'center', gap: 5 }}>
                  <Icon name={b.icon} size={19} color={b.active ? '#DFC96C' : 'rgba(247,242,229,.7)'} strokeWidth={1.7} />
                  <Txt size={11} weight={600} color={b.active ? '#DFC96C' : 'rgba(247,242,229,.7)'} align="center">
                    {b.label}
                  </Txt>
                </Press>
              ))}
            </View>

            {/* synced current verse */}
            <View
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,.07)',
                borderWidth: 1,
                borderColor: 'rgba(223,201,108,.25)',
              }}
            >
              <Txt size={10} color="#DFC96C" style={{ marginBottom: 6 }}>
                {t('player.currentAyah', { n: formatNumber(currentAyahNumber) })}
              </Txt>
              <Txt size={19} lh={1.9} align="center" color="#F7F2E5" style={{ fontFamily: FONT.quran }} numberOfLines={3}>
                {currentAyah?.textUthmani ?? '﴿ … ﴾'}
              </Txt>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
