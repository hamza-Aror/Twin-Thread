import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['overview', 'outlook', 'explain', 'window', 'map', 'simulator', 'alerts', 'method'] as const;
export type Route = (typeof ROUTES)[number];

function parse(hash: string): Route {
  const r = hash.replace(/^#\/?/, '').split('?')[0];
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : 'overview';
}

/** Minimal hash router: #/outlook etc. Works on any static host without server rewrites. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((r: Route) => {
    if (parse(window.location.hash) !== r) window.location.hash = `/${r}`;
    else setRoute(r);
  }, []);
  return [route, navigate];
}
