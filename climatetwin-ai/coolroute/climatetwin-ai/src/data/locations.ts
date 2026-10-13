import type { WeatherLocation } from '../types/weather';

/**
 * Quick-pick suggestions shown in the search box before the user types. They are NOT a limit:
 * any city worldwide can be searched (see services/weather/geocoding.ts).
 * Coordinates are city centres (approximate).
 */
const PK = { country: 'Pakistan', countryCode: 'PK', timezone: 'Asia/Karachi' } as const;
export const PRESET_LOCATIONS: WeatherLocation[] = [
  { id: 'karachi', name: 'Karachi', region: 'Sindh', latitude: 24.8607, longitude: 67.0011, ...PK },
  { id: 'hyderabad-sindh', name: 'Hyderabad', region: 'Sindh', latitude: 25.396, longitude: 68.3578, ...PK },
  { id: 'jacobabad', name: 'Jacobabad', region: 'Sindh', latitude: 28.2769, longitude: 68.4514, ...PK },
  { id: 'lahore', name: 'Lahore', region: 'Punjab', latitude: 31.5204, longitude: 74.3587, ...PK },
  { id: 'multan', name: 'Multan', region: 'Punjab', latitude: 30.1575, longitude: 71.5249, ...PK },
  { id: 'islamabad', name: 'Islamabad', region: 'Islamabad Capital Territory', latitude: 33.6844, longitude: 73.0479, ...PK },
];

export const DEFAULT_LOCATION = PRESET_LOCATIONS[0];

export interface CoordinateCheck {
  ok: boolean;
  error?: 'not_a_number' | 'latitude_range' | 'longitude_range';
}

export function validateCoordinates(lat: number, lon: number): CoordinateCheck {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'not_a_number' };
  if (lat < -90 || lat > 90) return { ok: false, error: 'latitude_range' };
  if (lon < -180 || lon > 180) return { ok: false, error: 'longitude_range' };
  return { ok: true };
}

/** Rounds to 2 decimals (~1 km) so we never store more precise coordinates than needed. */
export function makeCustomLocation(lat: number, lon: number): WeatherLocation {
  const la = Math.round(lat * 100) / 100;
  const lo = Math.round(lon * 100) / 100;
  return { id: `custom:${la},${lo}`, name: `${la.toFixed(2)}, ${lo.toFixed(2)}`, region: '', latitude: la, longitude: lo, custom: true };
}
