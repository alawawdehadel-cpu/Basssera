import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { TranslationKey } from '../i18n/translations';

/**
 * Playback state for the Recitations player + persistent mini-player.
 *
 * NOTE ON AUDIO: this app ships no recitation audio and calls no
 * external APIs, so playback is a UI simulation (ticking position over
 * an estimated duration). The full player + mini-player are complete and
 * ready to be wired to licensed audio files/streams via expo-av later —
 * only `tick` needs replacing with real sound status callbacks.
 */

export interface Reciter {
  id: string;
  /** Translation keys — reciter names are shown in the active language. */
  nameKey: TranslationKey;
  typeKey: TranslationKey;
  mono: string;
  gradient: [string, string];
}

export const RECITERS: Reciter[] = [
  { id: 'abdulbasit', nameKey: 'reciter.abdulbasit', typeKey: 'reciter.type.mujawwad', mono: 'ع', gradient: ['#0F6B50', '#084C3C'] },
  { id: 'afasy', nameKey: 'reciter.afasy', typeKey: 'reciter.type.murattal', mono: 'م', gradient: ['#C9A227', '#9C7D1C'] },
  { id: 'muaiqly', nameKey: 'reciter.muaiqly', typeKey: 'reciter.type.murattal', mono: 'م', gradient: ['#0F6B50', '#153C33'] },
  { id: 'ghamdi', nameKey: 'reciter.ghamdi', typeKey: 'reciter.type.murattal', mono: 'س', gradient: ['#2E7D64', '#084C3C'] },
];

export interface PlaybackTrack {
  surahNumber: number;
  surahName: string;
  ayahCount: number;
  reciter: Reciter;
}

interface PlaybackContextValue {
  track: PlaybackTrack | null;
  playing: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  speed: number;
  repeatOn: boolean;
  startTrack: (track: PlaybackTrack) => void;
  togglePlay: () => void;
  seekBy: (seconds: number) => void;
  cycleSpeed: () => void;
  toggleRepeat: () => void;
  stop: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlaybackTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [repeatOn, setRepeatOn] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatRef = useRef(repeatOn);
  repeatRef.current = repeatOn;

  useEffect(() => {
    if (playing) {
      const factor = SPEEDS[speedIdx];
      timer.current = setInterval(() => {
        setPosition((p) => p + factor);
      }, 1000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
    return undefined;
  }, [playing, speedIdx]);

  // Clamp / loop at end of track.
  useEffect(() => {
    if (duration > 0 && position >= duration) {
      if (repeatRef.current) setPosition(0);
      else {
        setPosition(duration);
        setPlaying(false);
      }
    }
  }, [position, duration]);

  const startTrack = useCallback((next: PlaybackTrack) => {
    setTrack(next);
    // Estimated duration until real audio is wired: ~22s per ayah.
    setDuration(Math.max(60, next.ayahCount * 22));
    setPosition(0);
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => setPlaying((p) => (track ? !p : p)), [track]);
  const seekBy = useCallback(
    (s: number) => setPosition((p) => Math.max(0, Math.min(duration, p + s))),
    [duration],
  );
  const cycleSpeed = useCallback(() => setSpeedIdx((i) => (i + 1) % SPEEDS.length), []);
  const toggleRepeat = useCallback(() => setRepeatOn((r) => !r), []);
  const stop = useCallback(() => {
    setPlaying(false);
    setTrack(null);
    setPosition(0);
  }, []);

  const value = useMemo<PlaybackContextValue>(
    () => ({
      track,
      playing,
      position,
      duration,
      speed: SPEEDS[speedIdx],
      repeatOn,
      startTrack,
      togglePlay,
      seekBy,
      cycleSpeed,
      toggleRepeat,
      stop,
    }),
    [track, playing, position, duration, speedIdx, repeatOn, startTrack, togglePlay, seekBy, cycleSpeed, toggleRepeat, stop],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within a PlaybackProvider');
  return ctx;
}
