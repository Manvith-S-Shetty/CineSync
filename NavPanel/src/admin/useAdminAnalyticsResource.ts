import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import {
  toAdminApiError,
  type AdminApiError,
  type AdminTokenGetter,
} from '../services/adminApi';
import type { AdminResponseMeta } from '../types/admin';
import type { AdminDateRange } from './dateRange';

export type AdminResourceFetcher<T> = (
  getIdToken: AdminTokenGetter,
  fromIso: string,
  toIso: string
) => Promise<{ data: T; meta: AdminResponseMeta | null }>;

export interface AdminResourceState<T> {
  status: 'loading' | 'success' | 'error';
  data: T | null;
  meta: AdminResponseMeta | null;
  error: AdminApiError | null;
  refreshing: boolean;
}

/**
 * Shared data hook for read-only admin analytics endpoints. Range changes
 * refetch once per resource; stale responses are ignored.
 */
export function useAdminAnalyticsResource<T>(
  range: AdminDateRange,
  fetcher: AdminResourceFetcher<T>
): AdminResourceState<T> & { retry: () => void } {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<AdminResourceState<T>>({
    status: 'loading',
    data: null,
    meta: null,
    error: null,
    refreshing: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    setState((previous) => ({
      status: previous.data ? 'success' : 'loading',
      data: previous.data,
      meta: previous.meta,
      error: null,
      refreshing: previous.data !== null,
    }));

    fetcher(getIdToken, range.fromIso, range.toIso)
      .then(({ data, meta }) => {
        if (!active) return;
        setState({ status: 'success', data, meta, error: null, refreshing: false });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          data: null,
          meta: null,
          error: toAdminApiError(err),
          refreshing: false,
        });
      });

    return () => {
      active = false;
    };
  }, [getIdToken, fetcher, range.fromIso, range.toIso, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}
