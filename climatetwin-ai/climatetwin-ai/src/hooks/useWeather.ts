/**
 * Loads weather for the selected location.
 *
 * Fallback policy (never silent):
 *   live request succeeds  → source "live"
 *   live request fails     → show the error; if a recent live response is cached,
 *                            show it labelled "cached" with its age
 *   demo mode              → only when the user explicitly switches it on (or ?demo=1)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestLogEntry, WeatherError, WeatherLocation, WeatherSnapshot } from '../types/weather';
import { WeatherFetchError, fetchForecast } from '../services/weather/openMeteo';
import { readFromCache, saveToCache } from '../services/weather/cache';
import { generateDemoSnapshot } from '../data/demoWeather';

export type LoadStatus = 'loading' | 'refreshing' | 'ready' | 'error';

export interface WeatherState {
  snapshot: WeatherSnapshot | null;
  status: LoadStatus;
  error: WeatherError | null;
  requestLog: RequestLogEntry[];
  refresh: () => void;
}

/** Auto-refresh interval while the tab is visible. Open-Meteo models update about hourly. */
export const AUTO_REFRESH_MS = 30 * 60 * 1000;

export function useWeather(location: WeatherLocation, demoMode: boolean): WeatherState {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<WeatherError | null>(null);
  const [requestLog, setRequestLog] = useState<RequestLogEntry[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<WeatherSnapshot | null>(null);
  snapshotRef.current = snapshot;

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (demoMode) {
      setSnapshot(generateDemoSnapshot(location, Date.now()));
      setError(null);
      setStatus('ready');
      return;
    }

    const sameLocation = snapshotRef.current?.location.id === location.id && snapshotRef.current?.source !== 'demo';
    setStatus(sameLocation ? 'refreshing' : 'loading');
    if (!sameLocation) setSnapshot(null);

    const started = performance.now();
    try {
      const snap = await fetchForecast(location, { signal: controller.signal });
      if (controller.signal.aborted) return;
      saveToCache(snap);
      setSnapshot(snap);
      setError(null);
      setStatus('ready');
      setRequestLog((log) =>
        [
          {
            at: Date.now(),
            ok: true,
            durationMs: Math.round(performance.now() - started),
            detail: `${snap.validation.hourlyAccepted} hourly records, ${snap.validation.valuesRejected} values rejected`,
            locationName: location.name,
          },
          ...log,
        ].slice(0, 20),
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      const info: WeatherError =
        err instanceof WeatherFetchError ? err.info : { kind: 'network', message: err instanceof Error ? err.message : String(err) };
      setRequestLog((log) =>
        [
          { at: Date.now(), ok: false, durationMs: Math.round(performance.now() - started), detail: `${info.kind}: ${info.message}`, locationName: location.name },
          ...log,
        ].slice(0, 20),
      );
      setError(info);
      setStatus('error');
      // Keep showing what we had for this location; otherwise offer the labelled cache.
      setSnapshot((prev) => (prev && prev.location.id === location.id && prev.source !== 'demo' ? prev : readFromCache(location)));
    }
  }, [location, demoMode]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (demoMode) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, demoMode]);

  const refresh = useCallback(() => void load(), [load]);
  return { snapshot, status, error, requestLog, refresh };
}
