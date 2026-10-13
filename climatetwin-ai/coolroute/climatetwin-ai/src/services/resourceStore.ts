/**
 * Locally stored resource suggestions and "outdated" reports.
 * They stay in this browser only and are always marked unverified.
 */
import type { CommunityResource, OutdatedReport, ResourceType } from '../types/resources';
import { readJSON, writeJSON } from '../utils/storage';
import { validateCoordinates } from '../data/locations';

const SUGGESTIONS_KEY = 'ct:res:suggestions';
const REPORTS_KEY = 'ct:res:reports';

export interface SuggestionInput {
  type: ResourceType;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  hours: string;
  accessibility: string;
  areaId: string;
}

export type SuggestionError = 'name_required' | 'name_too_long' | 'text_too_long' | 'invalid_coordinates' | 'invalid_type';

export function validateSuggestion(input: SuggestionInput): SuggestionError[] {
  const errors: SuggestionError[] = [];
  const name = input.name.trim();
  if (!['water', 'cooling', 'assistance'].includes(input.type)) errors.push('invalid_type');
  if (name.length === 0) errors.push('name_required');
  if (name.length > 80) errors.push('name_too_long');
  if (input.description.length > 300 || input.hours.length > 80 || input.accessibility.length > 120) errors.push('text_too_long');
  if (!validateCoordinates(input.latitude, input.longitude).ok) errors.push('invalid_coordinates');
  return errors;
}

export function loadSuggestions(): CommunityResource[] {
  const list = readJSON<CommunityResource[]>(SUGGESTIONS_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && r.verification === 'unverified_report') : [];
}

export function addSuggestion(input: SuggestionInput, now = Date.now()): CommunityResource {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
  const resource: CommunityResource = {
    id: `report:${now.toString(36)}`,
    type: input.type,
    name: clean(input.name),
    description: clean(input.description) || null,
    latitude: Math.round(input.latitude * 10000) / 10000,
    longitude: Math.round(input.longitude * 10000) / 10000,
    hours: clean(input.hours) || null,
    hoursVerified: false,
    accessibility: clean(input.accessibility) || null,
    verification: 'unverified_report',
    lastUpdated: new Date(now).toISOString().slice(0, 10),
    areaId: input.areaId,
  };
  writeJSON(SUGGESTIONS_KEY, [...loadSuggestions(), resource]);
  return resource;
}

export function removeSuggestion(id: string): void {
  writeJSON(
    SUGGESTIONS_KEY,
    loadSuggestions().filter((r) => r.id !== id),
  );
}

export function loadReports(): OutdatedReport[] {
  const list = readJSON<OutdatedReport[]>(REPORTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addReport(resourceId: string, note: string, now = Date.now()): OutdatedReport {
  const report = { resourceId, at: now, note: note.trim().slice(0, 200) };
  writeJSON(REPORTS_KEY, [...loadReports(), report]);
  return report;
}
