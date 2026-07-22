import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../src/components/basirah/Icon';
import PrayerLocationModal from '../src/components/basirah/prayer/PrayerLocationModal';
import PrayerSettingsSheet from '../src/components/basirah/prayer/PrayerSettingsSheet';
import PrayerStateBlock, { type PrayerAction } from '../src/components/basirah/prayer/PrayerStateBlock';
import { PRAYER_ICONS } from '../src/components/basirah/prayer/shared';
import { Card, Press, ProgressBar } from '../src/components/basirah/primitives';
import { Skeleton } from '../src/components/basirah/states';
import Txt from '../src/components/basirah/Txt';
import { useAppLanguage } from '../src/hooks/useAppLanguage';
import { usePrayerTimes } from '../src/hooks/usePrayerTimes';
import { useTheme } from '../src/theme/ThemeContext';
import { LAYOUT } from '../src/theme/tokens';
import { CALCULATION_METHODS, PRAYER_LABEL_KEYS } from '../src/types/prayer.types';
import {
  formatCountdown,
  formatGregorianLabel,
  formatHijriLabel,
  formatLastUpdated,
} from '../src/utils/prayerTimeUtils';

/** Full prayer-times screen: location, hero countdown and the daily schedule. */
export default function PrayerTimesScreen() {
  const { colors } = useTheme();
  const { t, lang } = useAppLanguage();
  const {
    status,
    refreshing,
    offline,
    lastUpdated,
    location,
    settings,
    today,
    rows,
    next,
    refresh,
    useCurrentLocation,
    openAppSettings,
  } = usePrayerTimes();

  const [locationOpen, setLocationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isReady = status === 'ready' && !!next && rows.length > 0 && !!today;

  const methodLabel = (() => {
    if (!today) return '';
    const known = CALCULATION_METHODS.find((m) => m.id === today.methodId);
    return known ? t(known.labelKey) : today.methodName || t('prayer.defaultMethod');
  })();

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: LAYOUT.screenX,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
          {t('prayer.title')}
        </Txt>
      </View>
      <Press
        onPress={() => setSettingsOpen(true)}
        accessibilityLabel={t('prayer.settingsLabel')}
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
        <Icon name="sliders" size={20} color={colors.text} strokeWidth={1.8} />
      </Press>
    </View>
  );

  const stateActions = (): PrayerAction[] => {
    switch (status) {
      case 'permission-denied':
        return [
          { label: t('prayer.pickManually'), onPress: () => setLocationOpen(true) },
          { label: t('prayer.openSettings'), onPress: openAppSettings, variant: 'outline' },
        ];
      case 'location-unavailable':
        return [
          { label: t('common.retry'), onPress: () => void useCurrentLocation() },
          { label: t('prayer.pickManually'), onPress: () => setLocationOpen(true), variant: 'outline' },
        ];
      case 'error':
        return [
          { label: t('common.retry'), onPress: () => void refresh() },
          { label: t('prayer.pickAnotherCity'), onPress: () => setLocationOpen(true), variant: 'outline' },
        ];
      default:
        return [
          { label: t('prayer.allowLocation'), onPress: () => void useCurrentLocation() },
          { label: t('prayer.pickManually'), onPress: () => setLocationOpen(true), variant: 'outline' },
        ];
    }
  };

  const stateCopy = () => {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: LAYOUT.screenX, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
      >
        {status === 'loading' ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={92} radius={18} />
            <Skeleton height={132} radius={18} />
            <Skeleton height={280} radius={18} />
            <Txt size={12.5} color={colors.text3} align="center">
              {t('prayer.loading')}
            </Txt>
          </View>
        ) : !isReady ? (
          <Card padding={18} radius={18}>
            <PrayerStateBlock
              icon={status === 'error' ? 'wifiOff' : 'mapPin'}
              title={stateCopy().title}
              body={stateCopy().body}
              actions={stateActions()}
            />
          </Card>
        ) : (
          <>
            {offline ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: colors.goldTint,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.gold,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Icon name="wifiOff" size={16} color={colors.gold} strokeWidth={1.8} />
                <View style={{ flex: 1 }}>
                  <Txt size={12} weight={600} color={colors.text}>
                    {t('prayer.offlineCached')}
                  </Txt>
                  {lastUpdated ? (
                    <Txt size={10.5} color={colors.text2} style={{ marginTop: 2 }}>
                      {t('prayer.lastUpdatedAt', {
                        time: formatLastUpdated(lastUpdated, settings.timeFormat),
                      })}
                    </Txt>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* location + dates */}
            <Card padding={16} radius={18} style={{ marginBottom: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name="mapPin" size={15} color={colors.emerald} strokeWidth={1.8} />
                    <Txt size={15} weight={700} color={colors.text} numberOfLines={1} style={{ flex: 1 }}>
                      {location?.label ?? '—'}
                    </Txt>
                  </View>
                  <Txt size={12} color={colors.text2}>
                    {formatGregorianLabel(today!.dateKey, lang)}
                  </Txt>
                  {formatHijriLabel(today!.hijri, lang) ? (
                    <Txt size={12} color={colors.gold} style={{ marginTop: 2 }}>
                      {formatHijriLabel(today!.hijri, lang)}
                    </Txt>
                  ) : null}
                  <Txt size={11} color={colors.text3} style={{ marginTop: 6 }}>
                    {t('prayer.method', { name: methodLabel })}
                  </Txt>
                </View>
                <Press
                  onPress={() => setLocationOpen(true)}
                  accessibilityLabel={t('prayer.changeLocation')}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface2,
                  }}
                >
                  <Txt size={12} weight={600} color={colors.emerald}>
                    {t('common.change')}
                  </Txt>
                </Press>
              </View>
            </Card>

            {/* next prayer hero */}
            <Card padding={18} radius={18} style={{ marginBottom: 14 }}>
              <Txt size={11.5} color={colors.text2} style={{ marginBottom: 6 }}>
                {t('prayer.nextLabel')}
              </Txt>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Txt size={26} weight={700} color={colors.emerald}>
                  {t(PRAYER_LABEL_KEYS[next!.key])}
                  {next!.isTomorrow ? ` (${t('common.tomorrow')})` : ''}
                </Txt>
                <Txt size={20} weight={700} color={colors.gold}>
                  {next!.timeLabel}
                </Txt>
              </View>
              <Txt size={14} weight={600} color={colors.text} style={{ marginBottom: 14 }}>
                {next!.currentKey
                  ? t('prayer.nowFor', { name: t(PRAYER_LABEL_KEYS[next!.currentKey]) })
                  : t('prayer.countdown', { time: formatCountdown(next!.secondsUntil) })}
              </Txt>
              <ProgressBar fraction={next!.progress} height={6} />
            </Card>

            {/* daily schedule */}
            <Card padding={0} radius={18} style={{ overflow: 'hidden', marginBottom: 14 }}>
              {rows.map((row, index) => {
                const isNext = row.key === next!.key && !next!.isTomorrow;
                const isNow = next!.currentKey === row.key;
                const name = t(PRAYER_LABEL_KEYS[row.key]);
                return (
                  <View
                    key={row.key}
                    accessibilityLabel={`${name} ${row.timeLabel}${
                      isNext ? `, ${t('prayer.nextLabel')}` : ''
                    }${isNow ? `, ${t('common.now')}` : ''}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 56,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderBottomWidth: index < rows.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                      backgroundColor: isNext ? colors.emeraldTint : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        backgroundColor: isNext ? colors.emerald : colors.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={PRAYER_ICONS[row.key]}
                        size={18}
                        color={isNext ? '#fff' : colors.emerald}
                        strokeWidth={1.7}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt
                        size={15}
                        weight={isNext ? 700 : 600}
                        color={isNext ? colors.emerald : colors.text}
                      >
                        {name}
                      </Txt>
                      {row.key === 'sunrise' ? (
                        <Txt size={10.5} color={colors.text3} style={{ marginTop: 1 }}>
                          {t('prayer.notOneOfFive')}
                        </Txt>
                      ) : null}
                    </View>
                    {isNow ? (
                      <View
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: colors.gold,
                        }}
                      >
                        <Txt size={10} weight={700} color="#fff">
                          {t('common.now')}
                        </Txt>
                      </View>
                    ) : isNext ? (
                      <View
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.emerald,
                        }}
                      >
                        <Txt size={10} weight={700} color={colors.emerald}>
                          {t('common.next')}
                        </Txt>
                      </View>
                    ) : null}
                    <Txt
                      size={15}
                      weight={isNext ? 700 : 600}
                      color={isNext ? colors.emerald : colors.text}
                    >
                      {row.timeLabel}
                    </Txt>
                  </View>
                );
              })}
            </Card>

            <Txt size={11} lh={1.7} color={colors.text3} align="center">
              {t('prayer.footerNotice')}
            </Txt>
          </>
        )}
      </ScrollView>

      <PrayerLocationModal visible={locationOpen} onClose={() => setLocationOpen(false)} />
      <PrayerSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}
