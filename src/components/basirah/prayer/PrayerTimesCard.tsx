import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import { usePrayerTimes } from '../../../hooks/usePrayerTimes';
import { useTheme } from '../../../theme/ThemeContext';
import { NEXT_PRAYER_ORDER, PRAYER_LABEL_KEYS } from '../../../types/prayer.types';
import { formatCountdown } from '../../../utils/prayerTimeUtils';
import Icon from '../Icon';
import { Card, Press } from '../primitives';
import { Skeleton } from '../states';
import Txt from '../Txt';
import PrayerLocationModal from './PrayerLocationModal';
import PrayerStateBlock, { type PrayerAction } from './PrayerStateBlock';

/**
 * Home-screen prayer times card: current location, the live next-prayer
 * countdown, and a compact strip of the five prayers.
 */
export default function PrayerTimesCard() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const {
    status,
    offline,
    refreshing,
    rows,
    next,
    location,
    refresh,
    useCurrentLocation,
    openAppSettings,
  } = usePrayerTimes();
  const [locationOpen, setLocationOpen] = useState(false);

  const openManual = () => setLocationOpen(true);

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: colors.emeraldTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="clock" size={16} color={colors.emerald} strokeWidth={1.8} />
        </View>
        <Txt size={16} weight={700} color={colors.text}>
          {t('prayer.title')}
        </Txt>
      </View>
      {location ? (
        <Press
          onPress={openManual}
          accessibilityLabel={`${t('prayer.changeLocation')} — ${location.label}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minHeight: 44,
            paddingHorizontal: 4,
          }}
        >
          <Icon name="mapPin" size={14} color={colors.text2} strokeWidth={1.8} />
          <Txt size={11.5} color={colors.text2} numberOfLines={1} style={{ maxWidth: 130 }}>
            {location.label}
          </Txt>
        </Press>
      ) : null}
    </View>
  );

  const renderStates = (): React.ReactNode => {
    if (status === 'loading') {
      return (
        <View style={{ gap: 10, paddingVertical: 4 }}>
          <Skeleton width="45%" height={13} />
          <Skeleton width="70%" height={22} />
          <Skeleton width="35%" height={13} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {NEXT_PRAYER_ORDER.map((key) => (
              <View key={key} style={{ flex: 1, gap: 6 }}>
                <Skeleton height={10} />
                <Skeleton height={12} />
              </View>
            ))}
          </View>
          <Txt size={11.5} color={colors.text3} align="center" style={{ marginTop: 6 }}>
            {t('prayer.loading')}
          </Txt>
        </View>
      );
    }

    const actionsFor = (): PrayerAction[] => {
      switch (status) {
        case 'permission-denied':
          return [
            { label: t('prayer.pickManually'), onPress: openManual },
            { label: t('prayer.openSettings'), onPress: openAppSettings, variant: 'outline' },
          ];
        case 'location-unavailable':
          return [
            { label: t('common.retry'), onPress: () => void useCurrentLocation() },
            { label: t('prayer.pickManually'), onPress: openManual, variant: 'outline' },
          ];
        case 'error':
          return [
            { label: t('common.retry'), onPress: () => void refresh() },
            { label: t('prayer.pickAnotherCity'), onPress: openManual, variant: 'outline' },
          ];
        default:
          return [
            { label: t('prayer.allowLocation'), onPress: () => void useCurrentLocation() },
            { label: t('prayer.pickManually'), onPress: openManual, variant: 'outline' },
          ];
      }
    };

    const copyFor = () => {
      switch (status) {
        case 'permission-denied':
          return { title: t('prayer.permissionDenied'), body: t('prayer.permissionRationale') };
        case 'location-unavailable':
          return { title: t('prayer.locationUnavailable'), body: undefined };
        case 'error':
          return { title: t('prayer.noCache'), body: undefined };
        default:
          return { title: t('prayer.needsLocation'), body: t('prayer.enableHint') };
      }
    };

    const copy = copyFor();
    return (
      <PrayerStateBlock
        compact
        icon={status === 'error' ? 'wifiOff' : 'mapPin'}
        title={copy.title}
        body={copy.body}
        actions={actionsFor()}
      />
    );
  };

  const isReady = status === 'ready' && !!next && rows.length > 0;

  return (
    <>
      <Card padding={16} radius={18} style={{ marginBottom: 22 }}>
        {header}

        {!isReady ? (
          renderStates()
        ) : (
          <>
            {offline ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.goldTint,
                  borderRadius: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  marginBottom: 12,
                }}
              >
                <Icon name="wifiOff" size={13} color={colors.gold} strokeWidth={1.8} />
                <Txt size={10.5} color={colors.text2} style={{ flex: 1 }}>
                  {t('prayer.lastSaved')}
                </Txt>
              </View>
            ) : null}

            <Txt size={11} color={colors.text2} style={{ marginBottom: 4 }}>
              {t('prayer.nextLabel')}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Txt size={22} weight={700} color={colors.emerald}>
                {t(PRAYER_LABEL_KEYS[next!.key])}
                {next!.isTomorrow ? ` (${t('common.tomorrow')})` : ''}
              </Txt>
              <Txt size={17} weight={700} color={colors.gold}>
                {next!.timeLabel}
              </Txt>
            </View>
            <Txt size={13} weight={600} color={colors.text2} style={{ marginBottom: 14 }}>
              {next!.currentKey
                ? t('prayer.nowFor', { name: t(PRAYER_LABEL_KEYS[next!.currentKey]) })
                : t('prayer.countdown', { time: formatCountdown(next!.secondsUntil) })}
            </Txt>

            {/* five-prayer strip */}
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 12,
                marginBottom: 12,
              }}
            >
              {rows
                .filter((row) => row.key !== 'sunrise')
                .map((row) => {
                  const isNext = row.key === next!.key && !next!.isTomorrow;
                  const name = t(PRAYER_LABEL_KEYS[row.key]);
                  return (
                    <View
                      key={row.key}
                      accessibilityLabel={
                        isNext
                          ? `${name} ${row.timeLabel}, ${t('prayer.nextLabel')}`
                          : `${name} ${row.timeLabel}`
                      }
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 3,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: isNext ? colors.emeraldTint : 'transparent',
                        borderWidth: isNext ? 1 : 0,
                        borderColor: isNext ? colors.emerald : 'transparent',
                      }}
                    >
                      {/* shape marker keeps the next prayer identifiable without relying on colour alone */}
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isNext ? colors.emerald : 'transparent',
                        }}
                      />
                      <Txt
                        size={10.5}
                        weight={isNext ? 700 : 500}
                        align="center"
                        color={isNext ? colors.emerald : colors.text2}
                        numberOfLines={1}
                      >
                        {name}
                      </Txt>
                      <Txt
                        size={11.5}
                        weight={isNext ? 700 : 600}
                        align="center"
                        color={isNext ? colors.emerald : colors.text}
                        numberOfLines={1}
                      >
                        {row.timeLabel}
                      </Txt>
                    </View>
                  );
                })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Press
                onPress={() => router.push('/prayer-times')}
                accessibilityLabel={t('prayer.viewAll')}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  backgroundColor: colors.emerald,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={13} weight={700} color="#fff" align="center">
                  {t('prayer.viewAll')}
                </Txt>
              </Press>
              <Press
                onPress={() => void refresh()}
                accessibilityLabel={t('prayer.refresh')}
                disabled={refreshing}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: refreshing ? 0.5 : 1,
                }}
              >
                <Icon name="refresh" size={18} color={colors.text} strokeWidth={1.8} />
              </Press>
            </View>
          </>
        )}
      </Card>

      <PrayerLocationModal visible={locationOpen} onClose={() => setLocationOpen(false)} />
    </>
  );
}
