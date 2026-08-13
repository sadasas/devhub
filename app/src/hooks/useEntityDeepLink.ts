import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

export function useEntityDeepLink(entity: string, onOpen: (entityId: string) => void): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    if (searchParams.get('entity') !== entity) return;
    const entityId = searchParams.get('id');
    if (!entityId) return;
    openedRef.current = true;
    onOpen(entityId);
    const next = new URLSearchParams(searchParams);
    next.delete('entity');
    next.delete('id');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, entity, onOpen]);
}
