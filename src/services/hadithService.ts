import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { TranslationKey } from '../i18n/translations';
import {
  HADITH_CACHE_LIMIT,
  HADITH_CACHE_VERSION,
  type DorarApiResponse,
  type HadithCache,
  type HadithPage,
  type HadithSearchParams,
} from '../types/hadith.types';
import { sanitizeInput } from '../utils/inputSanitizer';
import { parseDorarPage } from '../utils/hadithParser';
import { normalizeText } from '../utils/textNormalizer';

/**
 * Dorar (الدرر السنية) hadith search.
 *
 * The endpoint needs no key or account. It is, however, CORS-blocked, so the
 * web build goes through the app's own /api/hadith relay while native talks
 * to Dorar directly. Both paths share one parser, so results are identical.
 *
 * Follows the same shape as prayerTimesService.ts: AbortController timeout,
 * validated payloads, a typed error carrying a TranslationKey, and a
 * versioned cache that a failed request can never corrupt.
 */

const DORAR_ENDPOINT = 'https://dorar.net/dorar_api.json';
const PROXY_ENDPOINT = '/api/hadith';
const REQUEST_TIMEOUT_MS = 15_000;

export const HADITH_CACHE_KEY = 'basirah-hadith-cache-v1';

/** Minimum query length worth sending upstream. */
export const MIN_QUERY_LENGTH = 2;

export class HadithError extends Error {
  readonly messageKey: TranslationKey;

  constructor(messageKey: TranslationKey, detail?: string) {
    super(detail ?? messageKey);
    this.name = 'HadithError';
    this.messageKey = messageKey;
  }
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cloudflare rejects requests with a missing or stub User-Agent (verified:
 * no UA and a bare "Mozilla/5.0" both return 403, while a full browser UA —
 * and React Native's own okhttp/CFNetwork agents — return 200). Send an
 * explicit browser-like UA so the outcome does not depend on the platform's
 * default agent. Web goes through our relay instead and sets its own.
 */
const NATIVE_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

/** Builds the request URL for the current platform. */
export function buildRequestUrl({ query, degree, page }: HadithSearchParams): string {
  const q = encodeURIComponent(query);
  const safePage = Math.max(1, Math.floor(page) || 1);

  if (Platform.OS === 'web') {
    const degreeParam = degree === 'all' ? '' : `&d=${degree}`;
    return `${PROXY_ENDPOINT}?q=${q}&page=${safePage}${degreeParam}`;
  }
  // `d[]` is Dorar's own array-style parameter name.
  const degreeParam = degree === 'all' ? '' : `&${encodeURIComponent('d[]')}=${degree}`;
  return `${DORAR_ENDPOINT}?skey=${q}&page=${safePage}${degreeParam}`;
}

async function requestDorar(url: string, signal?: AbortSignal): Promise<DorarApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Let a caller-supplied signal (query changed, unmount) cancel us too.
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: Platform.OS === 'web' ? { Accept: 'application/json' } : NATIVE_HEADERS,
    });
    if (!response.ok) {
      throw new HadithError('hadith.invalidResponse', `HTTP ${response.status}`);
    }
    const json = (await response.json()) as unknown;
    if (typeof json !== 'object' || json === null) {
      throw new HadithError('hadith.invalidResponse');
    }
    return json as DorarApiResponse;
  } catch (error) {
    if (error instanceof HadithError) throw error;
    const name = (error as { name?: string })?.name;
    throw new HadithError(name === 'AbortError' ? 'hadith.timeout' : 'hadith.connectionFailed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

export function cacheKeyFor({ query, degree, page }: HadithSearchParams): string {
  return `${normalizeText(query)}|${degree}|${page}`;
}

function isHadithPage(value: unknown): value is HadithPage {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as HadithPage;
  return Array.isArray(page.results) && typeof page.hasMore === 'boolean';
}

async function loadCache(): Promise<HadithCache> {
  try {
    const raw = await AsyncStorage.getItem(HADITH_CACHE_KEY);
    if (!raw) return { version: HADITH_CACHE_VERSION, entries: [] };
    const parsed = JSON.parse(raw) as HadithCache;
    if (parsed?.version !== HADITH_CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return { version: HADITH_CACHE_VERSION, entries: [] };
    }
    return {
      version: HADITH_CACHE_VERSION,
      entries: parsed.entries.filter((e) => e && typeof e.key === 'string' && isHadithPage(e.page)),
    };
  } catch {
    return { version: HADITH_CACHE_VERSION, entries: [] };
  }
}

export async function readCachedPage(params: HadithSearchParams): Promise<HadithPage | null> {
  const cache = await loadCache();
  return cache.entries.find((e) => e.key === cacheKeyFor(params))?.page ?? null;
}

/** Stores a page as most-recently-used, trimming the oldest beyond the limit. */
async function writeCachedPage(params: HadithSearchParams, page: HadithPage): Promise<void> {
  // Never let an empty result evict a good cached page for the same query.
  if (page.results.length === 0) return;
  try {
    const key = cacheKeyFor(params);
    const cache = await loadCache();
    const entries = [{ key, page }, ...cache.entries.filter((e) => e.key !== key)].slice(
      0,
      HADITH_CACHE_LIMIT,
    );
    await AsyncStorage.setItem(
      HADITH_CACHE_KEY,
      JSON.stringify({ version: HADITH_CACHE_VERSION, entries }),
    );
  } catch {
    /* storage full/unavailable — the session still works in memory */
  }
}

export async function clearHadithCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HADITH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface HadithSearchOutcome {
  page: HadithPage;
  /** True when the network failed and a cached page was served instead. */
  fromCache: boolean;
}

/**
 * Runs one search. On network failure it falls back to a cached page for the
 * same query when one exists, and only throws when there is nothing to show.
 */
export async function searchHadith(
  rawParams: HadithSearchParams,
  signal?: AbortSignal,
): Promise<HadithSearchOutcome> {
  const query = sanitizeInput(rawParams.query);
  if (query.length < MIN_QUERY_LENGTH) {
    return { page: { results: [], hasMore: false, fetchedAt: Date.now() }, fromCache: false };
  }
  const params: HadithSearchParams = { ...rawParams, query };

  try {
    const json = await requestDorar(buildRequestUrl(params), signal);
    const page = parseDorarPage(json.ahadith?.result, params.page);
    await writeCachedPage(params, page);
    return { page, fromCache: false };
  } catch (error) {
    const cached = await readCachedPage(params);
    if (cached) return { page: cached, fromCache: true };
    throw error instanceof HadithError ? error : new HadithError('hadith.error');
  }
}
