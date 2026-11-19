import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import {
  fetchAdminOverview,
  toAdminApiError,
  type AdminApiError,
} from '../services/adminApi';
import type { AdminResponseMeta, OverviewData } from '../types/admin';
import type { AdminDateRange } from './dateRange';

interface OverviewState {
  status: 'loading' | 'success' | 'error';
  data: OverviewData | null;
  meta: AdminResponseMeta | null;
  error: AdminApiError | null;
  refreshing: boolean;
}

const INITIAL_STATE: OverviewState = {
  status: 'loading',
  data: null,
  meta: null,
  error: null,
  refreshing: false,
};

/**
 * Fetches `/api/admin/overview` for the selected range. Stale responses are
 * ignored when the range changes mid-flight; identical requests are deduped
 * inside the API service.
 */
export function useAdminOverview(range: AdminDateRange) {
  const { getIdToken } = useAuth();
  const [state, setState] = useState<OverviewState>(INITIAL_STATE);
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

    fetchAdminOverview(getIdToken, range.fromIso, range.toIso)
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
  }, [getIdToken, range.fromIso, range.toIso, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}
