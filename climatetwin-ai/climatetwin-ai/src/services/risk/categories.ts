/**
 * Risk categorisation layer (Phase B), kept separate from the indicator formula.
 *
 * Bands follow the NWS heat index chart classification of "likelihood of heat
 * disorders with prolonged exposure or strenuous activity":
 *   Caution 80–90 °F · Extreme Caution 90–103 °F · Danger 103–124 °F · Extreme Danger >= 125 °F
 * Source: https://www.weather.gov/ama/heatindex
 *
 * IMPORTANT: these are U.S. NWS reference bands used here for a prototype. They are
 * NOT Pakistan Meteorological Department (PMD) or NDMA warning thresholds, and this
 * app does not issue official warnings.
 *
 * Boundaries are compared in °F (the unit the bands are defined in) to avoid
 * rounding drift. Lower bound inclusive, upper bound exclusive.
 */
import type { AssessmentCategory, CategoryRule, RiskCategory } from '../../types/risk';

export const CATEGORY_ORDER: RiskCategory[] = ['lower', 'caution', 'extreme_caution', 'danger', 'extreme_danger'];

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'lower', minF: null, maxF: 80 },
  { category: 'caution', minF: 80, maxF: 90 },
  { category: 'extreme_caution', minF: 90, maxF: 103 },
  { category: 'danger', minF: 103, maxF: 125 },
  { category: 'extreme_danger', minF: 125, maxF: null },
];

export const CATEGORY_SOURCE = {
  name: 'U.S. National Weather Service heat index chart',
  url: 'https://www.weather.gov/ama/heatindex',
};

/** Hours at or above this category are highlighted as "elevated". */
export const DEFAULT_ELEVATED_CATEGORY: RiskCategory = 'extreme_caution';

export function categorize(heatIndexF: number): CategoryRule {
  if (!Number.isFinite(heatIndexF)) throw new RangeError('Heat index must be a finite number');
  for (const rule of CATEGORY_RULES) {
    const aboveMin = rule.minF === null || heatIndexF >= rule.minF;
    const belowMax = rule.maxF === null || heatIndexF < rule.maxF;
    if (aboveMin && belowMax) return rule;
  }
  // Unreachable: bands cover the whole number line.
  throw new RangeError(`No category for ${heatIndexF}`);
}

export function categoryRank(category: AssessmentCategory): number {
  return category === 'unavailable' ? -1 : CATEGORY_ORDER.indexOf(category);
}

export function isElevated(category: AssessmentCategory, threshold: RiskCategory = DEFAULT_ELEVATED_CATEGORY): boolean {
  return categoryRank(category) >= categoryRank(threshold);
}

/** Display colours shared by badges, chart, ribbon and alerts so categories look identical everywhere. */
export const CATEGORY_COLORS: Record<AssessmentCategory, string> = {
  lower: '#2BB3A3',
  caution: '#E8C547',
  extreme_caution: '#F0913A',
  danger: '#E5484D',
  extreme_danger: '#C02675',
  unavailable: '#64748B',
};
