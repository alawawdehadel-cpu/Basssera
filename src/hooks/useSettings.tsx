import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadFontSize, saveFontSize } from '../utils/storage';

const SETTINGS_KEY = 'basirah-settings-v1';

/** The design's 5-step Quran font scale (index 0–4). */
export const FONT_STEPS = [22, 25, 27, 30, 34] as const;
export const FONT_STEP_LABELS = ['صغير', 'متوسط', 'كبير', 'أكبر', 'ضخم'] as const;

export function fontStepFromSize(size: number): number {
  let best = 0;
  let bestDiff = Infinity;
  FONT_STEPS.forEach((s, i) => {
    const d = Math.abs(s - size);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

interface SettingsFlags {
  keepAwake: boolean;
  showSources: boolean;
  wifiOnly: boolean;
  dailyReminder: boolean;
}

const DEFAULT_FLAGS: SettingsFlags = {
  keepAwake: true,
  showSources: true,
  wifiOnly: true,
  dailyReminder: true,
};

interface SettingsContextValue extends SettingsFlags {
  /** Quran reader font size in px (one of FONT_STEPS, persisted). */
  quranFontSize: number;
  fontStep: number;
  setFontStep: (step: number) => void;
  toggleFlag: (key: keyof SettingsFlags) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [quranFontSize, setQuranFontSize] = useState<number>(FONT_STEPS[2]);
  const [flags, setFlags] = useState<SettingsFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    loadFontSize().then((size) => setQuranFontSize(FONT_STEPS[fontStepFromSize(size)]));
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<SettingsFlags>;
        setFlags((prev) => ({ ...prev, ...parsed }));
      })
      .catch(() => {});
  }, []);

  const setFontStep = useCallback((step: number) => {
    const clamped = Math.min(FONT_STEPS.length - 1, Math.max(0, step));
    const size = FONT_STEPS[clamped];
    setQuranFontSize(size);
    saveFontSize(size);
  }, []);

  const toggleFlag = useCallback((key: keyof SettingsFlags) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...flags,
      quranFontSize,
      fontStep: fontStepFromSize(quranFontSize),
      setFontStep,
      toggleFlag,
    }),
    [flags, quranFontSize, setFontStep, toggleFlag],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
