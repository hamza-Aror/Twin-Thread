import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'outlook', 'window', 'map', 'simulator', 'alerts', 'method'] as const;
export type Route = (typeof ROUTES)[number];

/**
 * Older links keep working: "#/overview" was renamed to the Dashboard, and "#/explain"
 * ("Why this risk level") now lives inside the Dashboard's risk summary.
 */
const LEGACY: Record<string, Route> = { overview: 'dashboard', explain: 'dashboard' };

export function parseRoute(hash: string): Route {
  const r = hash.replace(/^#\/?/, '').split('?')[0];
  if (r in LEGACY) return LEGACY[r];
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : 'dashboard';
}

/** Minimal hash router: #/outlook etc. Works on any static host without server rewrites. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((r: Route) => {
    if (parseRoute(window.location.hash) !== r || window.location.hash !== `#/${r}`) window.location.hash = `/${r}`;
    else setRoute(r);
  }, []);
  return [route, navigate];
}
