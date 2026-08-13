import { useEffect, useRef, useState } from 'react';
import { api, type ProjectSearchResult } from '../lib/api';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export interface SearchState {
  results: ProjectSearchResult[];
  loading: boolean;
  error: string | null;
}

const IDLE: SearchState = { results: [], loading: false, error: null };

export function useSearchResults(query: string): SearchState {
  const [state, setState] = useState<SearchState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const q = query.trim();

  useEffect(() => {
    abortRef.current?.abort();
    if (q.length < MIN_QUERY_LENGTH) {
      setState(IDLE);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const timer = setTimeout(() => {
      api
        .search(q, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setState({ results, loading: false, error: null });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            results: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Search failed',
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return state;
}
