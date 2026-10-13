/**
 * DEMO resources (demo mode only).
 *
 * In normal use the map shows real places from OpenStreetMap (services/places/overpass.ts).
 * These illustrative placeholders around each suggested city are used ONLY when the user switches
 * on demo mode (or opens ?demo=1), so a demo still works offline. They are NOT real places, and the
 * interface labels every one of them "Demo".
 */
import type { CommunityResource, ResourceType } from '../types/resources';
import type { WeatherLocation } from '../types/weather';
import { PRESET_LOCATIONS } from './locations';

export const SAMPLE_DATASET_DATE = '2026-10-13';

const TEMPLATE: Array<{ type: ResourceType; dLat: number; dLon: number; label: string }> = [
  { type: 'water', dLat: 0.006, dLon: 0.004, label: 'Demo water point A' },
  { type: 'water', dLat: -0.009, dLon: 0.011, label: 'Demo water point B' },
  { type: 'park', dLat: 0.012, dLon: -0.007, label: 'Demo park A' },
  { type: 'park', dLat: -0.004, dLon: -0.013, label: 'Demo park B' },
  { type: 'indoor', dLat: 0.002, dLon: 0.016, label: 'Demo indoor place' },
];

export const SAMPLE_RESOURCES: CommunityResource[] = PRESET_LOCATIONS.flatMap((loc) =>
  TEMPLATE.map((t, i) => ({
    id: `sample:${loc.id}:${i}`,
    type: t.type,
    name: t.label,
    description: null,
    latitude: Math.round((loc.latitude + t.dLat) * 10000) / 10000,
    longitude: Math.round((loc.longitude + t.dLon) * 10000) / 10000,
    hours: null,
    hoursVerified: false,
    accessibility: null,
    verification: 'sample' as const,
    source: 'demo' as const,
    lastUpdated: SAMPLE_DATASET_DATE,
    areaId: loc.id,
  })),
);

/** Theme-aware marker colours (CSS variables defined in src/index.css). */
export const RESOURCE_COLORS: Record<ResourceType, string> = {
  water: 'var(--res-water)',
  park: 'var(--res-park)',
  indoor: 'var(--res-indoor)',
  cooling: 'var(--res-cooling)',
  assistance: 'var(--res-assistance)',
};

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** External map link. This opens a third-party site; no route is computed by this app. */
export function externalDirectionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** Only entries within this distance of the selected place are listed (OpenStreetMap queries use smaller radii). */
export const NEARBY_KM = 25;

export interface NearbyResource {
  r: CommunityResource;
  km: number;
}

export function nearbyResources(
  all: CommunityResource[],
  loc: Pick<WeatherLocation, 'latitude' | 'longitude'>,
  types: Partial<Record<ResourceType, boolean>>,
  includeReports: boolean,
): NearbyResource[] {
  return all
    .filter((r) => types[r.type] !== false)
    .filter((r) => includeReports || r.verification !== 'unverified_report')
    .map((r) => ({ r, km: distanceKm(loc.latitude, loc.longitude, r.latitude, r.longitude) }))
    .filter((x) => x.km <= NEARBY_KM)
    .sort((a, b) => a.km - b.km);
}

