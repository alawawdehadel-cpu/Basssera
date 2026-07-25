import type { TranslationKey } from '../i18n/translations';
import { getApiKey, getProjectId, isFirebaseConfigured } from '../lib/firebase';
import { readCachedPassages, writeCachedPassages } from './tafsirCache';

/**
 * ============================================================
 *  Fetches tafsir passages from Firestore by document id.
 *
 *  Mirrors the house pattern in prayerTimesService.ts / hadithService.ts:
 *  AbortController timeout, validated payload, a typed error carrying a
 *  TranslationKey so the UI renders it in the active language, and a cache
 *  that a failed request can never corrupt.
 *
 *  Uses the Firestore REST API rather than the Firebase SDK for this one path:
 *
 *    - `documents:batchGet` fetches every passage for a turn in ONE request,
 *      where the SDK would issue one getDoc per document.
 *    - It keeps the SDK out of the answer path, so the offline test harness can
 *      exercise this module in bare Node through the transport seam below.
 *    - The tafsir corpus is world-readable, so no auth token is required; the
 *      API key identifies the project only. Security rules are the control.
 * ============================================================
 */

const REQUEST_TIMEOUT_MS = 8_000;

export class TafsirRemoteError extends Error {
  readonly messageKey: TranslationKey;

  constructor(messageKey: TranslationKey, detail?: string) {
    super(detail ?? messageKey);
    this.name = 'TafsirRemoteError';
    this.messageKey = messageKey;
  }
}

/** id -> verbatim passage text. */
export type PassageMap = Map<string, string>;

/**
 * The network call, isolated so tests can replace it. Follows the existing
 * `_resetTafsirSearchCache()` convention for test seams.
 */
export type TafsirTransport = (ids: string[], signal?: AbortSignal) => Promise<PassageMap>;

let transport: TafsirTransport | null = null;

/** Test seam: replace the network with a scripted transport. */
export function _setTafsirTransport(fn: TafsirTransport | null): void {
  transport = fn;
}

/* ------------------------------------------------------------------ */
/* Firestore REST                                                      */
/* ------------------------------------------------------------------ */

function documentPath(projectId: string, id: string): string {
  return `projects/${projectId}/databases/(default)/documents/tafsir_content/${id}`;
}

interface BatchGetRow {
  found?: { name?: string; fields?: { t?: { stringValue?: string } } };
  missing?: string;
}

async function fetchViaRest(ids: string[], signal?: AbortSignal): Promise<PassageMap> {
  const projectId = getProjectId();
  const apiKey = getApiKey();
  if (!projectId || !apiKey) throw new TafsirRemoteError('tafsirFetch.unavailable');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/` +
      `documents:batchGet?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ documents: ids.map((id) => documentPath(projectId, id)) }),
    });

    if (!response.ok) {
      throw new TafsirRemoteError(
        response.status === 403 || response.status === 401
          ? 'tafsirFetch.permissionDenied'
          : 'tafsirFetch.error',
        `HTTP ${response.status}`,
      );
    }

    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) throw new TafsirRemoteError('tafsirFetch.error', 'unexpected payload');

    const out: PassageMap = new Map();
    for (const row of json as BatchGetRow[]) {
      const name = row?.found?.name;
      const text = row?.found?.fields?.t?.stringValue;
      if (typeof name === 'string' && typeof text === 'string') {
        const id = name.slice(name.lastIndexOf('/') + 1);
        out.set(id, text);
      }
      // `missing` rows are left absent: the caller distinguishes "not in the
      // corpus" from "could not reach the corpus" using the bundled manifest.
    }
    return out;
  } catch (error) {
    if (error instanceof TafsirRemoteError) throw error;
    const name = (error as { name?: string })?.name;
    throw new TafsirRemoteError(
      name === 'AbortError' ? 'tafsirFetch.timeout' : 'tafsirFetch.offline',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface FetchOutcome {
  /** Text for every id that could be resolved, from cache or network. */
  passages: PassageMap;
  /** Ids that could not be resolved because the fetch failed. */
  unresolved: string[];
  /** True when at least one id was served from the local cache. */
  fromCache: boolean;
  /** Set when the network failed; drives the per-source offline copy. */
  errorKey?: TranslationKey;
}

/**
 * Resolves passages, cache first.
 *
 * Never throws: a caller mid-answer needs a partial result, not an exception.
 * Anything that could not be resolved is reported in `unresolved` so the UI can
 * show an honest per-source notice while the sources that DID resolve render
 * normally.
 */
export async function fetchPassages(
  ids: string[],
  signal?: AbortSignal,
): Promise<FetchOutcome> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) {
    return { passages: new Map(), unresolved: [], fromCache: false };
  }

  const cached = await readCachedPassages(unique);
  const missing = unique.filter((id) => !cached.has(id));

  if (missing.length === 0) {
    return { passages: cached, unresolved: [], fromCache: true };
  }

  const fetcher = transport ?? fetchViaRest;

  // Unconfigured Firebase behaves exactly like being offline: whatever is
  // cached still renders, the rest shows the unavailable notice. The app must
  // never crash or blank because a .env value is missing.
  if (!transport && !isFirebaseConfigured()) {
    return {
      passages: cached,
      unresolved: missing,
      fromCache: cached.size > 0,
      errorKey: 'tafsirFetch.unavailable',
    };
  }

  try {
    const fetched = await fetcher(missing, signal);
    const merged: PassageMap = new Map(cached);
    for (const [id, text] of fetched) merged.set(id, text);

    // Cache only what actually came back; a failed fetch must never evict good
    // entries (same rule as the prayer and hadith caches).
    if (fetched.size > 0) await writeCachedPassages(fetched);

    return {
      passages: merged,
      unresolved: missing.filter((id) => !fetched.has(id)),
      fromCache: cached.size > 0,
    };
  } catch (error) {
    return {
      passages: cached,
      unresolved: missing,
      fromCache: cached.size > 0,
      errorKey:
        error instanceof TafsirRemoteError ? error.messageKey : ('tafsirFetch.error' as TranslationKey),
    };
  }
}
