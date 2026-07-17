import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

/**
 * Calm page-turn cue for the Mushaf reader. A single Sound instance is
 * preloaded when the reader opens and replayed (never overlapped) each time the
 * page actually changes. Every call is best-effort: any failure (asset missing,
 * audio unavailable, web autoplay policy) is swallowed with a dev-only warning
 * so the reader never crashes. The user preference is persisted in AsyncStorage
 * (default ON).
 *
 * TODO: assets/sounds/page-turn.mp3 is a locally-synthesised placeholder cue —
 * drop in a nicer real page-turn clip at the same path if you prefer.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SOURCE = require('../../assets/sounds/page-turn.mp3');

const PREF_KEY = 'quran-page-turn-sound-v1';
const DEFAULT_ENABLED = true;

let sound: Audio.Sound | null = null;
let loadingPromise: Promise<void> | null = null;
let enabled = DEFAULT_ENABLED;
let prefLoaded = false;

function devWarn(message: string, err?: unknown): void {
  if (__DEV__) console.warn(`[pageTurnSound] ${message}`, err ?? '');
}

/** Read the persisted preference into memory once. */
async function loadPreference(): Promise<void> {
  if (prefLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    enabled = raw === null ? DEFAULT_ENABLED : raw === '1';
  } catch (err) {
    devWarn('failed to load preference', err);
  } finally {
    prefLoaded = true;
  }
}

/** Current cached preference (valid after preloadPageTurnSound has run). */
export function getPageTurnSoundEnabled(): boolean {
  return enabled;
}

/** Update + persist the preference. When false, playback is a no-op. */
export async function setPageTurnSoundEnabled(value: boolean): Promise<void> {
  enabled = value;
  prefLoaded = true;
  try {
    await AsyncStorage.setItem(PREF_KEY, value ? '1' : '0');
  } catch (err) {
    devWarn('failed to save preference', err);
  }
}

/** Load the preference + the sound once. Call when the reader mounts. */
export async function preloadPageTurnSound(): Promise<void> {
  await loadPreference();
  if (sound) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      // Let the short cue play even when the iOS ringer is silent.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      const { sound: created } = await Audio.Sound.createAsync(SOURCE, {
        volume: 0.4,
        shouldPlay: false,
      });
      sound = created;
    } catch (err) {
      devWarn('preload failed — is assets/sounds/page-turn.mp3 present?', err);
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

/** Play the cue from the start. No-op when disabled; never overlaps itself. */
export async function playPageTurnSound(): Promise<void> {
  if (!enabled) return;
  try {
    if (!sound) await preloadPageTurnSound();
    if (!sound) return;
    // replayAsync restarts the single instance, so rapid turns don't stack.
    await sound.replayAsync();
  } catch (err) {
    devWarn('play failed', err);
  }
}

/** Release the sound. Call when the reader unmounts. */
export async function unloadPageTurnSound(): Promise<void> {
  const current = sound;
  sound = null;
  loadingPromise = null;
  try {
    await current?.unloadAsync();
  } catch (err) {
    devWarn('unload failed', err);
  }
}
