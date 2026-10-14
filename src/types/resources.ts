/**
 * Resource categories. Each one claims only what its evidence supports.
 *
 * water      – drinking water. From OpenStreetMap only with explicit drinking-water tags.
 * park       – park or green space; a POTENTIAL shaded rest area, never a cooling centre.
 * indoor     – hotel; a POTENTIAL indoor option (air conditioning, entry, fees and hours unverified).
 * cooling    – cooling space. "Official cooling centre" only when verification === 'official';
 *              otherwise it is a user's unverified suggestion.
 * assistance – community assistance (user suggestions only).
 */
export type ResourceType = 'water' | 'park' | 'indoor' | 'cooling' | 'assistance';

/**
 * sample            – DEMO entry shipped with the prototype; NOT a real place (demo mode only)
 * unverified_report – submitted by a user of this browser; not checked by anyone
 * mapped            – exists on OpenStreetMap with the stated tags; not checked by CoolRoute
 * official          – listed by an official source as a cooling/heat-relief facility (none integrated yet)
 */
export type VerificationStatus = 'sample' | 'unverified_report' | 'mapped' | 'official';

export type ResourceSource = 'demo' | 'user_report' | 'openstreetmap' | 'official';

export interface OsmReference {
  type: 'node' | 'way' | 'relation';
  id: number;
  /** Link to the object on openstreetmap.org. */
  url: string;
  /** The tags that justified the category (e.g. amenity=drinking_water). */
  evidence: string[];
}

export interface CommunityResource {
  id: string;
  type: ResourceType;
  /** null when the mapped object has no name; the interface shows "Unnamed …". */
  name: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  /** Opening hours as written by the source (never verified). */
  hours: string | null;
  hoursVerified: boolean;
  accessibility: string | null;
  verification: VerificationStatus;
  source: ResourceSource;
  lastUpdated: string | null;
  /** Location (preset id) the entry was added for. */
  areaId: string;
  address?: string | null;
  /** Mapped access tag, e.g. "yes", "customers". */
  access?: string | null;
  osm?: OsmReference;
}

export interface OutdatedReport {
  resourceId: string;
  at: number;
  note: string;
}
