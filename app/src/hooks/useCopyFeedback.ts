import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/utils';

export function useCopyFeedback(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const reset = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setCopied(false);
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await copyText(text);
      if (!ok) return false;
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy, reset };
}
