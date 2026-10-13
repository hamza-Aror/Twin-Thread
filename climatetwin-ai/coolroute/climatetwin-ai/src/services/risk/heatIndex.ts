/**
 * Heat Index (apparent temperature from air temperature + relative humidity)
 * as implemented by the U.S. National Weather Service.
 *
 * Source: NWS Weather Prediction Center, "The Heat Index Equation"
 *   https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 *
 * Algorithm (all in °F):
 *  1. Steadman's simple formula: HI = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094)
 *  2. If the average of that result and T is >= 80 °F, use the Rothfusz regression instead.
 *  3. Rothfusz adjustments:
 *     - RH < 13 % and 80 <= T <= 112 °F: subtract ((13 - RH) / 4) * sqrt((17 - |T - 95|) / 17)
 *     - RH > 85 % and 80 <= T <= 87 °F:  add ((RH - 85) / 10) * ((87 - T) / 5)
 *
 * The Rothfusz regression has a stated error of about ±1.3 °F against Steadman's
 * tables inside their range. It assumes shade and light wind; NWS notes direct
 * sunshine can raise the effective value by up to 15 °F. Wind is NOT an input.
 */
import type { HeatIndexMethod } from '../../types/risk';

export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;

/** Physically plausible input bounds. Values outside are rejected, never clamped. */
export const INPUT_LIMITS = {
  temperatureC: { min: -60, max: 60 },
  relativeHumidity: { min: 0, max: 100 },
} as const;

/**
 * Range covered by the official NWS heat index chart (80–110 °F air temperature,
 * 40–100 % RH). Values computed outside it are flagged as extrapolated.
 */
export const NWS_CHART_RANGE = { minTempF: 80, maxTempF: 110, minRh: 40 } as const;

export interface HeatIndexResult {
  valueF: number;
  valueC: number;
  method: HeatIndexMethod;
}

export function isValidTemperatureC(t: unknown): t is number {
  return typeof t === 'number' && Number.isFinite(t) && t >= INPUT_LIMITS.temperatureC.min && t <= INPUT_LIMITS.temperatureC.max;
}

export function isValidHumidity(rh: unknown): rh is number {
  return typeof rh === 'number' && Number.isFinite(rh) && rh >= INPUT_LIMITS.relativeHumidity.min && rh <= INPUT_LIMITS.relativeHumidity.max;
}

/**
 * Pure function. Throws RangeError for invalid inputs so a bad value can never
 * silently produce a number. Callers (assessHeat) check validity first.
 */
export function computeHeatIndex(temperatureC: number, relativeHumidity: number): HeatIndexResult {
  if (!isValidTemperatureC(temperatureC)) throw new RangeError(`Invalid temperature: ${temperatureC}`);
  if (!isValidHumidity(relativeHumidity)) throw new RangeError(`Invalid relative humidity: ${relativeHumidity}`);

  const T = cToF(temperatureC);
  const RH = relativeHumidity;

  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) {
    return { valueF: simple, valueC: fToC(simple), method: 'simple' };
  }

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;

  let method: HeatIndexMethod = 'rothfusz';
  if (RH < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    method = 'rothfusz_low_rh_adjusted';
  } else if (RH > 85 && T >= 80 && T <= 87) {
    hi += ((RH - 85) / 10) * ((87 - T) / 5);
    method = 'rothfusz_high_rh_adjusted';
  }

  return { valueF: hi, valueC: fToC(hi), method };
}
