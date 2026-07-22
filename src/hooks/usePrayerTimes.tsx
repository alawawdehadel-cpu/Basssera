import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus, Linking, Platform } from 'react-native';
import type { TranslationKey } from '../i18n/translations';
import { useAppLanguage } from './useAppLanguage';
import {
  fetchPrayerDays,
  loadPrayerCache,
  loadPrayerSettings,
  loadSavedLocation,
  PrayerTimesError,
  savePrayerCache,
  saveLocation,
  savePrayerSettings,
} from '../services/prayerTimesService';
import {
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_CACHE_VERSION,
  PRAYER_ORDER,
  type NextPrayerState,
  type PrayerLocation,
  type PrayerSettings,
  type PrayerStatus,
  type PrayerTime,
  type PrayerTimesData,
} from '../types/prayer.types';
import {
  adjustedTimes,
  buildPrayerRows,
  computeNextPrayer,
  getZonedNow,
  resetSystemClockCache,
  roundCoordinate,
} from '../utils/prayerTimeUtils';

/**
 * Single source of truth for مواقيت الصلاة.
 *
 * Lives at the app root so the Home card and the full screen share one
 * fetch, one cache and one countdown interval — no duplicate requests and
 * no competing timers.
 */

interface PrayerTimesContextValue {
  status: PrayerStatus;
  refreshing: boolean;
  /** True while showing cached data because the network call failed. */
  offline: boolean;
  lastUpdated: number | null;
  location: PrayerLocation | null;
  settings: PrayerSettings;
  today: PrayerTimesData | null;
  /** Six display rows (adjustments + formatting applied). */
  rows: PrayerTime[];
  next: NextPrayerState | null;
  /** Translation key for the last failure, resolved by the UI. */
  errorKey: TranslationKey | null;
  refresh: () => Promise<void>;
  useCurrentLocation: () => Promise<void>;
  setManualLocation: (city: string, country: string) => Promise<void>;
  updateSettings: (patch: Partial<PrayerSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  openAppSettings: () => void;
}

const PrayerTimesContext = createContext<PrayerTimesContextValue | null>(null);

/** Refetch when returning to the foreground after this long. */
const FOREGROUND_REFRESH_MS = 5 * 60 * 1000;

export function PrayerTimesProvider({ children }: { children: React.ReactNode }) {
  const { t, lang } = useAppLanguage();
  const [status, setStatus] = useState<PrayerStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [location, setLocation] = useState<PrayerLocation | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [today, setToday] = useState<PrayerTimesData | null>(null);
  const [tomorrow, setTomorrow] = useState<PrayerTimesData | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Refs keep async work free of stale closures without re-creating callbacks.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const locationRef = useRef(location);
  locationRef.current = location;
  const todayRef = useRef(today);
  todayRef.current = today;
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Fetching                                                          */
  /* ---------------------------------------------------------------- */

  const loadFor = useCallback(
    async (loc: PrayerLocation, overrides?: Partial<PrayerSettings>) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const active = { ...settingsRef.current, ...overrides };
      setRefreshing(true);
      setErrorKey(null);
      if (!todayRef.current) setStatus('loading');

      try {
        const result = await fetchPrayerDays({
          location: loc,
          methodId: active.methodId,
          school: active.school,
        });
        if (!mountedRef.current) return;

        setToday(result.today);
        setTomorrow(result.tomorrow);
        setLocation(loc);
        setOffline(false);
        setStatus('ready');
        setLastUpdated(Date.now());
        lastFetchAtRef.current = Date.now();

        await Promise.all([
          savePrayerCache({
            version: PRAYER_CACHE_VERSION,
            location: loc,
            today: result.today,
            tomorrow: result.tomorrow,
            savedAt: Date.now(),
          }),
          saveLocation(loc),
        ]);
      } catch (error) {
        if (!mountedRef.current) return;
        const key: TranslationKey =
          error instanceof PrayerTimesError ? error.messageKey : 'prayer.apiError';

        // Keep whatever valid data we already have; otherwise try the cache.
        if (todayRef.current) {
          setOffline(true);
          setStatus('ready');
          setErrorKey(key);
        } else {
          const cache = await loadPrayerCache();
          if (cache && mountedRef.current) {
            setToday(cache.today);
            setTomorrow(cache.tomorrow);
            setLocation(cache.location);
            setLastUpdated(cache.savedAt);
            setOffline(true);
            setStatus('ready');
            setErrorKey(key);
          } else if (mountedRef.current) {
            setStatus('error');
            setErrorKey(key);
          }
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setRefreshing(false);
      }
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* Location flows                                                    */
  /* ---------------------------------------------------------------- */

  const useCurrentLocation = useCallback(async () => {
    setErrorKey(null);
    if (!todayRef.current) setStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        if (mountedRef.current) setStatus('permission-denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let city: string | undefined;
      let country: string | undefined;
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const place = places[0];
        city = place?.city ?? place?.subregion ?? place?.region ?? undefined;
        country = place?.country ?? undefined;
      } catch {
        /* reverse geocoding is best-effort — coordinates still work */
      }

      const separator = lang === 'ar' ? '، ' : ', ';
      const label =
        city && country
          ? `${city}${separator}${country}`
          : city ?? country ?? t('prayer.useMyLocation');
      const next: PrayerLocation = {
        source: 'auto',
        latitude: roundCoordinate(position.coords.latitude),
        longitude: roundCoordinate(position.coords.longitude),
        city,
        country,
        label,
      };
      await loadFor(next);
    } catch {
      if (mountedRef.current) setStatus('location-unavailable');
    }
  }, [loadFor, lang, t]);

  const setManualLocation = useCallback(
    async (city: string, country: string) => {
      const separator = lang === 'ar' ? '، ' : ', ';
      const next: PrayerLocation = {
        source: 'manual',
        city: city.trim(),
        country: country.trim(),
        label: `${city.trim()}${separator}${country.trim()}`,
      };
      await loadFor(next);
    },
    [loadFor, lang],
  );

  const refresh = useCallback(async () => {
    const loc = locationRef.current;
    if (loc) await loadFor(loc);
    else await useCurrentLocation();
  }, [loadFor, useCurrentLocation]);

  const openAppSettings = useCallback(() => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:').catch(() => {});
    else Linking.openSettings().catch(() => {});
  }, []);

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */

  const updateSettings = useCallback(
    async (patch: Partial<PrayerSettings>) => {
      const previous = settingsRef.current;
      const next: PrayerSettings = {
        ...previous,
        ...patch,
        adjustments: { ...previous.adjustments, ...(patch.adjustments ?? {}) },
      };
      settingsRef.current = next;
      setSettings(next);
      resetSystemClockCache();
      await savePrayerSettings(next);

      // Only the method/school are computed server-side — refetch for those.
      const needsRefetch =
        next.methodId !== previous.methodId || next.school !== previous.school;
      const loc = locationRef.current;
      if (needsRefetch && loc) await loadFor(loc, next);
    },
    [loadFor],
  );

  const resetSettings = useCallback(async () => {
    await updateSettings(DEFAULT_PRAYER_SETTINGS);
  }, [updateSettings]);

  /* ---------------------------------------------------------------- */
  /* Bootstrap                                                         */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedSettings, storedLocation, cache] = await Promise.all([
        loadPrayerSettings(),
        loadSavedLocation(),
        loadPrayerCache(),
      ]);
      if (cancelled) return;

      settingsRef.current = storedSettings;
      setSettings(storedSettings);

      // Seed from cache so the card renders instantly, then revalidate.
      if (cache) {
        setToday(cache.today);
        setTomorrow(cache.tomorrow);
        setLocation(cache.location);
        setLastUpdated(cache.savedAt);
        setStatus('ready');
      }

      const known = storedLocation ?? cache?.location ?? null;
      if (known) {
        await loadFor(known, storedSettings);
        return;
      }

      // No saved location: only auto-resolve if permission is already granted.
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status === Location.PermissionStatus.GRANTED) {
          await useCurrentLocation();
        } else if (!cache) {
          setStatus('needs-location');
        }
      } catch {
        if (!cancelled && !cache) setStatus('needs-location');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFor, useCurrentLocation]);

  /* ---------------------------------------------------------------- */
  /* One countdown tick for the whole app                              */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Foreground + midnight refresh                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      const loc = locationRef.current;
      if (!loc) return;
      const stale = Date.now() - lastFetchAtRef.current > FOREGROUND_REFRESH_MS;
      const current = todayRef.current;
      const rolledOver =
        !!current && getZonedNow(current.timezone).dateKey !== current.dateKey;
      if (stale || rolledOver) void loadFor(loc);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [loadFor]);

  const zoned = useMemo(
    () => getZonedNow(today?.timezone, new Date(nowMs)),
    [nowMs, today?.timezone],
  );

  // Date rollover while the app stays open. Blocked while offline so a
  // failing network can never spin into a refetch loop.
  useEffect(() => {
    if (status !== 'ready' || offline || !today || !location) return;
    if (zoned.dateKey === today.dateKey) return;
    void loadFor(location);
  }, [zoned.dateKey, status, offline, today, location, loadFor]);

  /* ---------------------------------------------------------------- */
  /* Derived view data                                                 */
  /* ---------------------------------------------------------------- */

  const adjusted = useMemo(
    () => (today ? adjustedTimes(today, settings.adjustments) : null),
    [today, settings.adjustments],
  );

  const rows = useMemo(
    () => (adjusted ? buildPrayerRows(adjusted, PRAYER_ORDER, settings.timeFormat) : []),
    [adjusted, settings.timeFormat],
  );

  const next = useMemo(() => {
    if (!adjusted) return null;
    const tomorrowFajr =
      tomorrow ? adjustedTimes(tomorrow, settings.adjustments).fajr : null;
    return computeNextPrayer(adjusted, tomorrowFajr, zoned.secondsOfDay, settings.timeFormat);
  }, [adjusted, tomorrow, settings.adjustments, settings.timeFormat, zoned.secondsOfDay]);

  const value = useMemo<PrayerTimesContextValue>(
    () => ({
      status,
      refreshing,
      offline,
      lastUpdated,
      location,
      settings,
      today,
      rows,
      next,
      errorKey,
      refresh,
      useCurrentLocation,
      setManualLocation,
      updateSettings,
      resetSettings,
      openAppSettings,
    }),
    [
      status,
      refreshing,
      offline,
      lastUpdated,
      location,
      settings,
      today,
      rows,
      next,
      errorKey,
      refresh,
      useCurrentLocation,
      setManualLocation,
      updateSettings,
      resetSettings,
      openAppSettings,
    ],
  );

  return <PrayerTimesContext.Provider value={value}>{children}</PrayerTimesContext.Provider>;
}

export function usePrayerTimes(): PrayerTimesContextValue {
  const ctx = useContext(PrayerTimesContext);
  if (!ctx) throw new Error('usePrayerTimes must be used within a PrayerTimesProvider');
  return ctx;
}
