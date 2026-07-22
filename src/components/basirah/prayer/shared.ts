import type { IconName } from '../Icon';
import type { PrayerKey } from '../../../types/prayer.types';

/** Icon shown beside each prayer row (reuses the app's existing icon set). */
export const PRAYER_ICONS: Record<PrayerKey, IconName> = {
  fajr: 'moon',
  sunrise: 'sunrise',
  dhuhr: 'sun',
  asr: 'sun',
  maghrib: 'sunset',
  isha: 'moon',
};
