import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { SortDir } from '../lib/sort';

export interface SortValue {
  key: string;
  dir: SortDir;
}

export function useSortParam(paramName = 'sort'): {
  value: SortValue | null;
  setSort: (v: SortValue | null) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.get(paramName);
  const value: SortValue | null = key
    ? { key, dir: searchParams.get('dir') === 'desc' ? 'desc' : 'asc' }
    : null;

  const setSort = useCallback(
    (v: SortValue | null) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (v) {
            p.set(paramName, v.key);
            p.set('dir', v.dir);
          } else {
            p.delete(paramName);
            p.delete('dir');
          }
          return p;
        },
        { replace: true },
      );
    },
    [paramName, setSearchParams],
  );

  return { value, setSort };
}