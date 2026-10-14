/**
 * Official heatwave criteria (Pakistan), kept SEPARATE from CoolRoute's own heat-index assessment.
 *
 * CoolRoute's heat-exposure risk (services/risk) answers: "how heat-stressful is it right now?"
 * using air temperature + humidity (NWS heat index). It is the application's own estimate.
 *
 * This module answers a different question: "how would a published Pakistani heatwave framework
 * classify the forecast for this place?" It only uses frameworks whose criteria were verified from
 * the issuing body's own publication, and only inside that framework's geographical scope.
 * Because no official alert feed is integrated, every result is a RULE-BASED ESTIMATE made by
 * applying the published criteria to Open-Meteo's model forecast for the selected point. It is
 * never a live PMD alert, and PMD's own forecast or measurements may differ.
 *
 * Verified sources (checked 14 Oct 2026):
 *  - PMD Regional Meteorological Centre Punjab, "Heatwave update" bulletin page:
 *    https://rmc-punjab.pmd.gov.pk/heatwave-update
 *    Normal Day: forecast < 40 °C · Hot Day Alert: forecast 40–41.9 °C · Hot Day Warning: forecast ≥ 42 °C
 *    Heatwave Emergency: forecast ≥ 42 °C and minimum temperature ≥ 30 °C for 2 or more consecutive days,
 *    together with "significant levels of heat related illness and mortality reports".
 *    Thresholds "defined in collaboration with Heatwave Management Committee (HWMC)". Scope: Punjab province.
 *  - Karachi Heatwave Management Plan (2017), Commissioner Karachi; alerts issued by PMD, temperature at
 *    Jinnah International Airport:
 *    https://docc.sindh.gov.pk/files/DoCC/Documents/Karachi%20Heatwave%20Management%20Plan.pdf
 *    Hot Day Advisory (Yellow): forecast 40–41.9 °C · Hot Day Warning (Orange): forecast ≥ 42 °C
 *    Heatwave Emergency (Red): forecast ≥ 42 °C AND minimum temperature ≥ 30 °C for 2 or more days;
 *    an emergency should also be declared for sudden increases in heat-attributable illness/deaths.
 *    Scope: Karachi city.
 *
 * Checked and NOT usable as numeric criteria: NDMA Heatwave Guidelines 2026 (no thresholds) and
 * PDMA Sindh heatwave alerts (forecast anomalies only, no defined levels). For every other place
 * in Pakistan no framework is applied, and the interface says so.
 */
import type { DailySummary, WeatherLocation } from '../../types/weather';
import { distanceKm } from '../../data/resources';

export type FrameworkId = 'karachi_hwmp_2017' | 'pmd_rmc_punjab';
export type OfficialLevel = 'normal' | 'alert' | 'warning' | 'emergency' | 'unavailable';

export interface OfficialFramework {
  id: FrameworkId;
  /** Display names per level, exactly as the source uses them. */
  levelNames: Record<Exclude<OfficialLevel, 'unavailable'>, string>;
  sourceTitle: string;
  sourceUrl: string;
  issuer: string;
  scope: string;
  /**
   * temperature_only: the source defines the emergency level by temperature persistence (health
   *   reports can additionally trigger it) – Karachi plan.
   * temperature_and_health: the source lists health reports as part of the emergency criteria, so a
   *   forecast alone can never establish it – RMC Punjab.
   */
  emergencyRule: 'temperature_only' | 'temperature_and_health';
}

export const FRAMEWORKS: Record<FrameworkId, OfficialFramework> = {
  karachi_hwmp_2017: {
    id: 'karachi_hwmp_2017',
    levelNames: { normal: 'No alert level', alert: 'Hot Day Advisory (Yellow)', warning: 'Hot Day Warning (Orange)', emergency: 'Heatwave Emergency (Red)' },
    sourceTitle: 'Karachi Heatwave Management Plan (2017)',
    sourceUrl: 'https://docc.sindh.gov.pk/files/DoCC/Documents/Karachi%20Heatwave%20Management%20Plan.pdf',
    issuer: 'Commissioner Karachi; alerts issued by the Pakistan Meteorological Department',
    scope: 'Karachi city',
    emergencyRule: 'temperature_only',
  },
  pmd_rmc_punjab: {
    id: 'pmd_rmc_punjab',
    levelNames: { normal: 'Normal Day', alert: 'Hot Day Alert', warning: 'Hot Day Warning', emergency: 'Heatwave Emergency' },
    sourceTitle: 'PMD Regional Meteorological Centre Punjab: heatwave thresholds',
    sourceUrl: 'https://rmc-punjab.pmd.gov.pk/heatwave-update',
    issuer: 'Pakistan Meteorological Department, Regional Meteorological Centre Punjab (with the Heatwave Management Committee)',
    scope: 'Punjab province, Pakistan',
    emergencyRule: 'temperature_and_health',
  },
};

/** Published temperature thresholds shared by both frameworks (°C). */
export const THRESHOLDS = { alertMin: 40, warningMin: 42, emergencyNightMin: 30, emergencyConsecutiveDays: 2 } as const;

/** Karachi city centre and an approximate radius covering the city (the plan names the city, not a boundary). */
export const KARACHI_CENTRE = { latitude: 24.8607, longitude: 67.0011 };
export const KARACHI_RADIUS_KM = 35;

export type FrameworkSelection =
  | { kind: 'framework'; framework: OfficialFramework; match: 'city' | 'province' }
  | { kind: 'none'; reason: 'outside_pakistan' | 'no_framework_for_region' | 'region_unknown' };

function isPakistan(loc: WeatherLocation): boolean | null {
  if (loc.countryCode) return loc.countryCode.toUpperCase() === 'PK';
  if (loc.country) return /pakistan/i.test(loc.country);
  return null; // unknown (e.g. typed coordinates)
}

/**
 * Picks the framework that applies to a place. City-specific beats provincial. Never applies a
 * framework outside its published scope, and never treats the Punjab framework as national.
 */
export function selectFramework(loc: WeatherLocation): FrameworkSelection {
  const pk = isPakistan(loc);
  if (pk === false) return { kind: 'none', reason: 'outside_pakistan' };

  const nearKarachi = distanceKm(loc.latitude, loc.longitude, KARACHI_CENTRE.latitude, KARACHI_CENTRE.longitude) <= KARACHI_RADIUS_KM;
  if (nearKarachi) return { kind: 'framework', framework: FRAMEWORKS.karachi_hwmp_2017, match: 'city' };

  if (pk === null) return { kind: 'none', reason: 'region_unknown' };
  if (/punjab/i.test(loc.region ?? '')) return { kind: 'framework', framework: FRAMEWORKS.pmd_rmc_punjab, match: 'province' };
  return { kind: 'none', reason: 'no_framework_for_region' };
}

export interface OfficialDay {
  date: string;
  maxC: number | null;
  minC: number | null;
  level: OfficialLevel;
  /** True when this day is part of a run of ≥ 2 consecutive days with max ≥ 42 °C and min ≥ 30 °C. */
  emergencyTemperatureCriteria: boolean;
}

export interface OfficialEvaluation {
  framework: OfficialFramework;
  days: OfficialDay[];
  /** Highest level across the evaluated days (unavailable only if every day lacks data). */
  peak: OfficialLevel;
  /** Temperature part of the emergency criteria appears somewhere in the forecast. */
  emergencyTemperatureCriteriaMet: boolean;
  /** For RMC Punjab: the emergency level also needs health reports CoolRoute does not have. */
  emergencyNeedsHealthReports: boolean;
}

const RANK: Record<OfficialLevel, number> = { unavailable: -1, normal: 0, alert: 1, warning: 2, emergency: 3 };

/** Level from a single day's forecast maximum (Normal / Alert / Warning). */
export function levelForMax(maxC: number | null): Exclude<OfficialLevel, 'emergency'> {
  if (maxC === null || !Number.isFinite(maxC)) return 'unavailable';
  if (maxC >= THRESHOLDS.warningMin) return 'warning';
  if (maxC >= THRESHOLDS.alertMin) return 'alert';
  return 'normal';
}

/**
 * Applies a framework to daily forecasts (in date order). Uses only the forecast daily maximum and
 * minimum air temperature, exactly as the published criteria do; it never uses the heat index.
 */
export function evaluateFramework(framework: OfficialFramework, daily: DailySummary[]): OfficialEvaluation {
  const qualifies = daily.map(
    (d) => d.tempMaxC !== null && d.tempMinC !== null && d.tempMaxC >= THRESHOLDS.warningMin && d.tempMinC >= THRESHOLDS.emergencyNightMin,
  );
  // Mark every day that belongs to a run of >= 2 consecutive qualifying days.
  const inRun = qualifies.map(() => false);
  let i = 0;
  while (i < qualifies.length) {
    if (!qualifies[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < qualifies.length && qualifies[j + 1]) j++;
    if (j - i + 1 >= THRESHOLDS.emergencyConsecutiveDays) for (let k = i; k <= j; k++) inRun[k] = true;
    i = j + 1;
  }

  const days: OfficialDay[] = daily.map((d, idx) => {
    let level: OfficialLevel = levelForMax(d.tempMaxC);
    // Only the Karachi plan defines its emergency level by temperature persistence alone.
    if (inRun[idx] && framework.emergencyRule === 'temperature_only') level = 'emergency';
    return { date: d.date, maxC: d.tempMaxC, minC: d.tempMinC, level, emergencyTemperatureCriteria: inRun[idx] };
  });

  const peak = days.reduce<OfficialLevel>((p, d) => (RANK[d.level] > RANK[p] ? d.level : p), 'unavailable');
  const met = inRun.some(Boolean);
  return {
    framework,
    days,
    peak,
    emergencyTemperatureCriteriaMet: met,
    emergencyNeedsHealthReports: framework.emergencyRule === 'temperature_and_health',
  };
}
