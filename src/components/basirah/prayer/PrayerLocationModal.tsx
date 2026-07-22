import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import { usePrayerTimes } from '../../../hooks/usePrayerTimes';
import { FONT } from '../../../theme/fonts';
import { useTheme } from '../../../theme/ThemeContext';
import BottomSheet from '../BottomSheet';
import Icon from '../Icon';
import { Press, PrimaryButton } from '../primitives';
import Txt from '../Txt';


/** A few common cities so manual entry is one tap for most users. */
const QUICK_CITIES: { city: string; country: string; label: string }[] = [
  { city: 'Amman', country: 'Jordan', label: 'عمّان' },
  { city: 'Makkah', country: 'Saudi Arabia', label: 'مكة المكرمة' },
  { city: 'Madinah', country: 'Saudi Arabia', label: 'المدينة المنورة' },
  { city: 'Cairo', country: 'Egypt', label: 'القاهرة' },
  { city: 'Riyadh', country: 'Saudi Arabia', label: 'الرياض' },
  { city: 'Dubai', country: 'United Arab Emirates', label: 'دبي' },
  { city: 'Jerusalem', country: 'Palestine', label: 'القدس' },
  { city: 'Istanbul', country: 'Turkey', label: 'إسطنبول' },
];

/**
 * Manual city/country fallback, plus a shortcut back to automatic location.
 */
export default function PrayerLocationModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useAppLanguage();
  const { setManualLocation, useCurrentLocation, location } = usePrayerTimes();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (nextCity: string, nextCountry: string) => {
    if (!nextCity.trim() || !nextCountry.trim()) {
      setError(t('prayer.enterCityCountry'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setManualLocation(nextCity, nextCountry);
      onClose();
    } catch {
      setError(t('prayer.apiError'));
    } finally {
      setBusy(false);
    }
  };

  const useAuto = async () => {
    setBusy(true);
    setError(null);
    try {
      await useCurrentLocation();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontFamily: FONT.ui400,
    fontSize: 14,
    color: colors.text,
    textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left',
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Txt size={16} weight={700} color={colors.text} style={{ marginBottom: 6 }}>
        {t('prayer.locationTitle')}
      </Txt>
      <Txt size={12.5} lh={1.7} color={colors.text2} style={{ marginBottom: 16 }}>
        {t('prayer.permissionRationale')}
      </Txt>

      <Press
        onPress={() => void useAuto()}
        accessibilityLabel={t('prayer.useMyLocation')}
        disabled={busy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.emerald,
          backgroundColor: colors.emeraldTint,
          marginBottom: 18,
        }}
      >
        <Icon name="mapPin" size={18} color={colors.emerald} strokeWidth={1.8} />
        <Txt size={13.5} weight={600} color={colors.emerald} style={{ flex: 1 }}>
          {t('prayer.useMyLocation')}
        </Txt>
        {location?.source === 'auto' ? (
          <Icon name="check" size={16} color={colors.emerald} strokeWidth={2.2} />
        ) : null}
      </Press>

      <Txt size={13} weight={700} color={colors.text} style={{ marginBottom: 10 }}>
        {t('prayer.commonCities')}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {QUICK_CITIES.map((item) => {
          const active = location?.source === 'manual' && location.city === item.city;
          return (
            <Press
              key={item.city}
              onPress={() => void submit(item.city, item.country)}
              accessibilityLabel={item.label}
              disabled={busy}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: active ? colors.emerald : colors.border,
                backgroundColor: active ? colors.emerald : colors.surface,
              }}
            >
              <Txt size={12.5} weight={600} color={active ? '#fff' : colors.text}>
                {item.label}
              </Txt>
            </Press>
          );
        })}
      </View>

      <Txt size={13} weight={700} color={colors.text} style={{ marginBottom: 10 }}>
        {t('prayer.orEnterCity')}
      </Txt>
      <View style={{ gap: 10, marginBottom: 14 }}>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder={t('prayer.cityPlaceholder')}
          placeholderTextColor={colors.text3}
          accessibilityLabel={t('prayer.city')}
          style={inputStyle}
        />
        <TextInput
          value={country}
          onChangeText={setCountry}
          placeholder={t('prayer.countryPlaceholder')}
          placeholderTextColor={colors.text3}
          accessibilityLabel={t('prayer.country')}
          style={inputStyle}
        />
      </View>

      {error ? (
        <Txt size={12} color={colors.error} style={{ marginBottom: 10 }}>
          {error}
        </Txt>
      ) : null}

      {busy ? (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : (
        <PrimaryButton title={t('prayer.saveLocation')} height={50} onPress={() => void submit(city, country)} />
      )}
    </BottomSheet>
  );
}
