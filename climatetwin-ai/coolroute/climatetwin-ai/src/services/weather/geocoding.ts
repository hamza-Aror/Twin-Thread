/**
 * Worldwide place search using the Open-Meteo Geocoding API (same provider as the forecast).
 * Docs: https://open-meteo.com/en/docs/geocoding-api
 *
 * Real restrictions of the API, handled here rather than hidden:
 *  - 0–1 characters return nothing; 2 characters only match exact names; 3+ characters
 *    use fuzzy matching, so partial names like "Hyder" work.
 *  - It searches place names only. "Hyderabad, Pakistan" is not understood as one query,
 *    so we search "Hyderabad" and rank results whose region/country match "Pakistan" first.
 *  - Free tier: non-commercial use, no key, fair-use limits (about 10,000 calls a day).
 *
 * There is no artificial city list or limit: any place in the API's GeoNames-based database can be chosen.
 */
import type { WeatherLocation } from '../../types/weather';
import { makeCustomLocation, validateCoordinates } from '../../data/locations';

export const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
export const MAX_RESULTS = 10;
export const MIN_QUERY_LENGTH = 2;

export interface ParsedQuery {
  name: string;
  /** Text after the first comma, used to rank results by region or country. */
  qualifier: string | null;
  /** Set when the query is a "lat, lon" pair. */
  coordinates: { latitude: number; longitude: number } | null;
}

const COORD_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseQuery(raw: string): ParsedQuery {
  const text = raw.replace(/\s+/g, ' ').trim();
  const m = COORD_RE.exec(text);
  if (m) {
    const latitude = Number.parseFloat(m[1]);
    const longitude = Number.parseFloat(m[2]);
    if (validateCoordinates(latitude, longitude).ok) return { name: '', qualifier: null, coordinates: { latitude, longitude } };
  }
  const [name, ...rest] = text.split(',');
  const qualifier = rest.join(',').trim();
  return { name: name.trim(), qualifier: qualifier.length ? qualifier : null, coordinates: null };
}

export function buildGeocodingUrl(name: string, language = 'en'): string {
  const params = new URLSearchParams({ name, count: String(MAX_RESULTS), language, format: 'json' });
  return `${GEOCODING_ENDPOINT}?${params.toString()}`;
}

/** "Hyderabad, Sindh, Pakistan" style label, skipping missing or repeated parts. */
export function describeLocation(loc: Pick<WeatherLocation, 'name' | 'region' | 'country'>): string {
  const parts = [loc.name, loc.region, loc.country].filter((p): p is string => Boolean(p && p.trim()));
  return parts.filter((p, i) => parts.indexOf(p) === i).join(', ');
}

export class GeocodingError extends Error {
  readonly kind: 'network' | 'timeout' | 'http' | 'invalid_response';
  constructor(kind: GeocodingError['kind'], message: string) {
    super(message);
    this.name = 'GeocodingError';
    this.kind = kind;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Validates the raw API response and converts each result to a WeatherLocation. Invalid entries are skipped. */
export function normalizeGeocoding(raw: unknown): WeatherLocation[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new GeocodingError('invalid_response', 'Response is not a JSON object');
  const obj = raw as Record<string, unknown>;
  if (obj.error === true) throw new GeocodingError('http', String(obj.reason ?? 'Geocoding error'));
  // No "results" key means no matches — a valid, empty answer.
  if (obj.results === undefined) return [];
  if (!Array.isArray(obj.results)) throw new GeocodingError('invalid_response', '"results" is not a list');
  const out: WeatherLocation[] = [];
  for (const r of obj.results as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    const name = str(r.name);
    const lat = r.latitude;
    const lon = r.longitude;
    if (!name || typeof lat !== 'number' || typeof lon !== 'number' || !validateCoordinates(lat, lon).ok) continue;
    const id = typeof r.id === 'number' || typeof r.id === 'string' ? `geo:${r.id}` : `geo:${lat.toFixed(4)},${lon.toFixed(4)}`;
    out.push({
      id,
      name,
      region: str(r.admin1) ?? str(r.admin2) ?? '',
      country: str(r.country),
      countryCode: str(r.country_code),
      timezone: str(r.timezone),
      population: typeof r.population === 'number' ? r.population : undefined,
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
    });
  }
  return out;
}

/** Places whose region, country or country code match the qualifier come first; API order is kept otherwise. */
export function rankByQualifier(results: WeatherLocation[], qualifier: string | null): WeatherLocation[] {
  if (!qualifier) return results;
  const q = qualifier.toLowerCase();
  const score = (l: WeatherLocation) => {
    const fields = [l.region, l.country, l.countryCode].filter(Boolean).map((f) => (f as string).toLowerCase());
    return fields.some((f) => f === q) ? 2 : fields.some((f) => f.startsWith(q) || q.startsWith(f)) ? 1 : 0;
  };
  return results
    .map((l, i) => ({ l, i, s: score(l) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.l);
}

export interface SearchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  language?: string;
}

export type SearchOutcome =
  | { kind: 'too_short' }
  | { kind: 'coordinates'; location: WeatherLocation }
  | { kind: 'results'; locations: WeatherLocation[] };

export async function searchPlaces(query: string, opts: SearchOptions = {}): Promise<SearchOutcome> {
  const parsed = parseQuery(query);
  if (parsed.coordinates) return { kind: 'coordinates', location: makeCustomLocation(parsed.coordinates.latitude, parsed.coordinates.longitude) };
  if (parsed.name.length < MIN_QUERY_LENGTH) return { kind: 'too_short' };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? 8000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetchImpl(buildGeocodingUrl(parsed.name, opts.language), { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    if (timedOut) throw new GeocodingError('timeout', 'The location service did not respond in time.');
    throw new GeocodingError('network', 'Could not reach the location service.');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  if (!response.ok) throw new GeocodingError('http', `Location service returned HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new GeocodingError('invalid_response', 'Location service returned invalid JSON.');
  }
  return { kind: 'results', locations: rankByQualifier(normalizeGeocoding(json), parsed.qualifier) };
}
