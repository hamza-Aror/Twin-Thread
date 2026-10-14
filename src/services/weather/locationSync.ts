/**
 * Keeps every screen on the same place.
 *
 * A snapshot is only ever shown if it belongs to the selected location. While a new city
 * is loading (or after a failed load with no cache for it) the old city's numbers are
 * withheld, so a city name can never sit next to another city's weather.
 */
import type { WeatherLocation, WeatherSnapshot } from '../../types/weather';
import { readJSON, writeJSON } from '../../utils/storage';

export function snapshotFor(snapshot: WeatherSnapshot | null, location: WeatherLocation): WeatherSnapshot | null {
  return snapshot && snapshot.location.id === location.id ? snapshot : null;
}

const RECENT_KEY = 'ct:recent-locations';
export const MAX_RECENT = 5;

/** Most-recent-first list of places the user chose, without duplicates. */
export function addRecent(list: WeatherLocation[], loc: WeatherLocation): WeatherLocation[] {
  return [loc, ...list.filter((l) => l.id !== loc.id)].slice(0, MAX_RECENT);
}

export function loadRecent(): WeatherLocation[] {
  const list = readJSON<WeatherLocation[]>(RECENT_KEY, []);
  return Array.isArray(list)
    ? list.filter((l) => l && typeof l.id === 'string' && typeof l.latitude === 'number' && typeof l.longitude === 'number').slice(0, MAX_RECENT)
    : [];
}

export function saveRecent(list: WeatherLocation[]): void {
  writeJSON(RECENT_KEY, list);
}
