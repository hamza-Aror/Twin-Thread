/**
 * Resources near the selected location, shared by the Dashboard map and the Resource map page,
 * so both always show the same entries for the same city.
 *
 * Live mode: real places from OpenStreetMap (Overpass), fetched once per location (cached and
 * de-duplicated in services/places/overpass.ts) plus this browser's unverified reports.
 * Demo mode: the labelled demo entries instead of OpenStreetMap; never mixed with live results.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunityResource, ResourceType } from '../types/resources';
import type { WeatherLocation } from '../types/weather';
import { NEARBY_KM, SAMPLE_RESOURCES, nearbyResources, type NearbyResource } from '../data/resources';
import { loadSuggestions } from '../services/resourceStore';
import { OverpassError, fetchNearbyPlaces, placesKey } from '../services/places/overpass';

export { NEARBY_KM, nearbyResources };
export type { NearbyResource };

export type PlacesStatus = 'loading' | 'ready' | 'error' | 'demo';

export interface PlacesState {
  status: PlacesStatus;
  error: OverpassError['kind'] | null;
  fetchedAt: number | null;
  fromCache: boolean;
}

const EMPTY: CommunityResource[] = [];
const ALL_TYPES: Record<ResourceType, boolean> = { water: true, park: true, indoor: true, cooling: true, assistance: true };

export function useResources(location: WeatherLocation, demoMode: boolean) {
  const [types, setTypes] = useState<Record<ResourceType, boolean>>(ALL_TYPES);
  const [includeReports, setIncludeReports] = useState(true);
  const [suggestions, setSuggestions] = useState<CommunityResource[]>(loadSuggestions);
  const reloadSuggestions = useCallback(() => setSuggestions(loadSuggestions()), []);

  const key = placesKey(location.latitude, location.longitude);
  const [places, setPlaces] = useState<{ key: string; list: CommunityResource[] }>({ key: '', list: [] });
  const [state, setState] = useState<PlacesState>({ status: demoMode ? 'demo' : 'loading', error: null, fetchedAt: null, fromCache: false });
  const [attempt, setAttempt] = useState(0);
  const forceNext = useRef(false);

  // One request per location (not per render or keystroke). Late answers for an earlier location are ignored.
  useEffect(() => {
    if (demoMode) {
      setState({ status: 'demo', error: null, fetchedAt: null, fromCache: false });
      return;
    }
    let cancelled = false;
    const force = forceNext.current;
    forceNext.current = false;
    setState({ status: 'loading', error: null, fetchedAt: null, fromCache: false });
    fetchNearbyPlaces(location.latitude, location.longitude, location.id, { force })
      .then((res) => {
        if (cancelled) return;
        setPlaces({ key, list: res.places });
        setState({ status: 'ready', error: null, fetchedAt: res.fetchedAt, fromCache: res.fromCache });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPlaces({ key, list: [] });
        setState({ status: 'error', error: err instanceof OverpassError ? err.kind : 'network', fetchedAt: null, fromCache: false });
      });
    return () => {
      cancelled = true;
    };
    // location.id/coordinates are captured through `key`; re-run only when the place or attempt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, demoMode, attempt]);

  const retry = useCallback(() => {
    forceNext.current = true;
    setAttempt((a) => a + 1);
  }, []);

  const base = demoMode ? SAMPLE_RESOURCES : places.key === key ? places.list : EMPTY;
  const all = useMemo(() => [...base, ...suggestions], [base, suggestions]);
  const visible = useMemo(() => nearbyResources(all, location, types, includeReports), [all, location, types, includeReports]);
  const counts = useMemo(() => {
    const c: Record<ResourceType, number> = { water: 0, park: 0, indoor: 0, cooling: 0, assistance: 0 };
    for (const x of nearbyResources(all, location, ALL_TYPES, includeReports)) c[x.r.type]++;
    return c;
  }, [all, location, includeReports]);
  const toggleType = useCallback((ty: ResourceType) => setTypes((s) => ({ ...s, [ty]: !s[ty] })), []);

  return { types, toggleType, includeReports, setIncludeReports, visible, counts, reloadSuggestions, places: state, retry };
}
