import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TranslationKey } from '../i18n/translations';
import {
  API_TIMING_KEYS,
  CALCULATION_METHODS,
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_CACHE_VERSION,
  PRAYER_ORDER,
  type AlAdhanResponse,
  type AsrSchool,
  type HijriParts,
  type NextPrayerKey,
  type PrayerCache,
  type PrayerKey,
  type PrayerLocation,
  type PrayerSettings,
  type PrayerTimesData,
} from '../types/prayer.types';
import {
  clampAdjustment,
  parseApiTimeToMinutes,
  roundCoordinate,
  toApiDatePath,
  toDateKey,
} from '../utils/prayerTimeUtils';

/**
 * AlAdhan integration + local persistence for مواقيت الصلاة.
 *
 * The public API needs no key or secret. Every response is validated before
 * it is trusted, and a valid cached day is never overwritten by a bad one.
 */

const BASE_URL = 'https://api.aladhan.com/v1';
const REQUEST_TIMEOUT_MS = 12_000;

export const PRAYER_CACHE_KEY = 'basirah-prayer-cache-v1';
export const PRAYER_SETTINGS_KEY = 'basirah-prayer-settings-v1';
export const PRAYER_LOCATION_KEY = 'basirah-prayer-location-v1';

/**
 * Thrown for any recoverable prayer-times failure (network, HTTP, payload).
 * Carries a translation key so the UI renders it in the active language.
 */
export class PrayerTimesError extends Error {
  readonly messageKey: TranslationKey;

  constructor(messageKey: TranslationKey, detail?: string) {
    super(detail ?? messageKey);
    this.name = 'PrayerTimesError';
    this.messageKey = messageKey;
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

async function requestJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new PrayerTimesError('prayer.invalidResponse', `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof PrayerTimesError) throw error;
    const aborted =
      typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
    throw new PrayerTimesError(aborted ? 'prayer.timeout' : 'prayer.connectionFailed');
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/** Keeps the Hijri parts raw so the UI can render them in either language. */
function buildHijriParts(response: AlAdhanResponse): HijriParts | null {
  const hijri = response.data?.date?.hijri;
  if (!hijri) return null;
  const day = hijri.day ?? '';
  const year = hijri.year ?? '';
  const monthAr = hijri.month?.ar ?? '';
  const monthEn = hijri.month?.en ?? '';
  if (!day || !year || (!monthAr && !monthEn)) return null;
  return { day, monthAr: monthAr || monthEn, monthEn: monthEn || monthAr, year };
}

/** The API's own English method name, kept only as a fallback label. */
function methodNameFor(response: AlAdhanResponse): string {
  return response.data?.meta?.method?.name ?? '';
}

/**
 * Validates an AlAdhan payload and normalizes it. Throws when any of the six
 * required timings is missing or unparseable, so partial data never reaches
 * the UI (and never overwrites a good cache entry).
 */
function normalizeResponse(
  response: AlAdhanResponse,
  requestedDate: Date,
  methodId: number,
  school: AsrSchool,
): PrayerTimesData {
  if (response.code !== 200 || !response.data?.timings) {
    throw new PrayerTimesError('prayer.invalidResponse');
  }

  const timings = response.data.timings;
  const times = {} as Record<PrayerKey, number>;
  for (const key of PRAYER_ORDER) {
    const minutes = parseApiTimeToMinutes(timings[API_TIMING_KEYS[key]]);
    if (minutes === null) {
      throw new PrayerTimesError('prayer.incompleteData');
    }
    times[key] = minutes;
  }

  return {
    dateKey: toDateKey(requestedDate),
    timezone: response.data.meta?.timezone ?? '',
    methodId,
    methodName: methodNameFor(response),
    school,
    times,
    hijri: buildHijriParts(response),
    fetchedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

export interface FetchPrayerDayParams {
  location: PrayerLocation;
  methodId: number;
  school: AsrSchool;
  date: Date;
}

/** Fetches and normalizes one day for the given location. */
export async function fetchPrayerDay({
  location,
  methodId,
  school,
  date,
}: FetchPrayerDayParams): Promise<PrayerTimesData> {
  const datePath = toApiDatePath(date);
  const common = `method=${methodId}&school=${school}&iso8601=false`;

  let url: string;
  if (location.source === 'manual' || location.latitude === undefined || location.longitude === undefined) {
    const city = (location.city ?? '').trim();
    const country = (location.country ?? '').trim();
    if (!city || !country) {
      throw new PrayerTimesError('prayer.enterCityCountry');
    }
    url =
      `${BASE_URL}/timingsByCity/${datePath}` +
      `?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&${common}`;
  } else {
    url =
      `${BASE_URL}/timings/${datePath}` +
      `?latitude=${location.latitude}&longitude=${location.longitude}&${common}`;
  }

  const response = await requestJson<AlAdhanResponse>(url);
  return normalizeResponse(response, date, methodId, school);
}

/** Fetches today and tomorrow together (tomorrow powers the post-Isha rollover). */
export async function fetchPrayerDays(
  params: Omit<FetchPrayerDayParams, 'date'>,
  today: Date = new Date(),
): Promise<{ today: PrayerTimesData; tomorrow: PrayerTimesData | null }> {
  const tomorrowDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [todayData, tomorrowData] = await Promise.all([
    fetchPrayerDay({ ...params, date: today }),
    // Tomorrow is a nicety: if it fails we still show today.
    fetchPrayerDay({ ...params, date: tomorrowDate }).catch(() => null),
  ]);
  return { today: todayData, tomorrow: tomorrowData };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function isPrayerTimesData(value: unknown): value is PrayerTimesData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as PrayerTimesData;
  if (typeof data.dateKey !== 'string' || typeof data.times !== 'object' || data.times === null) {
    return false;
  }
  return PRAYER_ORDER.every((key) => Number.isFinite(data.times[key]));
}

export async function loadPrayerCache(): Promise<PrayerCache | null> {
  try {
    const raw = await AsyncStorage.getItem(PRAYER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrayerCache;
    if (parsed?.version !== PRAYER_CACHE_VERSION) return null;
    if (!isPrayerTimesData(parsed.today) || !parsed.location) return null;
    return {
      ...parsed,
      tomorrow: isPrayerTimesData(parsed.tomorrow) ? parsed.tomorrow : null,
    };
  } catch {
    return null;
  }
}

export async function savePrayerCache(cache: PrayerCache): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full/unavailable — the session still works in memory */
  }
}

export async function loadSavedLocation(): Promise<PrayerLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(PRAYER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrayerLocation;
    if (!parsed || typeof parsed.label !== 'string') return null;
    if (parsed.source !== 'auto' && parsed.source !== 'manual') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLocation(location: PrayerLocation): Promise<void> {
  try {
    const safe: PrayerLocation = {
      ...location,
      latitude: location.latitude === undefined ? undefined : roundCoordinate(location.latitude),
      longitude: location.longitude === undefined ? undefined : roundCoordinate(location.longitude),
    };
    await AsyncStorage.setItem(PRAYER_LOCATION_KEY, JSON.stringify(safe));
  } catch {
    /* ignore */
  }
}

export async function loadPrayerSettings(): Promise<PrayerSettings> {
  try {
    const raw = await AsyncStorage.getItem(PRAYER_SETTINGS_KEY);
    if (!raw) return DEFAULT_PRAYER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrayerSettings>;
    const methodId = CALCULATION_METHODS.some((m) => m.id === parsed.methodId)
      ? (parsed.methodId as number)
      : DEFAULT_PRAYER_SETTINGS.methodId;
    const school: AsrSchool = parsed.school === 1 ? 1 : 0;
    const timeFormat =
      parsed.timeFormat === '12h' || parsed.timeFormat === '24h' || parsed.timeFormat === 'system'
        ? parsed.timeFormat
        : DEFAULT_PRAYER_SETTINGS.timeFormat;
    const rawAdjustments: Partial<Record<NextPrayerKey, number>> = parsed.adjustments ?? {};
    return {
      methodId,
      school,
      timeFormat,
      adjustments: {
        fajr: clampAdjustment(Number(rawAdjustments.fajr ?? 0)),
        dhuhr: clampAdjustment(Number(rawAdjustments.dhuhr ?? 0)),
        asr: clampAdjustment(Number(rawAdjustments.asr ?? 0)),
        maghrib: clampAdjustment(Number(rawAdjustments.maghrib ?? 0)),
        isha: clampAdjustment(Number(rawAdjustments.isha ?? 0)),
      },
    };
  } catch {
    return DEFAULT_PRAYER_SETTINGS;
  }
}

export async function savePrayerSettings(settings: PrayerSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
