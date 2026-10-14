import { describe, expect, it } from 'vitest';
import {
  OverpassError,
  RADIUS_M,
  buildOverpassQuery,
  classifyTags,
  clearPlacesCache,
  fetchNearbyPlaces,
  normalizeOverpass,
} from '../services/places/overpass';

const CENTRE = { latitude: 24.8607, longitude: 67.0011 };
const node = (id: number, tags: Record<string, string>, dLat = 0.001, dLon = 0.001) => ({ type: 'node', id, lat: CENTRE.latitude + dLat, lon: CENTRE.longitude + dLon, tags });
const way = (id: number, tags: Record<string, string>, dLat = 0.002, dLon = 0.002) => ({
  type: 'way',
  id,
  center: { lat: CENTRE.latitude + dLat, lon: CENTRE.longitude + dLon },
  tags,
});
const norm = (elements: unknown[]) => normalizeOverpass({ elements }, CENTRE, 'karachi', '2026-10-14');

describe('Overpass query', () => {
  it('searches around the selected coordinates, not a city name', () => {
    const q = buildOverpassQuery(31.5204, 74.3587);
    expect(q).toContain(`around:${RADIUS_M.water},31.52040,74.35870`);
    expect(q).toContain('"amenity"="drinking_water"');
    expect(q).toContain('"drinking_water"="yes"');
    expect(q).toContain('"fountain"="drinking"');
    expect(q).toContain('"leisure"="park"');
    expect(q).toContain('"tourism"="hotel"');
    expect(q).not.toMatch(/area\[name/);
  });
});

describe('conservative classification', () => {
  it('accepts explicit drinking-water tags', () => {
    expect(classifyTags({ amenity: 'drinking_water' })?.category).toBe('water');
    expect(classifyTags({ man_made: 'water_tap', drinking_water: 'yes' })?.category).toBe('water');
    expect(classifyTags({ amenity: 'fountain', fountain: 'drinking' })?.category).toBe('water');
  });

  it('excludes water explicitly marked not drinkable, private or disused', () => {
    expect(classifyTags({ amenity: 'drinking_water', drinking_water: 'no' })).toBeNull();
    expect(classifyTags({ amenity: 'drinking_water', 'drinking_water:legal': 'no' })).toBeNull();
    expect(classifyTags({ amenity: 'drinking_water', access: 'private' })).toBeNull();
    expect(classifyTags({ amenity: 'drinking_water', disused: 'yes' })).toBeNull();
    expect(classifyTags({ 'disused:amenity': 'drinking_water' })).toBeNull();
    expect(classifyTags({ 'abandoned:amenity': 'drinking_water', drinking_water: 'yes' })).toBeNull();
  });

  it('never assumes water from a place type', () => {
    expect(classifyTags({ amenity: 'fountain' })).toBeNull(); // decorative fountain
    expect(classifyTags({ leisure: 'park' })?.category).toBe('park');
    expect(classifyTags({ tourism: 'hotel' })?.category).toBe('indoor');
    expect(classifyTags({ shop: 'supermarket' })).toBeNull();
    expect(classifyTags({ amenity: 'place_of_worship' })).toBeNull();
  });

  it('parks are parks, never official cooling centres; private gardens are excluded', () => {
    expect(classifyTags({ leisure: 'park', name: 'Bagh Ibne Qasim' })).toEqual({ category: 'park', evidence: ['leisure=park'] });
    expect(classifyTags({ leisure: 'garden', name: 'Hill Park Garden' })?.category).toBe('park');
    expect(classifyTags({ leisure: 'garden' })).toBeNull(); // unnamed garden: often private
    expect(classifyTags({ leisure: 'garden', name: 'X', access: 'private' })).toBeNull();
    expect(classifyTags({ leisure: 'park', access: 'no' })).toBeNull();
  });
});

describe('Overpass response normalisation', () => {
  it('keeps name, coordinates, category, evidence, source and links; marks entries as mapped', () => {
    const [r] = norm([node(11, { amenity: 'drinking_water', name: 'Water cooler', opening_hours: '24/7', 'addr:street': 'MA Jinnah Rd', 'addr:city': 'Karachi' })]);
    expect(r).toMatchObject({
      id: 'osm:node/11',
      type: 'water',
      name: 'Water cooler',
      verification: 'mapped',
      source: 'openstreetmap',
      hours: '24/7',
      hoursVerified: false,
      address: 'MA Jinnah Rd, Karachi',
      osm: { type: 'node', id: 11, url: 'https://www.openstreetmap.org/node/11', evidence: ['amenity=drinking_water'] },
    });
    expect(r.latitude).toBeCloseTo(CENTRE.latitude + 0.001, 6);
  });

  it('uses the centre of areas, and leaves missing names empty rather than inventing them', () => {
    const [r] = norm([way(22, { leisure: 'park' })]);
    expect(r.latitude).toBeCloseTo(CENTRE.latitude + 0.002, 6);
    expect(r.name).toBeNull();
  });

  it('never produces an official verification from OpenStreetMap', () => {
    const list = norm([way(1, { leisure: 'park', name: 'P' }), node(2, { tourism: 'hotel', name: 'H' }), node(3, { amenity: 'drinking_water' })]);
    expect(list.every((r) => r.verification === 'mapped' && r.source === 'openstreetmap')).toBe(true);
    expect(list.some((r) => r.type === 'cooling')).toBe(false);
  });

  it('removes duplicates: same object twice, and the same named park mapped as point and area', () => {
    const list = norm([
      node(5, { amenity: 'drinking_water' }),
      node(5, { amenity: 'drinking_water' }),
      node(6, { leisure: 'park', name: 'Aziz Bhatti Park' }, 0.003, 0.003),
      way(7, { leisure: 'park', name: 'aziz bhatti park' }, 0.0032, 0.0031),
    ]);
    expect(list.map((r) => r.id)).toEqual(['osm:node/5', 'osm:way/7']);
  });

  it('sorts nearest first and skips malformed or unclassifiable elements', () => {
    const list = norm([
      node(1, { amenity: 'drinking_water' }, 0.02, 0.02),
      node(2, { amenity: 'drinking_water' }, 0.001, 0.0),
      { type: 'node', id: 3, lat: 'x', lon: 1, tags: { amenity: 'drinking_water' } },
      { type: 'area', id: 4, lat: 1, lon: 1, tags: { amenity: 'drinking_water' } },
      node(8, { shop: 'bakery' }),
      null,
    ]);
    expect(list.map((r) => r.id)).toEqual(['osm:node/2', 'osm:node/1']);
  });

  it('handles empty results and malformed or failed responses', () => {
    expect(norm([])).toEqual([]);
    expect(() => normalizeOverpass(null, CENTRE, 'k', 'd')).toThrow(OverpassError);
    expect(() => normalizeOverpass({ remark: 'bad' }, CENTRE, 'k', 'd')).toThrow(/bad/);
    expect(() => normalizeOverpass({ elements: [], remark: 'runtime error: Query timed out in "query" at line 3' }, CENTRE, 'k', 'd')).toThrow(OverpassError);
  });
});

describe('fetching', () => {
  const okBody = { elements: [node(1, { amenity: 'drinking_water' })] };
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('caches by location and shares in-flight requests', async () => {
    clearPlacesCache();
    window.localStorage.clear();
    let calls = 0;
    const impl = (async () => {
      calls++;
      return respond(200, okBody);
    }) as typeof fetch;
    const [a, b] = await Promise.all([fetchNearbyPlaces(24.8607, 67.0011, 'k', { fetchImpl: impl }), fetchNearbyPlaces(24.8607, 67.0011, 'k', { fetchImpl: impl })]);
    expect(calls).toBe(1);
    expect(a.places).toHaveLength(1);
    expect(b.places).toHaveLength(1);
    const c = await fetchNearbyPlaces(24.8607, 67.0011, 'k', { fetchImpl: impl });
    expect(c.fromCache).toBe(true);
    expect(calls).toBe(1);
    await fetchNearbyPlaces(31.52, 74.36, 'lahore', { fetchImpl: impl });
    expect(calls).toBe(2);
  });

  it('expires the cache after 12 hours', async () => {
    clearPlacesCache();
    window.localStorage.clear();
    let calls = 0;
    let now = 1_000_000;
    const impl = (async () => {
      calls++;
      return respond(200, okBody);
    }) as typeof fetch;
    await fetchNearbyPlaces(1, 1, 'k', { fetchImpl: impl, now: () => now });
    now += 13 * 3600 * 1000;
    await fetchNearbyPlaces(1, 1, 'k', { fetchImpl: impl, now: () => now });
    expect(calls).toBe(2);
  });

  it('falls back to the next server on rate limits', async () => {
    clearPlacesCache();
    window.localStorage.clear();
    const seen: string[] = [];
    const impl = (async (url: string) => {
      seen.push(url);
      return seen.length === 1 ? respond(429, {}) : respond(200, okBody);
    }) as unknown as typeof fetch;
    const r = await fetchNearbyPlaces(2, 2, 'k', { fetchImpl: impl, endpoints: ['https://a/api', 'https://b/api'] });
    expect(seen).toEqual(['https://a/api', 'https://b/api']);
    expect(r.endpoint).toBe('https://b/api');
  });

  it('reports network failure when every server fails', async () => {
    clearPlacesCache();
    window.localStorage.clear();
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(fetchNearbyPlaces(3, 3, 'k', { fetchImpl: down, endpoints: ['https://a', 'https://b'] })).rejects.toMatchObject({ kind: 'network' });
    const limited = (async () => respond(429, {})) as typeof fetch;
    await expect(fetchNearbyPlaces(4, 4, 'k', { fetchImpl: limited, endpoints: ['https://a'] })).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('times out slow requests', async () => {
    clearPlacesCache();
    window.localStorage.clear();
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    await expect(fetchNearbyPlaces(5, 5, 'k', { fetchImpl: hang, timeoutMs: 20, endpoints: ['https://a'] })).rejects.toMatchObject({ kind: 'timeout' });
  });
});
