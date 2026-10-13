/**
 * Open-Meteo forecast client. This is the ONLY module that talks to the weather API.
 * Docs: https://open-meteo.com/en/docs  ·  Terms: https://open-meteo.com/en/terms
 * The free tier is for non-commercial use, needs no API key, and requires attribution.
 */
import type { WeatherError, WeatherLocation, WeatherSnapshot } from '../../types/weather';
import { InvalidResponseError, normalizeOpenMeteo } from './normalize';
import { validateCoordinates } from '../../data/locations';

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const DEFAULT_TIMEOUT_MS = 10_000;

const CURRENT_VARS = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'wind_speed_10m', 'weather_code', 'is_day'];
const HOURLY_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'wind_speed_10m',
  'uv_index',
  'precipitation_probability',
  'is_day',
];
const DAILY_VARS = ['temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'uv_index_max', 'sunrise', 'sunset'];

export function buildForecastUrl(loc: WeatherLocation): string {
  const params = new URLSearchParams({
    latitude: loc.latitude.toFixed(4),
    longitude: loc.longitude.toFixed(4),
    current: CURRENT_VARS.join(','),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    forecast_days: '3',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
  });
  return `${OPEN_METEO_ENDPOINT}?${params.toString()}`;
}

export class WeatherFetchError extends Error {
  readonly info: WeatherError;
  constructor(info: WeatherError) {
    super(info.message);
    this.name = 'WeatherFetchError';
    this.info = info;
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function fetchForecast(loc: WeatherLocation, opts: FetchOptions = {}): Promise<WeatherSnapshot> {
  const check = validateCoordinates(loc.latitude, loc.longitude);
  if (!check.ok) throw new WeatherFetchError({ kind: 'invalid_location', message: `Invalid coordinates (${check.error})` });

  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  let response: Response;
  try {
    response = await fetchImpl(buildForecastUrl(loc), { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (timedOut) throw new WeatherFetchError({ kind: 'timeout', message: 'The weather service did not respond in time.' });
    if (opts.signal?.aborted) throw err;
    throw new WeatherFetchError({ kind: 'network', message: 'Could not reach the weather service. Check the internet connection.' });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }

  if (!response.ok) {
    let reason = '';
    try {
      const body = (await response.json()) as { reason?: string };
      reason = body.reason ? `: ${body.reason}` : '';
    } catch {
      /* body was not JSON */
    }
    throw new WeatherFetchError({ kind: 'http', status: response.status, message: `Weather service returned HTTP ${response.status}${reason}` });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new WeatherFetchError({ kind: 'invalid_response', message: 'Weather service returned data that is not valid JSON.' });
  }

  try {
    return normalizeOpenMeteo(json, loc, now(), 'live');
  } catch (err) {
    if (err instanceof InvalidResponseError) {
      throw new WeatherFetchError({ kind: 'invalid_response', message: `Unexpected weather data: ${err.message}` });
    }
    throw err;
  }
}
