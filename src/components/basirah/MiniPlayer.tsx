import { router } from 'expo-router';
import { View } from 'react-native';
import { FONT } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { usePlayback } from '../../hooks/usePlayback';
import { stripSurahPrefix } from '../../utils/numerals';
import Icon from './Icon';
import { Press } from './primitives';
import Txt from './Txt';

/**
 * Persistent mini-player pinned above the bottom nav whenever a
 * recitation is loaded. Tapping it opens the full player.
 */
export default function MiniPlayer() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { track, playing, togglePlay } = usePlayback();

  if (!track) return null;

  // Sibling pressables (not nested) so web doesn't produce a <button> inside
  // a <button>: the left area opens the full player, the right toggles play.
  return (
    <View
      style={{
        marginHorizontal: 10,
        marginBottom: 6,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: colors.emerald,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        shadowColor: colors.emerald,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 7,
      }}
    >
      <Press
        onPress={() => router.push('/player')}
        accessibilityLabel={t('player.openPlayer')}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: 'rgba(255,255,255,.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={15} color="#F7F2E5" align="center" style={{ fontFamily: FONT.amiriBold }}>
            {track.reciter.mono}
          </Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={12.5} weight={700} color="#F7F2E5" numberOfLines={1}>
            {t('common.surah')} {stripSurahPrefix(track.surahName)}
          </Txt>
          <Txt size={10.5} color="rgba(247,242,229,.7)" numberOfLines={1}>
            {t(track.reciter.nameKey)}
          </Txt>
        </View>
      </Press>
      <Press
        onPress={togglePlay}
        accessibilityLabel={playing ? t('player.pause') : t('player.play')}
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: 'rgba(255,255,255,.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color="#F7F2E5" />
      </Press>
    </View>
  );
}
