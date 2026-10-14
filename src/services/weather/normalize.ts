/**
 * Validation and normalisation of raw Open-Meteo JSON into our WeatherSnapshot.
 * Kept separate from fetching so it can be unit-tested with fixture data.
 *
 * Rules:
 *  - The response must have the expected shape, or we throw (the UI shows an error).
 *  - Individual implausible values become null and are counted; they are never invented or clamped.
 */
import type {
  CurrentConditions,
  DailySummary,
  DataSource,
  HourlyPoint,
  ValidationReport,
  WeatherLocation,
  WeatherSnapshot,
} from '../../types/weather';

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

type Bounds = { min: number; max: number };
const BOUNDS: Record<string, Bounds> = {
  temperature: { min: -60, max: 60 },
  humidity: { min: 0, max: 100 },
  wind: { min: 0, max: 400 },
  uv: { min: 0, max: 20 },
  probability: { min: 0, max: 100 },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Counter {
  rejected = 0;
  issues = new Set<string>();
  num(v: unknown, bounds: Bounds | null, field: string): number | null {
    if (v === null || v === undefined) {
      this.rejected++;
      this.issues.add(`${field}: missing value(s)`);
      return null;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.rejected++;
      this.issues.add(`${field}: non-numeric value(s)`);
      return null;
    }
    if (bounds && (v < bounds.min || v > bounds.max)) {
      this.rejected++;
      this.issues.add(`${field}: value(s) outside ${bounds.min}–${bounds.max}`);
      return null;
    }
    return v;
  }
  bool(v: unknown, field: string): boolean | null {
    if (v === 0 || v === 1) return v === 1;
    if (v === null || v === undefined) {
      this.issues.add(`${field}: missing value(s)`);
      return null;
    }
    this.rejected++;
    this.issues.add(`${field}: unexpected value(s)`);
    return null;
  }
}

function requireArray(obj: Record<string, unknown>, key: string, length?: number): unknown[] {
  const arr = obj[key];
  if (!Array.isArray(arr)) throw new InvalidResponseError(`Missing array "${key}"`);
  if (length !== undefined && arr.length !== length) throw new InvalidResponseError(`Array "${key}" has ${arr.length} entries, expected ${length}`);
  return arr;
}

function optionalArray(obj: Record<string, unknown>, key: string, length: number): unknown[] {
  const arr = obj[key];
  if (Array.isArray(arr) && arr.length === length) return arr;
  return new Array(length).fill(null);
}

export function localDateString(unixSeconds: number, utcOffsetSeconds: number): string {
  return new Date((unixSeconds + utcOffsetSeconds) * 1000).toISOString().slice(0, 10);
}

export function normalizeOpenMeteo(
  raw: unknown,
  location: WeatherLocation,
  fetchedAt: number,
  source: DataSource = 'live',
): WeatherSnapshot {
  if (!isObject(raw)) throw new InvalidResponseError('Response is not a JSON object');
  if (raw.error === true) throw new InvalidResponseError(`API error: ${String(raw.reason ?? 'unknown')}`);

  const timezone = typeof raw.timezone === 'string' ? raw.timezone : 'UTC';
  const utcOffsetSeconds = typeof raw.utc_offset_seconds === 'number' ? raw.utc_offset_seconds : 0;
  const c = new Counter();

  // ---- current ----
  if (!isObject(raw.current)) throw new InvalidResponseError('Missing "current" block');
  const cur = raw.current;
  if (typeof cur.time !== 'number') throw new InvalidResponseError('current.time must be a unix timestamp');
  const current: CurrentConditions = {
    time: cur.time,
    temperatureC: c.num(cur.temperature_2m, BOUNDS.temperature, 'current temperature'),
    relativeHumidity: c.num(cur.relative_humidity_2m, BOUNDS.humidity, 'current humidity'),
    apparentTemperatureC: c.num(cur.apparent_temperature, BOUNDS.temperature, 'current apparent temperature'),
    windSpeedKmh: c.num(cur.wind_speed_10m, BOUNDS.wind, 'current wind'),
    isDay: c.bool(cur.is_day, 'current is_day'),
    weatherCode: typeof cur.weather_code === 'number' ? cur.weather_code : null,
  };

  // ---- hourly ----
  if (!isObject(raw.hourly)) throw new InvalidResponseError('Missing "hourly" block');
  const h = raw.hourly;
  const times = requireArray(h, 'time');
  if (times.length === 0) throw new InvalidResponseError('Hourly forecast is empty');
  const n = times.length;
  const temp = requireArray(h, 'temperature_2m', n);
  const rh = requireArray(h, 'relative_humidity_2m', n);
  const app = optionalArray(h, 'apparent_temperature', n);
  const wind = optionalArray(h, 'wind_speed_10m', n);
  const uv = optionalArray(h, 'uv_index', n);
  const pop = optionalArray(h, 'precipitation_probability', n);
  const day = optionalArray(h, 'is_day', n);

  // Start at the hour that contains "current.time" and take 24 hours.
  const hourStart = Math.floor(current.time / 3600) * 3600;
  const startIdx = times.findIndex((t) => typeof t === 'number' && t >= hourStart);
  if (startIdx < 0) throw new InvalidResponseError('Hourly forecast does not cover the current time');
  const endIdx = Math.min(n, startIdx + 24);

  const hourly: HourlyPoint[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const t = times[i];
    if (typeof t !== 'number') throw new InvalidResponseError(`hourly.time[${i}] is not a timestamp`);
    hourly.push({
      time: t,
      temperatureC: c.num(temp[i], BOUNDS.temperature, 'hourly temperature'),
      relativeHumidity: c.num(rh[i], BOUNDS.humidity, 'hourly humidity'),
      apparentTemperatureC: c.num(app[i], BOUNDS.temperature, 'hourly apparent temperature'),
      windSpeedKmh: c.num(wind[i], BOUNDS.wind, 'hourly wind'),
      uvIndex: c.num(uv[i], BOUNDS.uv, 'hourly UV index'),
      precipitationProbability: c.num(pop[i], BOUNDS.probability, 'hourly precipitation probability'),
      isDay: c.bool(day[i], 'hourly is_day'),
    });
  }

  // ---- daily ----
  const daily: DailySummary[] = [];
  if (isObject(raw.daily) && Array.isArray(raw.daily.time)) {
    const d = raw.daily;
    const dn = (d.time as unknown[]).length;
    const tmax = optionalArray(d, 'temperature_2m_max', dn);
    const tmin = optionalArray(d, 'temperature_2m_min', dn);
    const amax = optionalArray(d, 'apparent_temperature_max', dn);
    const uvmax = optionalArray(d, 'uv_index_max', dn);
    const sunrise = optionalArray(d, 'sunrise', dn);
    const sunset = optionalArray(d, 'sunset', dn);
    (d.time as unknown[]).forEach((t, i) => {
      if (typeof t !== 'number') return;
      daily.push({
        date: localDateString(t, utcOffsetSeconds),
        tempMaxC: c.num(tmax[i], BOUNDS.temperature, 'daily max temperature'),
        tempMinC: c.num(tmin[i], BOUNDS.temperature, 'daily min temperature'),
        apparentMaxC: c.num(amax[i], BOUNDS.temperature, 'daily max apparent temperature'),
        uvIndexMax: c.num(uvmax[i], BOUNDS.uv, 'daily max UV'),
        sunrise: typeof sunrise[i] === 'number' ? (sunrise[i] as number) : null,
        sunset: typeof sunset[i] === 'number' ? (sunset[i] as number) : null,
      });
    });
  }

  const validation: ValidationReport = {
    hourlyReceived: n,
    hourlyAccepted: hourly.length,
    valuesRejected: c.rejected,
    issues: [...c.issues],
  };

  return { location, timezone, utcOffsetSeconds, current, hourly, daily, fetchedAt, source, validation };
}
