export type ResourceType = 'water' | 'cooling' | 'assistance';

/**
 * sample            – illustrative entry shipped with the prototype; NOT a real facility
 * unverified_report – submitted by a user of this browser; not checked by anyone
 * verified          – confirmed by an accountable source (none exist in this prototype)
 */
export type VerificationStatus = 'sample' | 'unverified_report' | 'verified';

export interface CommunityResource {
  id: string;
  type: ResourceType;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  hours: string | null;
  hoursVerified: boolean;
  accessibility: string | null;
  verification: VerificationStatus;
  lastUpdated: string | null;
  /** Location (preset id) this entry belongs to. */
  areaId: string;
}

export interface OutdatedReport {
  resourceId: string;
  at: number;
  note: string;
}
