import {
  NEXT_PRAYER_ORDER,
  type NextPrayerState,
  type PrayerKey,
  type PrayerSettings,
  type PrayerTime,
  type PrayerTimesData,
  type TimeFormat,
} from '../types/prayer.types';
import { formatNumber, getNumeralLanguage } from './numerals';

/**
 * Pure helpers behind مواقيت الصلاة. Everything here is deterministic and
 * side-effect free so the prayer logic can be reasoned about (and checked)
 * without a network, a clock, or React.
 */

const MINUTES_PER_DAY = 1440;
const SECONDS_PER_DAY = 86_400;

/** How long after a prayer starts we still show "حان الآن وقت صلاة …". */
export const NOW_WINDOW_SECONDS = 20 * 60;

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parses an AlAdhan time value into minutes since midnight.
 * Handles "04:30" and timezone-suffixed "04:30 (+03)" safely, and returns
 * null for anything malformed so the caller never renders NaN.
 */
export function parseApiTimeToMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/* ------------------------------------------------------------------ */
/* Adjustments                                                         */
/* ------------------------------------------------------------------ */

/** Manual offsets are limited to -10…+10 minutes. */
export function clampAdjustment(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-10, Math.min(10, Math.round(value)));
}

/** Applies a manual offset, wrapping safely inside the day. */
export function applyAdjustment(minutes: number, adjustment: number): number {
  const shifted = minutes + clampAdjustment(adjustment);
  return ((shifted % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Returns the day's times with the user's manual offsets applied. */
export function adjustedTimes(
  data: PrayerTimesData,
  adjustments: PrayerSettings['adjustments'],
): Record<PrayerKey, number> {
  return {
    fajr: applyAdjustment(data.times.fajr, adjustments.fajr),
    // الشروق is an astronomical event, never manually offset.
    sunrise: data.times.sunrise,
    dhuhr: applyAdjustment(data.times.dhuhr, adjustments.dhuhr),
    asr: applyAdjustment(data.times.asr, adjustments.asr),
    maghrib: applyAdjustment(data.times.maghrib, adjustments.maghrib),
    isha: applyAdjustment(data.times.isha, adjustments.isha),
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

let cachedSystemHour12: boolean | null = null;

/** Whether the device prefers a 12-hour clock (cached; falls back to true). */
function systemPrefers12Hour(): boolean {
  if (cachedSystemHour12 !== null) return cachedSystemHour12;
  let result = true;
  try {
    // `hourCycle` is not in every TS lib target, so read it defensively.
    const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions() as {
      hour12?: boolean;
      hourCycle?: string;
    };
    if (typeof resolved.hour12 === 'boolean') result = resolved.hour12;
    else if (typeof resolved.hourCycle === 'string') result = resolved.hourCycle.startsWith('h1');
  } catch {
    result = true;
  }
  cachedSystemHour12 = result;
  return result;
}

/** Test seam / settings change — clears the memoized system clock preference. */
export function resetSystemClockCache(): void {
  cachedSystemHour12 = null;
}

/**
 * Formats minutes-since-midnight for display: Arabic-Indic digits with ص/م
 * in Arabic, Latin digits with AM/PM in English.
 */
export function formatTimeLabel(
  minutes: number,
  format: TimeFormat,
  lang: 'ar' | 'en' = getNumeralLanguage(),
): string {
  if (!Number.isFinite(minutes)) return '—';
  const safe = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(safe / 60);
  const mins = safe % 60;
  const use12 = format === '12h' || (format === 'system' && systemPrefers12Hour());

  if (!use12) {
    return formatNumber(`${String(hours24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, lang);
  }
  const suffix = lang === 'ar' ? (hours24 < 12 ? 'ص' : 'م') : hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${formatNumber(`${hours12}:${String(mins).padStart(2, '0')}`, lang)} ${suffix}`;
}

/**
 * Countdown body: "01:24:18" under a day, "24:18" under an hour.
 * Never negative. Digits follow the UI language.
 */
export function formatCountdown(
  totalSeconds: number,
  lang: 'ar' | 'en' = getNumeralLanguage(),
): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  const core = hours > 0 ? `${two(hours)}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  return formatNumber(core, lang);
}

/* ------------------------------------------------------------------ */
/* Timezone-aware "now"                                                */
/* ------------------------------------------------------------------ */

export interface ZonedNow {
  /** yyyy-mm-dd in the target timezone. */
  dateKey: string;
  /** Seconds elapsed since midnight in the target timezone. */
  secondsOfDay: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local (device) wall clock, used as the fallback. */
function deviceNow(at: Date): ZonedNow {
  return {
    dateKey: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    secondsOfDay: at.getHours() * 3600 + at.getMinutes() * 60 + at.getSeconds(),
  };
}

/**
 * Current wall-clock date + seconds-of-day in the given IANA timezone.
 *
 * Re-derived from `Intl` on every call, so daylight-saving transitions are
 * picked up automatically and no Date arithmetic across zones is needed.
 * Falls back to the device clock when the timezone is missing/unsupported.
 */
export function getZonedNow(timeZone?: string, at: Date = new Date()): ZonedNow {
  if (!timeZone) return deviceNow(at);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = Number(get('hour'));
    const minute = Number(get('minute'));
    const second = Number(get('second'));

    // Some engines emit hour 24 for midnight.
    if (hour === 24) hour = 0;

    if (
      year &&
      month &&
      day &&
      Number.isFinite(hour) &&
      Number.isFinite(minute) &&
      Number.isFinite(second)
    ) {
      return {
        dateKey: `${year}-${month}-${day}`,
        secondsOfDay: hour * 3600 + minute * 60 + second,
      };
    }
  } catch {
    /* unsupported timezone — fall through to the device clock */
  }
  return deviceNow(at);
}

/** yyyy-mm-dd for a Date in the device timezone (used for API date paths). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** AlAdhan expects DD-MM-YYYY in the URL path. */
export function toApiDatePath(date: Date): string {
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/* Next-prayer selection                                               */
/* ------------------------------------------------------------------ */

/**
 * Chooses the upcoming prayer from today's five times.
 *
 * - Sunrise is never a candidate.
 * - After Isha the next prayer is tomorrow's Fajr (falling back to today's
 *   Fajr time when tomorrow hasn't been fetched).
 * - `secondsUntil` is always >= 0, so the countdown can never go negative.
 * - `currentKey` is set for a short window after a prayer starts, which is
 *   what drives the "الآن" badge and the "حان الآن" message.
 */
export function computeNextPrayer(
  todayMinutes: Record<PrayerKey, number>,
  tomorrowFajrMinutes: number | null,
  nowSecondsOfDay: number,
  timeFormat: TimeFormat,
  nowWindowSeconds: number = NOW_WINDOW_SECONDS,
): NextPrayerState {
  const now = Math.max(0, Math.min(SECONDS_PER_DAY, Math.floor(nowSecondsOfDay)));

  const schedule = NEXT_PRAYER_ORDER.map((key) => ({
    key,
    seconds: todayMinutes[key] * 60,
  }));

  const upcomingIndex = schedule.findIndex((entry) => entry.seconds > now);

  // The most recent prayer that has already started today (if any).
  const startedIndex =
    upcomingIndex === -1 ? schedule.length - 1 : upcomingIndex - 1;
  const started = startedIndex >= 0 ? schedule[startedIndex] : null;
  const currentKey =
    started && now - started.seconds <= nowWindowSeconds ? started.key : null;

  if (upcomingIndex === -1) {
    // Past Isha → tomorrow's Fajr.
    const fajrMinutes = tomorrowFajrMinutes ?? todayMinutes.fajr;
    const secondsUntil = SECONDS_PER_DAY - now + fajrMinutes * 60;
    const previousSeconds = schedule[schedule.length - 1].seconds; // Isha
    const span = SECONDS_PER_DAY - previousSeconds + fajrMinutes * 60;
    return {
      key: 'fajr',
      minutes: fajrMinutes,
      timeLabel: formatTimeLabel(fajrMinutes, timeFormat),
      secondsUntil: Math.max(0, secondsUntil),
      isTomorrow: true,
      currentKey,
      progress: span > 0 ? clamp01((now - previousSeconds) / span) : 0,
    };
  }

  const upcoming = schedule[upcomingIndex];
  // Previous boundary: the prayer before it, or yesterday's Isha for pre-Fajr.
  const previousSeconds =
    upcomingIndex > 0
      ? schedule[upcomingIndex - 1].seconds
      : todayMinutes.isha * 60 - SECONDS_PER_DAY;
  const span = upcoming.seconds - previousSeconds;

  return {
    key: upcoming.key,
    minutes: todayMinutes[upcoming.key],
    timeLabel: formatTimeLabel(todayMinutes[upcoming.key], timeFormat),
    secondsUntil: Math.max(0, upcoming.seconds - now),
    isTomorrow: false,
    currentKey,
    progress: span > 0 ? clamp01((now - previousSeconds) / span) : 0,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/* ------------------------------------------------------------------ */
/* View helpers                                                        */
/* ------------------------------------------------------------------ */

/** Builds the six display rows for the daily schedule. */
export function buildPrayerRows(
  minutes: Record<PrayerKey, number>,
  order: readonly PrayerKey[],
  timeFormat: TimeFormat,
): PrayerTime[] {
  return order.map((key) => ({
    key,
    minutes: minutes[key],
    timeLabel: formatTimeLabel(minutes[key], timeFormat),
  }));
}

/** "آخر تحديث ٤:٢٢ م" style stamp for the offline notice. */
export function formatLastUpdated(timestamp: number, timeFormat: TimeFormat): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return formatTimeLabel(minutes, timeFormat);
}

/** Localized Gregorian date line built from the stored yyyy-mm-dd key. */
export function formatGregorianLabel(
  dateKey: string,
  lang: 'ar' | 'en' = getNumeralLanguage(),
): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateKey;
  }
}

/** Localized Hijri date line, e.g. "٨ صَفَر ١٤٤٨هـ" / "8 Safar 1448 AH". */
export function formatHijriLabel(
  hijri: { day: string; monthAr: string; monthEn: string; year: string } | null,
  lang: 'ar' | 'en' = getNumeralLanguage(),
): string {
  if (!hijri) return '';
  if (lang === 'ar') {
    return `${formatNumber(hijri.day, 'ar')} ${hijri.monthAr} ${formatNumber(hijri.year, 'ar')}هـ`;
  }
  return `${hijri.day} ${hijri.monthEn} ${hijri.year} AH`;
}

/** Rounds coordinates to ~100 m so exact positions are never persisted. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
