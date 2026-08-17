import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

export function useNewParam(
  onTrigger: () => void,
  value?: string,
  enabled = true,
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current || !enabled) return;
    const param = searchParams.get('new');
    if (param === null) return;
    if (value !== undefined && param !== value) return;
    triggeredRef.current = true;
    onTrigger();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, value, enabled, onTrigger]);
}