import { describe, expect, it } from 'vitest';
import { InvalidResponseError, normalizeOpenMeteo } from '../services/weather/normalize';
import { WeatherFetchError, buildForecastUrl, fetchForecast } from '../services/weather/openMeteo';
import { generateDemoSnapshot } from '../data/demoWeather';
import { DEFAULT_LOCATION, makeCustomLocation, validateCoordinates } from '../data/locations';

const T0 = 1_780_000_000 - (1_780_000_000 % 3600); // a whole hour

/** Minimal fixture in the shape Open-Meteo returns with timeformat=unixtime. */
function fixture(hours = 48) {
  const time = Array.from({ length: hours }, (_, i) => T0 - 3 * 3600 + i * 3600);
  return {
    latitude: 24.86,
    longitude: 67.0,
    timezone: 'Asia/Karachi',
    utc_offset_seconds: 18000,
    current: { time: T0 + 900, temperature_2m: 34.2, relative_humidity_2m: 58, apparent_temperature: 39.1, wind_speed_10m: 12.3, weather_code: 1, is_day: 1 },
    hourly: {
      time,
      temperature_2m: time.map((_, i) => 30 + (i % 10)),
      relative_humidity_2m: time.map(() => 60),
      apparent_temperature: time.map(() => 35),
      wind_speed_10m: time.map(() => 10),
      uv_index: time.map(() => 5),
      precipitation_probability: time.map(() => 0),
      is_day: time.map(() => 1),
    },
    daily: {
      time: [T0 - 10 * 3600, T0 + 14 * 3600],
      temperature_2m_max: [38, 39],
      temperature_2m_min: [29, 30],
      apparent_temperature_max: [44, 45],
      uv_index_max: [9, 9],
      sunrise: [T0, T0 + 86400],
      sunset: [T0 + 40000, T0 + 126400],
    },
  };
}

describe('normalizeOpenMeteo', () => {
  it('starts the outlook at the current hour and keeps 24 hours', () => {
    const snap = normalizeOpenMeteo(fixture(), DEFAULT_LOCATION, 123);
    expect(snap.hourly).toHaveLength(24);
    expect(snap.hourly[0].time).toBe(T0);
    expect(snap.source).toBe('live');
    expect(snap.fetchedAt).toBe(123);
    expect(snap.current.temperatureC).toBe(34.2);
    expect(snap.daily).toHaveLength(2);
    expect(snap.validation.valuesRejected).toBe(0);
  });

  it('nulls implausible values and reports them instead of using them', () => {
    const raw = fixture();
    raw.hourly.relative_humidity_2m[3] = 140;
    (raw.hourly.temperature_2m as unknown[])[4] = null;
    const snap = normalizeOpenMeteo(raw, DEFAULT_LOCATION, 0);
    // raw index 3 is the current hour (fixture starts 3 h earlier)
    expect(snap.hourly[0].relativeHumidity).toBeNull();
    expect(snap.hourly[1].temperatureC).toBeNull();
    expect(snap.hourly[2].relativeHumidity).toBe(60);
    expect(snap.validation.valuesRejected).toBe(2);
    expect(snap.validation.issues.join(' ')).toContain('humidity');
  });

  it('throws on a structurally invalid response', () => {
    expect(() => normalizeOpenMeteo(null, DEFAULT_LOCATION, 0)).toThrow(InvalidResponseError);
    expect(() => normalizeOpenMeteo({ current: {} }, DEFAULT_LOCATION, 0)).toThrow(InvalidResponseError);
    const raw = fixture();
    raw.hourly.relative_humidity_2m = raw.hourly.relative_humidity_2m.slice(0, 5);
    expect(() => normalizeOpenMeteo(raw, DEFAULT_LOCATION, 0)).toThrow(/expected/);
  });

  it('surfaces API error bodies', () => {
    expect(() => normalizeOpenMeteo({ error: true, reason: 'Latitude must be in range' }, DEFAULT_LOCATION, 0)).toThrow(/Latitude/);
  });
});

describe('fetchForecast', () => {
  const ok = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

  it('builds a request with the documented variables', () => {
    const url = new URL(buildForecastUrl(DEFAULT_LOCATION));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('hourly')).toContain('relative_humidity_2m');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
  });

  it('returns a validated live snapshot', async () => {
    const snap = await fetchForecast(DEFAULT_LOCATION, { fetchImpl: ok(fixture()) as typeof fetch, now: () => 42 });
    expect(snap.source).toBe('live');
    expect(snap.fetchedAt).toBe(42);
  });

  it('classifies HTTP errors', async () => {
    const bad = (async () => new Response(JSON.stringify({ error: true, reason: 'bad' }), { status: 400 })) as typeof fetch;
    await expect(fetchForecast(DEFAULT_LOCATION, { fetchImpl: bad })).rejects.toMatchObject({ info: { kind: 'http', status: 400 } });
  });

  it('classifies network failures', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(fetchForecast(DEFAULT_LOCATION, { fetchImpl: down })).rejects.toBeInstanceOf(WeatherFetchError);
    await expect(fetchForecast(DEFAULT_LOCATION, { fetchImpl: down })).rejects.toMatchObject({ info: { kind: 'network' } });
  });

  it('times out', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    await expect(fetchForecast(DEFAULT_LOCATION, { fetchImpl: hang, timeoutMs: 20 })).rejects.toMatchObject({ info: { kind: 'timeout' } });
  });

  it('rejects invalid coordinates before any request', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    await expect(fetchForecast({ ...DEFAULT_LOCATION, latitude: 120 }, { fetchImpl: spy })).rejects.toMatchObject({ info: { kind: 'invalid_location' } });
    expect(called).toBe(false);
  });
});

describe('locations and demo data', () => {
  it('validates coordinates', () => {
    expect(validateCoordinates(24.8, 67).ok).toBe(true);
    expect(validateCoordinates(91, 0).error).toBe('latitude_range');
    expect(validateCoordinates(0, -181).error).toBe('longitude_range');
    expect(validateCoordinates(Number.NaN, 0).error).toBe('not_a_number');
  });

  it('rounds custom coordinates to ~1 km precision', () => {
    const loc = makeCustomLocation(24.861234, 67.001987);
    expect(loc.latitude).toBe(24.86);
    expect(loc.longitude).toBe(67);
  });

  it('demo snapshot is labelled as demo and covers 24 hours', () => {
    const snap = generateDemoSnapshot(DEFAULT_LOCATION, T0 * 1000);
    expect(snap.source).toBe('demo');
    expect(snap.hourly).toHaveLength(24);
    expect(snap.current.apparentTemperatureC).toBeNull();
  });
});
