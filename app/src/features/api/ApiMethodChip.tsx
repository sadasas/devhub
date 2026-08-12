import type { ApiMethod } from '../../lib/types';

const METHOD_CLASS: Record<ApiMethod, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  PATCH: 'method-patch',
  DELETE: 'method-delete',
  OPTIONS: 'method-options',
};

export function ApiMethodChip({ method }: { method: ApiMethod }) {
  return <span className={`method-chip ${METHOD_CLASS[method]}`}>{method}</span>;
}