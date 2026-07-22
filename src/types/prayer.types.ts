import type { TranslationKey } from '../i18n/translations';

/**
 * Data model for the Prayer Times feature (مواقيت الصلاة).
 *
 * Times are stored as MINUTES SINCE MIDNIGHT in the location's own
 * timezone — never as parsed Date objects — so the app never depends on
 * fragile date-string parsing and stays correct across DST changes.
 * Manual minute adjustments are applied at render time, so changing them
 * never requires a new network request.
 */

/** Every row shown in the daily schedule. */
export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

/** الشروق is shown in the schedule but is NOT one of the five prayers. */
export type NextPrayerKey = Exclude<PrayerKey, 'sunrise'>;

/** Display order of the daily schedule. */
export const PRAYER_ORDER: readonly PrayerKey[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

/** Order used for next-prayer selection — Sunrise is deliberately excluded. */
export const NEXT_PRAYER_ORDER: readonly NextPrayerKey[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

/** Translation keys for the prayer names (resolved at render time). */
export const PRAYER_LABEL_KEYS: Record<PrayerKey, TranslationKey> = {
  fajr: 'prayer.name.fajr',
  sunrise: 'prayer.name.sunrise',
  dhuhr: 'prayer.name.dhuhr',
  asr: 'prayer.name.asr',
  maghrib: 'prayer.name.maghrib',
  isha: 'prayer.name.isha',
};

/** AlAdhan `timings` keys we consume. Imsak/Sunset/Midnight/… are ignored. */
export const API_TIMING_KEYS: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/* ------------------------------------------------------------------ */
/* Location                                                            */
/* ------------------------------------------------------------------ */

export type PrayerLocationSource = 'auto' | 'manual';

export interface PrayerLocation {
  source: PrayerLocationSource;
  /** Rounded to 3 decimals (~100 m) — precise coordinates are never persisted or logged. */
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  /** Human label, e.g. "عمّان، الأردن". */
  label: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type TimeFormat = '12h' | '24h' | 'system';

/** AlAdhan `school`: 0 = Standard (Shafi'i), 1 = Hanafi. */
export type AsrSchool = 0 | 1;

export interface CalculationMethod {
  /** Verified AlAdhan method id. */
  id: number;
  labelKey: TranslationKey;
}

/**
 * Verified AlAdhan calculation-method ids (api.aladhan.com/v1/methods).
 * These are not guessed — each id maps to the documented method.
 */
export const CALCULATION_METHODS: readonly CalculationMethod[] = [
  { id: 3, labelKey: 'prayer.method.3' },
  { id: 5, labelKey: 'prayer.method.5' },
  { id: 4, labelKey: 'prayer.method.4' },
  { id: 1, labelKey: 'prayer.method.1' },
  { id: 8, labelKey: 'prayer.method.8' },
  { id: 9, labelKey: 'prayer.method.9' },
  { id: 10, labelKey: 'prayer.method.10' },
  { id: 13, labelKey: 'prayer.method.13' },
  { id: 15, labelKey: 'prayer.method.15' },
] as const;

export const DEFAULT_METHOD_ID = 3; // Muslim World League

export interface PrayerSettings {
  methodId: number;
  school: AsrSchool;
  timeFormat: TimeFormat;
  /** Per-prayer manual offset in minutes, clamped to -10…+10. */
  adjustments: Record<NextPrayerKey, number>;
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  methodId: DEFAULT_METHOD_ID,
  school: 0,
  timeFormat: 'system',
  adjustments: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
};

/* ------------------------------------------------------------------ */
/* Normalized prayer day                                               */
/* ------------------------------------------------------------------ */

/** One prayer row ready for display (name resolved via PRAYER_LABEL_KEYS). */
export interface PrayerTime {
  key: PrayerKey;
  /** Minutes since midnight, adjustments already applied. */
  minutes: number;
  /** Localized label, e.g. "٤:٢٢ م" / "4:22 PM". */
  timeLabel: string;
}

/** Hijri date parts from the API, kept raw so they can be shown in either language. */
export interface HijriParts {
  day: string;
  monthAr: string;
  monthEn: string;
  year: string;
}

/** One fetched day, normalized. Raw (unadjusted) times. */
export interface PrayerTimesData {
  /** yyyy-mm-dd in the location's timezone. */
  dateKey: string;
  timezone: string;
  methodId: number;
  /** The API's own English method name — fallback when the id is unknown. */
  methodName: string;
  school: AsrSchool;
  /** Minutes since midnight, exactly as returned by the API. */
  times: Record<PrayerKey, number>;
  hijri: HijriParts | null;
  fetchedAt: number;
}

/* ------------------------------------------------------------------ */
/* Next-prayer state                                                   */
/* ------------------------------------------------------------------ */

export interface NextPrayerState {
  key: NextPrayerKey;
  /** Minutes since midnight of the upcoming prayer (adjusted). */
  minutes: number;
  timeLabel: string;
  /** Always >= 0. */
  secondsUntil: number;
  /** True when the upcoming prayer is tomorrow's Fajr. */
  isTomorrow: boolean;
  /** Set while the current prayer just started (the "الآن" window). */
  currentKey: NextPrayerKey | null;
  /** Fraction elapsed between the previous and the upcoming prayer (0…1). */
  progress: number;
}

/* ------------------------------------------------------------------ */
/* AlAdhan API response (only the fields this app reads)               */
/* ------------------------------------------------------------------ */

export interface AlAdhanTimings {
  Fajr?: string;
  Sunrise?: string;
  Dhuhr?: string;
  Asr?: string;
  Maghrib?: string;
  Isha?: string;
  [key: string]: string | undefined;
}

export interface AlAdhanDate {
  readable?: string;
  gregorian?: {
    date?: string;
    day?: string;
    month?: { number?: number; en?: string };
    year?: string;
  };
  hijri?: {
    date?: string;
    day?: string;
    month?: { number?: number; en?: string; ar?: string };
    year?: string;
  };
}

export interface AlAdhanMeta {
  timezone?: string;
  method?: { id?: number; name?: string };
  school?: string;
}

export interface AlAdhanResponse {
  code?: number;
  status?: string;
  data?: {
    timings?: AlAdhanTimings;
    date?: AlAdhanDate;
    meta?: AlAdhanMeta;
  };
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

export const PRAYER_CACHE_VERSION = 2;

export interface PrayerCache {
  version: number;
  location: PrayerLocation;
  today: PrayerTimesData;
  tomorrow: PrayerTimesData | null;
  savedAt: number;
}

/** UI state machine for the feature. */
export type PrayerStatus =
  | 'loading'
  | 'ready'
  | 'error'
  | 'needs-location'
  | 'permission-denied'
  | 'location-unavailable';
