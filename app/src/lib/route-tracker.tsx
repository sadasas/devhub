import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { sendPageView } from '../lib/consent';

/**
 * Fire consent-gated GA4 page_view on every SPA navigation. Renders nothing.
 * Dedup consecutive identical paths di dalam sendPageView (race
 * inject-onload vs mount, StrictMode dev double-effect).
 * Must be mounted inside <BrowserRouter>.
 */
export function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    sendPageView();
  }, [pathname]);
  return null;
}
