/**
 * Small cache of the last successful live response per location.
 * A cached snapshot is always shown labelled as "cached" with its age — never as live.
 */
import type { WeatherLocation, WeatherSnapshot } from '../../types/weather';
import { readJSON, writeJSON } from '../../utils/storage';

const PREFIX = 'ct:wx:';
/** Older than this, cached data is not offered at all. */
export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Older than this, data is shown with a "stale" warning. Open-Meteo updates its models roughly hourly. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export function saveToCache(snapshot: WeatherSnapshot): void {
  if (snapshot.source !== 'live') return;
  writeJSON(PREFIX + snapshot.location.id, snapshot);
}

export function readFromCache(loc: WeatherLocation, now = Date.now()): WeatherSnapshot | null {
  const snap = readJSON<WeatherSnapshot | null>(PREFIX + loc.id, null);
  if (!snap || typeof snap.fetchedAt !== 'number' || !Array.isArray(snap.hourly)) return null;
  if (now - snap.fetchedAt > CACHE_MAX_AGE_MS) return null;
  // Drop hours that are already in the past so the outlook still starts "now".
  const hourStart = Math.floor(now / 1000 / 3600) * 3600;
  const hourly = snap.hourly.filter((h) => h.time >= hourStart);
  if (hourly.length === 0) return null;
  return { ...snap, hourly, source: 'cache' };
}

export function isStale(snapshot: WeatherSnapshot, now = Date.now()): boolean {
  return snapshot.source !== 'demo' && now - snapshot.fetchedAt > STALE_AFTER_MS;
}
