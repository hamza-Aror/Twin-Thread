/**
 * Reference values read from the NWS heat index chart (https://www.weather.gov/ama/heatindex),
 * in °F. Used by unit tests AND by the in-app evaluation panel, which re-checks the live engine
 * against them in the browser. Tolerance reflects the regression's stated ±1.3 °F error plus
 * chart rounding.
 */
export interface ReferenceCase {
  tempF: number;
  rh: number;
  expectedHiF: number;
}

export const REFERENCE_TOLERANCE_F = 2;

export const NWS_CHART_REFERENCE_CASES: ReferenceCase[] = [
  { tempF: 80, rh: 40, expectedHiF: 80 },
  { tempF: 90, rh: 40, expectedHiF: 91 },
  { tempF: 90, rh: 50, expectedHiF: 95 },
  { tempF: 90, rh: 60, expectedHiF: 100 },
  { tempF: 90, rh: 70, expectedHiF: 105 },
  { tempF: 96, rh: 50, expectedHiF: 108 },
  { tempF: 100, rh: 40, expectedHiF: 109 },
  { tempF: 86, rh: 90, expectedHiF: 105 },
];
