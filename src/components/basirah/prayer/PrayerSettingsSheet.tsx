import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAppLanguage } from '../../../hooks/useAppLanguage';
import { usePrayerTimes } from '../../../hooks/usePrayerTimes';
import { useTheme } from '../../../theme/ThemeContext';
import {
  CALCULATION_METHODS,
  DEFAULT_PRAYER_SETTINGS,
  NEXT_PRAYER_ORDER,
  PRAYER_LABEL_KEYS,
  type AsrSchool,
  type NextPrayerKey,
  type PrayerSettings,
  type TimeFormat,
} from '../../../types/prayer.types';
import { clampAdjustment } from '../../../utils/prayerTimeUtils';
import { formatNumber } from '../../../utils/numerals';
import BottomSheet from '../BottomSheet';
import Icon from '../Icon';
import { Press, PrimaryButton, SegmentedTabs } from '../primitives';
import { useToast } from '../Toast';
import Txt from '../Txt';

const TIME_FORMATS: TimeFormat[] = ['12h', '24h', 'system'];

/**
 * Prayer settings: calculation method, Asr school, time format and
 * per-prayer manual minute offsets. Saving applies immediately — the times
 * and the next-prayer countdown refresh straight away.
 */
export default function PrayerSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { showToast } = useToast();
  const { settings, updateSettings, resetSettings } = usePrayerTimes();
  const [draft, setDraft] = useState<PrayerSettings>(settings);

  // Re-seed whenever the sheet opens so it always reflects saved state.
  useEffect(() => {
    if (visible) setDraft(settings);
  }, [visible, settings]);

  const setAdjustment = (key: NextPrayerKey, delta: number) => {
    setDraft((prev) => ({
      ...prev,
      adjustments: {
        ...prev.adjustments,
        [key]: clampAdjustment(prev.adjustments[key] + delta),
      },
    }));
  };

  const save = async () => {
    await updateSettings(draft);
    showToast(t('prayer.settingsSaved'));
    onClose();
  };

  const restore = async () => {
    setDraft(DEFAULT_PRAYER_SETTINGS);
    await resetSettings();
    showToast(t('prayer.defaultsRestored'));
  };

  const sectionTitle = (text: string) => (
    <Txt size={12} weight={700} color={colors.emerald} style={{ marginBottom: 10, marginTop: 18 }}>
      {text}
    </Txt>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Txt size={16} weight={700} color={colors.text}>
        {t('prayer.settingsTitle')}
      </Txt>

      {sectionTitle(t('prayer.calcMethod'))}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          overflow: 'hidden',
        }}
      >
        {CALCULATION_METHODS.map((method, index) => {
          const active = draft.methodId === method.id;
          return (
            <Press
              key={method.id}
              onPress={() => setDraft((prev) => ({ ...prev, methodId: method.id }))}
              accessibilityLabel={t(method.labelKey)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 46,
                paddingHorizontal: 14,
                borderBottomWidth: index < CALCULATION_METHODS.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                backgroundColor: active ? colors.emeraldTint : 'transparent',
              }}
            >
              <Txt size={13} weight={active ? 700 : 400} color={active ? colors.emerald : colors.text} style={{ flex: 1 }}>
                {t(method.labelKey)}
              </Txt>
              {active ? <Icon name="check" size={16} color={colors.emerald} strokeWidth={2.2} /> : null}
            </Press>
          );
        })}
      </View>
      <Txt size={10.5} lh={1.6} color={colors.text3} style={{ marginTop: 8 }}>
        {t('prayer.calcNote')}
      </Txt>

      {sectionTitle(t('prayer.asrSchool'))}
      <SegmentedTabs
        items={[t('prayer.asrStandard'), t('prayer.asrHanafi')]}
        active={draft.school === 1 ? 1 : 0}
        onChange={(index) => setDraft((prev) => ({ ...prev, school: (index === 1 ? 1 : 0) as AsrSchool }))}
        height={42}
      />

      {sectionTitle(t('prayer.timeFormat'))}
      <SegmentedTabs
        items={[t('prayer.format12'), t('prayer.format24'), t('prayer.formatSystem')]}
        active={TIME_FORMATS.indexOf(draft.timeFormat)}
        onChange={(index) => setDraft((prev) => ({ ...prev, timeFormat: TIME_FORMATS[index] }))}
        height={42}
      />

      {sectionTitle(t('prayer.manualAdjust'))}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          overflow: 'hidden',
        }}
      >
        {NEXT_PRAYER_ORDER.map((key, index) => {
          const value = draft.adjustments[key];
          return (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderBottomWidth: index < NEXT_PRAYER_ORDER.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Txt size={13} color={colors.text}>
                {t(PRAYER_LABEL_KEYS[key])}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Press
                  onPress={() => setAdjustment(key, -1)}
                  accessibilityLabel={t('prayer.decreaseFor', { name: t(PRAYER_LABEL_KEYS[key]) })}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={17} color={colors.text} align="center">
                    −
                  </Txt>
                </Press>
                <Txt
                  size={13}
                  weight={700}
                  align="center"
                  color={value === 0 ? colors.text2 : colors.emerald}
                  style={{ minWidth: 44 }}
                >
                  {value > 0 ? '+' : value < 0 ? '−' : ''}
                  {formatNumber(Math.abs(value))}
                </Txt>
                <Press
                  onPress={() => setAdjustment(key, 1)}
                  accessibilityLabel={t('prayer.increaseFor', { name: t(PRAYER_LABEL_KEYS[key]) })}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={17} color={colors.text} align="center">
                    +
                  </Txt>
                </Press>
              </View>
            </View>
          );
        })}
      </View>
      <Txt size={10.5} color={colors.text3} style={{ marginTop: 8 }}>
        {t('prayer.adjustRange', { max: formatNumber(10) })}
      </Txt>

      <View style={{ marginTop: 20, gap: 10 }}>
        <PrimaryButton title={t('prayer.saveSettings')} height={50} onPress={() => void save()} />
        <Press
          onPress={() => void restore()}
          accessibilityLabel={t('prayer.restoreDefaults')}
          style={{
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={13} weight={600} color={colors.text2} align="center">
            {t('prayer.restoreDefaults')}
          </Txt>
        </Press>
      </View>
    </BottomSheet>
  );
}
