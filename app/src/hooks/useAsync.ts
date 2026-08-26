import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
}

const messageOf = (error: any) =>
  error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';

/**
 * Every data screen needs the same four things: load once, pull to refresh,
 * surface the backend's message on failure, and not setState after unmount.
 * `deps` re-runs the fetch the way useEffect would.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: any[] = [], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (isRefresh: boolean) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    // An explicit pull-to-refresh means "get me the real numbers", so the
    // cached responses are dropped before the fetcher runs.
    if (isRefresh) api.invalidateCache();
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) setError(messageOf(err));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run(false);
  }, [run]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => run(true),
    reload: () => run(false),
    setData,
  };
}

/** One-shot mutations (submit a form, fire a payout): tracks pending + error. */
export function useAction<A extends any[], R>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: A): Promise<R | null> => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        setError(messageOf(err));
        return null;
      } finally {
        setPending(false);
      }
    },
    [action]
  );

  return { run, pending, error, setError };
}
