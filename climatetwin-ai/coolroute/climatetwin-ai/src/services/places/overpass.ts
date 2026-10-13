/**
 * Real places near the selected location from OpenStreetMap, via the Overpass API.
 *
 * Classification is deliberately conservative (see classifyTags):
 *  - Drinking water ONLY with explicit evidence: amenity=drinking_water, drinking_water=yes or
 *    fountain=drinking. Anything tagged drinking_water=no (or :legal=no), access=private/no,
 *    or disused/abandoned is excluded. A park, hotel, shop or plain fountain is never assumed to have water.
 *  - Parks: leisure=park, or a NAMED leisure=garden that is not private. Shown as possible shaded rest
 *    areas, never as cooling centres.
 *  - Hotels: tourism=hotel, shown as POTENTIAL indoor options with access/AC/fees/hours unverified.
 *  - Official cooling centres: never inferred from OpenStreetMap. No official list is integrated.
 *
 * Network behaviour: one POST per location (not per render/keystroke), 25 s timeout, a fallback
 * Overpass server on rate limits / server errors / network failures, in-flight de-duplication, and a
 * 12-hour cache (memory + localStorage). Data © OpenStreetMap contributors, ODbL.
 */
import type { CommunityResource, ResourceType } from '../../types/resources';
import { distanceKm } from '../../data/resources';
import { readJSON, removeKey, writeJSON } from '../../utils/storage';

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** Search radii around the selected point (metres). Water points are sparse, so they get a wider radius. */
export const RADIUS_M = { water: 5000, park: 3000, indoor: 3000 } as const;
export const RESULT_LIMITS = { water: 200, park: 150, indoor: 100 } as const;
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 25_000;

export type PlaceCategory = Extract<ResourceType, 'water' | 'park' | 'indoor'>;

const f = (n: number) => n.toFixed(5);

/** Overpass QL query: three labelled result sets so each category gets its own result limit. */
export function buildOverpassQuery(lat: number, lon: number): string {
  const around = (r: number) => `(around:${r},${f(lat)},${f(lon)})`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  nwr${around(RADIUS_M.water)}["amenity"="drinking_water"];`,
    `  nwr${around(RADIUS_M.water)}["drinking_water"="yes"];`,
    `  nwr${around(RADIUS_M.water)}["fountain"="drinking"];`,
    ')->.water;',
    '(',
    `  nwr${around(RADIUS_M.park)}["leisure"="park"];`,
    `  nwr${around(RADIUS_M.park)}["leisure"="garden"]["name"];`,
    ')->.green;',
    `nwr${around(RADIUS_M.indoor)}["tourism"="hotel"]->.hotels;`,
    `.water out tags center qt ${RESULT_LIMITS.water};`,
    `.green out tags center qt ${RESULT_LIMITS.park};`,
    `.hotels out tags center qt ${RESULT_LIMITS.indoor};`,
  ].join('\n');
}

type Tags = Record<string, string>;

const LIFECYCLE_PREFIX = /^(disused|abandoned|demolished|removed|razed|was|destroyed|construction|proposed):/;

/** True if the object is marked as not in use (or not yet built). */
export function isInactive(tags: Tags): boolean {
  if (tags.disused === 'yes' || tags.abandoned === 'yes') return true;
  if (tags['construction'] || tags['proposed']) return true;
  return Object.keys(tags).some((k) => LIFECYCLE_PREFIX.test(k) && /amenity|leisure|tourism|man_made/.test(k));
}

const NOT_PUBLIC = new Set(['private', 'no']);

export interface Classification {
  category: PlaceCategory;
  evidence: string[];
}

/**
 * One category per object, in priority order water > indoor > park. Returns null when the tags do
 * not establish any supported category.
 */
export function classifyTags(tags: Tags): Classification | null {
  if (isInactive(tags)) return null;
  const notPublic = NOT_PUBLIC.has(tags.access ?? '');

  const notDrinkable = tags.drinking_water === 'no' || tags['drinking_water:legal'] === 'no';
  const waterEvidence: string[] = [];
  if (tags.amenity === 'drinking_water') waterEvidence.push('amenity=drinking_water');
  if (tags.drinking_water === 'yes') waterEvidence.push('drinking_water=yes');
  if (tags.fountain === 'drinking') waterEvidence.push('fountain=drinking');
  if (waterEvidence.length > 0 && !notDrinkable && !notPublic) return { category: 'water', evidence: waterEvidence };

  if (tags.tourism === 'hotel') return { category: 'indoor', evidence: ['tourism=hotel'] };

  if (!notPublic && tags.leisure === 'park') return { category: 'park', evidence: ['leisure=park'] };
  if (!notPublic && tags.leisure === 'garden' && tags.name && tags.garden !== 'private' && tags['garden:type'] !== 'residential') {
    return { category: 'park', evidence: ['leisure=garden'] };
  }
  return null;
}

/** "Street 12, Area, City" from addr:* tags, or null. */
export function addressFromTags(tags: Tags): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [tags['addr:full'] ?? street, tags['addr:suburb'], tags['addr:city']].filter((p) => p && p.trim());
  return parts.length ? parts.join(', ') : null;
}

export class OverpassError extends Error {
  readonly kind: 'rate_limited' | 'busy' | 'network' | 'timeout' | 'invalid_response';
  constructor(kind: OverpassError['kind'], message: string) {
    super(message);
    this.name = 'OverpassError';
    this.kind = kind;
  }
}

interface RawElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: unknown;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates the Overpass JSON and converts usable elements into resources, nearest first.
 * Invalid elements are skipped; duplicates (same OSM object, or the same named place mapped twice
 * within 100 m, e.g. as a node and an area) are merged.
 */
export function normalizeOverpass(raw: unknown, centre: { latitude: number; longitude: number }, areaId: string, fetchedAtIso: string): CommunityResource[] {
  if (typeof raw !== 'object' || raw === null) throw new OverpassError('invalid_response', 'Response is not a JSON object');
  const obj = raw as { elements?: unknown; remark?: unknown };
  if (!Array.isArray(obj.elements)) {
    throw new OverpassError('invalid_response', typeof obj.remark === 'string' ? obj.remark : 'Missing "elements" list');
  }
  // Overpass reports server-side timeouts/memory errors in "remark" with HTTP 200.
  if (typeof obj.remark === 'string' && /error|timed out|out of memory/i.test(obj.remark) && obj.elements.length === 0) {
    throw new OverpassError('busy', obj.remark);
  }

  const seenIds = new Set<string>();
  const out: CommunityResource[] = [];
  for (const el of obj.elements as RawElement[]) {
    if (!el || typeof el !== 'object') continue;
    const type = el.type;
    if (type !== 'node' && type !== 'way' && type !== 'relation') continue;
    if (!isNum(el.id)) continue;
    const lat = isNum(el.lat) ? el.lat : isNum(el.center?.lat) ? (el.center?.lat as number) : null;
    const lon = isNum(el.lon) ? el.lon : isNum(el.center?.lon) ? (el.center?.lon as number) : null;
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const tags: Tags = {};
    if (el.tags && typeof el.tags === 'object') {
      for (const [k, v] of Object.entries(el.tags as Record<string, unknown>)) if (typeof v === 'string') tags[k] = v;
    }
    const cls = classifyTags(tags);
    if (!cls) continue;
    const id = `osm:${type}/${el.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    out.push({
      id,
      type: cls.category,
      name: tags.name?.trim() || tags['name:en']?.trim() || null,
      description: null,
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lon * 1e6) / 1e6,
      hours: tags.opening_hours ?? null,
      hoursVerified: false,
      accessibility: tags.wheelchair ? `wheelchair=${tags.wheelchair}` : null,
      verification: 'mapped',
      source: 'openstreetmap',
      lastUpdated: fetchedAtIso,
      areaId,
      address: addressFromTags(tags),
      access: tags.access ?? null,
      osm: { type, id: el.id, url: `https://www.openstreetmap.org/${type}/${el.id}`, evidence: cls.evidence },
    });
  }

  // Merge the same named place mapped twice (node + area) in the same category.
  const kept: CommunityResource[] = [];
  for (const r of out) {
    const dup = r.name
      ? kept.find((k) => k.type === r.type && k.name?.toLowerCase() === r.name?.toLowerCase() && distanceKm(k.latitude, k.longitude, r.latitude, r.longitude) < 0.1)
      : undefined;
    if (dup) {
      // Prefer the area (way/relation) over a point: it is usually the more complete mapping.
      if (dup.osm?.type === 'node' && r.osm?.type !== 'node') kept[kept.indexOf(dup)] = r;
      continue;
    }
    kept.push(r);
  }
  return kept.sort(
    (a, b) => distanceKm(centre.latitude, centre.longitude, a.latitude, a.longitude) - distanceKm(centre.latitude, centre.longitude, b.latitude, b.longitude),
  );
}

// ---------------------------------------------------------------- fetching, cache, de-duplication

export interface PlacesResult {
  places: CommunityResource[];
  fetchedAt: number;
  fromCache: boolean;
  endpoint: string;
}

/** Cache key: coordinates rounded to ~100 m, so tiny differences share one request. */
export function placesKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

const memory = new Map<string, Omit<PlacesResult, 'fromCache'>>();
const inFlight = new Map<string, Promise<PlacesResult>>();
const STORAGE_PREFIX = 'ct:places:';
const STORAGE_INDEX = 'ct:places:index';
const MAX_STORED = 6;

function readCache(key: string, now: number): Omit<PlacesResult, 'fromCache'> | null {
  const hit = memory.get(key) ?? readJSON<Omit<PlacesResult, 'fromCache'> | null>(STORAGE_PREFIX + key, null);
  if (!hit || typeof hit.fetchedAt !== 'number' || !Array.isArray(hit.places)) return null;
  if (now - hit.fetchedAt > CACHE_TTL_MS) return null;
  memory.set(key, hit);
  return hit;
}

function writeCache(key: string, value: Omit<PlacesResult, 'fromCache'>): void {
  memory.set(key, value);
  const index = readJSON<string[]>(STORAGE_INDEX, []).filter((k) => k !== key);
  index.unshift(key);
  for (const old of index.slice(MAX_STORED)) removeKey(STORAGE_PREFIX + old);
  writeJSON(STORAGE_INDEX, index.slice(0, MAX_STORED));
  writeJSON(STORAGE_PREFIX + key, value);
}

/** For tests. */
export function clearPlacesCache(): void {
  memory.clear();
  inFlight.clear();
}

export interface FetchPlacesOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  endpoints?: string[];
  /** Skip the cache (manual retry). */
  force?: boolean;
}

async function postQuery(endpoint: string, query: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch {
    throw timedOut ? new OverpassError('timeout', 'The map data service did not respond in time.') : new OverpassError('network', 'Could not reach the map data service.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new OverpassError('rate_limited', 'The map data service is rate-limiting requests.');
  if (res.status >= 500) throw new OverpassError('busy', `The map data service is busy (HTTP ${res.status}).`);
  if (!res.ok) throw new OverpassError('invalid_response', `The map data service returned HTTP ${res.status}.`);
  try {
    return await res.json();
  } catch {
    throw new OverpassError('invalid_response', 'The map data service returned data that is not valid JSON.');
  }
}

/**
 * Places near a point. Cached for 12 hours; concurrent calls for the same point share one request;
 * on rate limits, busy servers or network errors the next Overpass server is tried.
 */
export function fetchNearbyPlaces(lat: number, lon: number, areaId: string, opts: FetchPlacesOptions = {}): Promise<PlacesResult> {
  const now = opts.now ?? Date.now;
  const key = placesKey(lat, lon);
  if (!opts.force) {
    const cached = readCache(key, now());
    if (cached) return Promise.resolve({ ...cached, fromCache: true });
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = (async (): Promise<PlacesResult> => {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const query = buildOverpassQuery(lat, lon);
    let lastError: OverpassError = new OverpassError('network', 'No map data server available.');
    for (const endpoint of opts.endpoints ?? OVERPASS_ENDPOINTS) {
      try {
        const raw = await postQuery(endpoint, query, fetchImpl, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
        const fetchedAt = now();
        const places = normalizeOverpass(raw, { latitude: lat, longitude: lon }, areaId, new Date(fetchedAt).toISOString().slice(0, 10));
        const value = { places, fetchedAt, endpoint };
        writeCache(key, value);
        return { ...value, fromCache: false };
      } catch (err) {
        lastError = err instanceof OverpassError ? err : new OverpassError('invalid_response', String(err));
        // A malformed answer will not improve on another server; anything else is worth one more try.
        if (lastError.kind === 'invalid_response') break;
      }
    }
    throw lastError;
  })();
  inFlight.set(key, run);
  run.then(
    () => inFlight.delete(key),
    () => inFlight.delete(key),
  );
  return run;
}
