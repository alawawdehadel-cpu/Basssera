import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';

/**
 * ============================================================
 *  The ONE place Firebase is configured and initialized.
 *
 *  Nothing else in the app may call initializeApp/initializeAuth — doing it
 *  twice is the classic source of "Auth has already been initialized" and of
 *  two Auth instances disagreeing about who is signed in.
 *
 *  Config comes from EXPO_PUBLIC_FIREBASE_* (see .env.example). Those values
 *  are NOT secrets: Firebase client config is designed to ship inside the app
 *  and access is controlled by security rules. Service-account keys and Admin
 *  SDK credentials must never appear in this project — they belong only to the
 *  Node import scripts under scripts/firebase/.
 *
 *  The app must remain fully usable when Firebase is NOT configured (no .env
 *  yet, which is the state today). Initialization is therefore lazy and
 *  non-throwing at import time: `isFirebaseConfigured()` reports the truth and
 *  callers degrade gracefully — for tafsir that means the same "unavailable"
 *  card as being offline, never a crash and never a blank screen.
 * ============================================================
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Read as separate literal `process.env.X` expressions on purpose: Expo
 * inlines EXPO_PUBLIC_* at build time by static text substitution, so dynamic
 * lookups like process.env[name] would silently be undefined in a release
 * build.
 */
const RAW_CONFIG: Record<keyof FirebaseConfig, string | undefined> = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const REQUIRED_KEYS = Object.keys(RAW_CONFIG) as (keyof FirebaseConfig)[];

/** Placeholder values from .env.example — present but not actually configured. */
function isPlaceholder(value: string): boolean {
  return value.includes('replace_me') || value.startsWith('your-project');
}

function readConfig(): { config: FirebaseConfig | null; missing: string[] } {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const value = RAW_CONFIG[key];
    if (!value || !value.trim() || isPlaceholder(value)) missing.push(key);
  }
  if (missing.length > 0) return { config: null, missing };
  return { config: RAW_CONFIG as FirebaseConfig, missing: [] };
}

const { config, missing } = readConfig();

/** True when every required EXPO_PUBLIC_FIREBASE_* value is present and real. */
export function isFirebaseConfigured(): boolean {
  return config !== null;
}

/** Which config keys are missing — for a dev-only diagnostic, never shown raw to users. */
export function missingFirebaseKeys(): string[] {
  return [...missing];
}

/** Thrown by the getters below when Firebase was never configured. */
export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Firebase is not configured. Copy .env.example to .env and fill in the ' +
        `EXPO_PUBLIC_FIREBASE_* values (missing: ${missing.join(', ') || 'none'}).`,
    );
    this.name = 'FirebaseNotConfiguredError';
  }
}

/* ------------------------------------------------------------------ */
/* React Native auth persistence                                       */
/* ------------------------------------------------------------------ */

/**
 * `getReactNativePersistence` exists at runtime but not in the published types.
 *
 * Verified against firebase 10.14.1: `firebase/auth` resolves to
 * `dist/esm/index.esm.js`, whose entire body is `export * from '@firebase/auth'`;
 * Metro then resolves `@firebase/auth` via its `react-native` field to
 * `dist/rn/index.js`, which DOES export `getReactNativePersistence`. TypeScript
 * meanwhile reads `typings: dist/auth/index.d.ts` — the browser build — which
 * does not declare it. Hence the cast, confined to these few lines.
 */
type ReactNativePersistenceFactory = (storage: unknown) => Persistence;

function reactNativePersistence(): Persistence | null {
  const mod = require('firebase/auth') as {
    getReactNativePersistence?: ReactNativePersistenceFactory;
  };
  if (typeof mod.getReactNativePersistence !== 'function') return null;
  return mod.getReactNativePersistence(AsyncStorage);
}

/**
 * Web keeps sessions in localStorage; native keeps them in AsyncStorage so a
 * signed-in user survives an app restart. If the RN factory is somehow absent
 * we fall back to in-memory rather than crashing — the user simply has to sign
 * in again next launch, which is a far better failure than a boot loop.
 */
function persistenceForPlatform(): Persistence {
  if (Platform.OS === 'web') return browserLocalPersistence;
  return reactNativePersistence() ?? inMemoryPersistence;
}

/* ------------------------------------------------------------------ */
/* Lazy singletons                                                     */
/* ------------------------------------------------------------------ */

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let emulatorsConnected = false;

const USE_EMULATOR =
  __DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';

export function getFirebaseApp(): FirebaseApp {
  if (!config) throw new FirebaseNotConfiguredError();
  if (appInstance) return appInstance;
  // getApps() guards against Fast Refresh re-running this module.
  appInstance = getApps().length > 0 ? getApp() : initializeApp(config);
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  try {
    authInstance = initializeAuth(app, { persistence: persistenceForPlatform() });
  } catch {
    // Already initialized (Fast Refresh, or another module got here first).
    authInstance = getAuth(app);
  }
  if (USE_EMULATOR && !emulatorsConnected) connectEmulators();
  return authInstance;
}

export function getDb(): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getFirebaseApp());
  if (USE_EMULATOR && !emulatorsConnected) connectEmulators();
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (storageInstance) return storageInstance;
  storageInstance = getStorage(getFirebaseApp());
  if (USE_EMULATOR && !emulatorsConnected) connectEmulators();
  return storageInstance;
}

/**
 * Point every initialized service at the local emulators. Guarded so it runs
 * once and only in development — a production build must never reach here.
 */
function connectEmulators(): void {
  if (emulatorsConnected || !__DEV__) return;
  emulatorsConnected = true;
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  try {
    if (authInstance) {
      connectAuthEmulator(authInstance, `http://${host}:9099`, { disableWarnings: true });
    }
    if (dbInstance) connectFirestoreEmulator(dbInstance, host, 8080);
    if (storageInstance) connectStorageEmulator(storageInstance, host, 9199);
    // eslint-disable-next-line no-console
    console.log(`[firebase] using emulators at ${host}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] could not connect emulators', error);
  }
}

/** The configured project id, or null when unconfigured. Used to build REST URLs. */
export function getProjectId(): string | null {
  return config?.projectId ?? null;
}

/** The configured web API key, or null. Used by the tafsir REST transport. */
export function getApiKey(): string | null {
  return config?.apiKey ?? null;
}
