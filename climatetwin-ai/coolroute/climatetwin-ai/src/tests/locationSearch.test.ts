import { describe, expect, it } from 'vitest';
import {
  GeocodingError,
  buildGeocodingUrl,
  describeLocation,
  normalizeGeocoding,
  parseQuery,
  rankByQualifier,
  searchPlaces,
} from '../services/weather/geocoding';
import { addRecent, snapshotFor } from '../services/weather/locationSync';
import { generateDemoSnapshot, utcOffsetSeconds } from '../data/demoWeather';
import { DEFAULT_LOCATION } from '../data/locations';
import { parseTheme } from '../theme/theme';
import type { WeatherLocation } from '../types/weather';

/** Shape returned by https://geocoding-api.open-meteo.com/v1/search */
const HYDERABAD_RESPONSE = {
  results: [
    { id: 1269843, name: 'Hyderabad', latitude: 17.38405, longitude: 78.45636, country_code: 'IN', country: 'India', admin1: 'Telangana', timezone: 'Asia/Kolkata', population: 3597816 },
    { id: 1176734, name: 'Hyderabad', latitude: 25.39242, longitude: 68.37366, country_code: 'PK', country: 'Pakistan', admin1: 'Sindh', timezone: 'Asia/Karachi', population: 1386330 },
    { id: 999, name: 'Broken', latitude: 'x', longitude: 1 },
    { id: 998, name: 'Out of range', latitude: 95, longitude: 1 },
  ],
  generationtime_ms: 0.7,
};

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;

describe('query parsing', () => {
  it('splits a name from a region or country qualifier', () => {
    expect(parseQuery('  Hyderabad ,  Pakistan ')).toEqual({ name: 'Hyderabad', qualifier: 'Pakistan', coordinates: null });
    expect(parseQuery('Lahore').qualifier).toBeNull();
  });

  it('recognises coordinate pairs', () => {
    expect(parseQuery('24.86, 67.01').coordinates).toEqual({ latitude: 24.86, longitude: 67.01 });
    expect(parseQuery('-33.9 151.2').coordinates).toEqual({ latitude: -33.9, longitude: 151.2 });
    expect(parseQuery('95, 10').coordinates).toBeNull();
  });

  it('builds the documented request', () => {
    const url = new URL(buildGeocodingUrl('São Paulo'));
    expect(url.hostname).toBe('geocoding-api.open-meteo.com');
    expect(url.searchParams.get('name')).toBe('São Paulo');
    expect(url.searchParams.get('count')).toBe('10');
  });
});

describe('geocoding response handling', () => {
  it('keeps same-named cities apart and skips invalid entries', () => {
    const list = normalizeGeocoding(HYDERABAD_RESPONSE);
    expect(list).toHaveLength(2);
    expect(list.map((l) => l.country)).toEqual(['India', 'Pakistan']);
    expect(list[1]).toMatchObject({ id: 'geo:1176734', region: 'Sindh', countryCode: 'PK', timezone: 'Asia/Karachi' });
  });

  it('treats a missing results key as "no matches", not an error', () => {
    expect(normalizeGeocoding({ generationtime_ms: 0.3 })).toEqual([]);
  });

  it('rejects malformed responses and API errors', () => {
    expect(() => normalizeGeocoding(null)).toThrow(GeocodingError);
    expect(() => normalizeGeocoding({ results: 'nope' })).toThrow(GeocodingError);
    expect(() => normalizeGeocoding({ error: true, reason: 'Parameter count must be between 1 and 100.' })).toThrow(/count/);
  });

  it('ranks results matching the qualifier first', () => {
    const list = normalizeGeocoding(HYDERABAD_RESPONSE);
    expect(rankByQualifier(list, 'Pakistan')[0].country).toBe('Pakistan');
    expect(rankByQualifier(list, 'pk')[0].country).toBe('Pakistan');
    expect(rankByQualifier(list, 'telangana')[0].country).toBe('India');
    expect(rankByQualifier(list, null)).toEqual(list);
  });

  it('formats labels without empty or repeated parts', () => {
    expect(describeLocation({ name: 'Hyderabad', region: 'Sindh', country: 'Pakistan' })).toBe('Hyderabad, Sindh, Pakistan');
    expect(describeLocation({ name: 'Singapore', region: '', country: 'Singapore' })).toBe('Singapore');
  });
});

describe('searchPlaces', () => {
  it('returns ranked results', async () => {
    const r = await searchPlaces('Hyderabad, Pakistan', { fetchImpl: ok(HYDERABAD_RESPONSE) });
    expect(r.kind).toBe('results');
    if (r.kind === 'results') expect(r.locations[0].region).toBe('Sindh');
  });

  it('does not call the API for one-letter queries', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    expect((await searchPlaces('K', { fetchImpl: spy })).kind).toBe('too_short');
    expect(called).toBe(false);
  });

  it('turns coordinates into a location without a request', async () => {
    const r = await searchPlaces('24.861, 67.012', { fetchImpl: ok({}) });
    expect(r).toMatchObject({ kind: 'coordinates', location: { latitude: 24.86, longitude: 67.01, custom: true } });
  });

  it('classifies network and HTTP failures', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(searchPlaces('Karachi', { fetchImpl: down })).rejects.toMatchObject({ kind: 'network' });
    const bad = (async () => new Response('{}', { status: 503 })) as typeof fetch;
    await expect(searchPlaces('Karachi', { fetchImpl: bad })).rejects.toMatchObject({ kind: 'http' });
  });
});

describe('location synchronisation', () => {
  const karachiSnap = generateDemoSnapshot(DEFAULT_LOCATION, Date.UTC(2026, 5, 1));
  const lahore: WeatherLocation = { id: 'lahore', name: 'Lahore', region: 'Punjab', latitude: 31.52, longitude: 74.36 };

  it("never returns another city's snapshot", () => {
    expect(snapshotFor(karachiSnap, DEFAULT_LOCATION)).toBe(karachiSnap);
    expect(snapshotFor(karachiSnap, lahore)).toBeNull();
    expect(snapshotFor(null, lahore)).toBeNull();
  });

  it('keeps a short, de-duplicated recent list', () => {
    let list: WeatherLocation[] = [];
    for (const id of ['a', 'b', 'c', 'a', 'd', 'e', 'f']) list = addRecent(list, { ...lahore, id });
    expect(list.map((l) => l.id)).toEqual(['f', 'e', 'd', 'a', 'c']);
  });
});

describe('demo data time zone', () => {
  it('reads UTC offsets for any IANA zone', () => {
    expect(utcOffsetSeconds('Asia/Karachi', Date.UTC(2026, 0, 1))).toBe(5 * 3600);
    expect(utcOffsetSeconds('Asia/Kolkata', Date.UTC(2026, 0, 1))).toBe(5.5 * 3600);
    expect(utcOffsetSeconds('UTC', Date.UTC(2026, 0, 1))).toBe(0);
    expect(utcOffsetSeconds('Not/AZone', Date.UTC(2026, 0, 1))).toBeNull();
  });

  it("uses the selected city's time zone", () => {
    const snap = generateDemoSnapshot({ id: 'geo:1', name: 'New York', region: 'New York', latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' }, Date.UTC(2026, 0, 15, 12));
    expect(snap.timezone).toBe('America/New_York');
    expect(snap.utcOffsetSeconds).toBe(-5 * 3600);
    expect(snap.source).toBe('demo');
  });
});

describe('theme preference', () => {
  it('defaults to light and accepts only known values', () => {
    expect(parseTheme(null)).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('purple')).toBe('light');
  });
});
