import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from '../i18n/translations';
import { HadithError, MIN_QUERY_LENGTH, searchHadith } from '../services/hadithService';
import {
  type HadithDegreeFilter,
  type HadithResult,
  type HadithStatus,
} from '../types/hadith.types';

/**
 * Hadith search state for one screen.
 *
 * Deliberately a plain hook rather than a provider: unlike prayer times
 * (which needs one app-wide countdown), search state is local to whichever
 * screen is showing it. Every request is cancellable, and a stale response
 * can never overwrite a newer one.
 */

export interface UseHadithSearch {
  query: string;
  setQuery: (value: string) => void;
  degree: HadithDegreeFilter;
  setDegree: (value: HadithDegreeFilter) => void;
  results: HadithResult[];
  status: HadithStatus;
  /** True when the shown results came from cache after a failed request. */
  fromCache: boolean;
  errorKey: TranslationKey | null;
  hasMore: boolean;
  loadingMore: boolean;
  submit: (value?: string) => void;
  loadMore: () => void;
  retry: () => void;
  reset: () => void;
}

export function useHadithSearch(initialQuery = ''): UseHadithSearch {
  const [query, setQuery] = useState(initialQuery);
  const [degree, setDegreeState] = useState<HadithDegreeFilter>('all');
  const [results, setResults] = useState<HadithResult[]>([]);
  const [status, setStatus] = useState<HadithStatus>('idle');
  const [fromCache, setFromCache] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /** The query actually in flight / displayed — not the text being typed. */
  const activeQueryRef = useRef('');
  const pageRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  /** Monotonic id so a slow earlier response cannot clobber a newer one. */
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (searchQuery: string, searchDegree: HadithDegreeFilter, page: number) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setStatus('idle');
        setResults([]);
        setHasMore(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      const appending = page > 1;
      if (appending) setLoadingMore(true);
      else setStatus('loading');
      setErrorKey(null);

      try {
        const { page: result, fromCache: cached } = await searchHadith(
          { query: trimmed, degree: searchDegree, page },
          controller.signal,
        );
        // Ignore anything that is no longer the newest request.
        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        activeQueryRef.current = trimmed;
        pageRef.current = page;
        setFromCache(cached);
        setHasMore(result.hasMore);
        setResults((prev) => (appending ? [...prev, ...result.results] : result.results));

        const total = appending ? results.length + result.results.length : result.results.length;
        if (total === 0) setStatus('empty');
        else setStatus(cached ? 'offline' : 'ready');
      } catch (error) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setErrorKey(error instanceof HadithError ? error.messageKey : 'hadith.error');
        // Keep whatever is already on screen; only a first page becomes an error state.
        if (!appending) {
          setResults([]);
          setHasMore(false);
        }
        setStatus('error');
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) setLoadingMore(false);
      }
    },
    // `results.length` is read only to compute the empty check for appends.
    [results.length],
  );

  const submit = useCallback(
    (value?: string) => {
      const next = (value ?? query).trim();
      if (value !== undefined) setQuery(value);
      void run(next, degree, 1);
    },
    [query, degree, run],
  );

  const setDegree = useCallback(
    (value: HadithDegreeFilter) => {
      setDegreeState(value);
      // Re-run immediately so the filter feels live, but only if a search exists.
      const active = activeQueryRef.current || query.trim();
      if (active.length >= MIN_QUERY_LENGTH) void run(active, value, 1);
    },
    [query, run],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || status === 'loading') return;
    void run(activeQueryRef.current, degree, pageRef.current + 1);
  }, [hasMore, loadingMore, status, degree, run]);

  const retry = useCallback(() => {
    const active = activeQueryRef.current || query.trim();
    void run(active, degree, 1);
  }, [query, degree, run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    activeQueryRef.current = '';
    pageRef.current = 1;
    setResults([]);
    setStatus('idle');
    setErrorKey(null);
    setHasMore(false);
    setFromCache(false);
  }, []);

  return useMemo(
    () => ({
      query,
      setQuery,
      degree,
      setDegree,
      results,
      status,
      fromCache,
      errorKey,
      hasMore,
      loadingMore,
      submit,
      loadMore,
      retry,
      reset,
    }),
    [
      query,
      degree,
      setDegree,
      results,
      status,
      fromCache,
      errorKey,
      hasMore,
      loadingMore,
      submit,
      loadMore,
      retry,
      reset,
    ],
  );
}
