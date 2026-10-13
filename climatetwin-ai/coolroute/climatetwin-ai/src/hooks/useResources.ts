/**
 * Resources near the selected location, shared by the Dashboard map and the Resource map page,
 * so both always show the same entries for the same city.
 */
import { useCallback, useMemo, useState } from 'react';
import type { CommunityResource, ResourceType } from '../types/resources';
import type { WeatherLocation } from '../types/weather';
import { NEARBY_KM, SAMPLE_RESOURCES, nearbyResources, type NearbyResource } from '../data/resources';
import { loadSuggestions } from '../services/resourceStore';

export { NEARBY_KM, nearbyResources };
export type { NearbyResource };

export function useResources(location: WeatherLocation) {
  const [types, setTypes] = useState<Record<ResourceType, boolean>>({ water: true, cooling: true, assistance: true });
  const [includeReports, setIncludeReports] = useState(true);
  const [suggestions, setSuggestions] = useState<CommunityResource[]>(loadSuggestions);
  const reloadSuggestions = useCallback(() => setSuggestions(loadSuggestions()), []);
  const all = useMemo(() => [...SAMPLE_RESOURCES, ...suggestions], [suggestions]);
  const visible = useMemo(() => nearbyResources(all, location, types, includeReports), [all, location, types, includeReports]);
  const toggleType = useCallback((ty: ResourceType) => setTypes((s) => ({ ...s, [ty]: !s[ty] })), []);
  return { types, toggleType, includeReports, setIncludeReports, visible, reloadSuggestions };
}
