/**
 * Live self-checks shown in the evaluation panel. They call the real engine in the
 * browser; results are computed, never stored or hard-coded.
 */
import { NWS_CHART_REFERENCE_CASES, REFERENCE_TOLERANCE_F } from '../data/referenceCases';
import { computeHeatIndex, fToC } from './risk/heatIndex';
import { categorize } from './risk/categories';
import { NO_ADJUSTMENT, runScenario } from './scenario';
import { assessHeat } from './risk/assess';
import type { HourlyPoint } from '../types/weather';

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

export function referenceChecks(): CheckResult[] {
  return NWS_CHART_REFERENCE_CASES.map((c) => {
    const got = computeHeatIndex(fToC(c.tempF), c.rh).valueF;
    const diff = Math.abs(got - c.expectedHiF);
    return {
      name: `${c.tempF} °F, ${c.rh} % RH`,
      pass: diff <= REFERENCE_TOLERANCE_F,
      detail: `engine ${got.toFixed(1)} °F, chart ${c.expectedHiF} °F, Δ ${diff.toFixed(1)}`,
    };
  });
}

export function boundaryChecks(): CheckResult[] {
  const cases: Array<[number, string]> = [
    [79.99, 'lower'],
    [80, 'caution'],
    [90, 'extreme_caution'],
    [103, 'danger'],
    [125, 'extreme_danger'],
  ];
  return cases.map(([f, expected]) => {
    const got = categorize(f).category;
    return { name: `${f} °F`, pass: got === expected, detail: `→ ${got}` };
  });
}

export function scenarioChecks(): CheckResult[] {
  const hour: HourlyPoint = {
    time: 0,
    temperatureC: 35,
    relativeHumidity: 50,
    apparentTemperatureC: null,
    windSpeedKmh: 10,
    uvIndex: null,
    precipitationProbability: null,
    isDay: true,
  };
  const zero = runScenario(hour, NO_ADJUSTMENT);
  const hotter = runScenario(hour, { temperatureDeltaC: 3, humidityDeltaPct: 0, windDeltaKmh: 0 });
  const wind = runScenario(hour, { temperatureDeltaC: 0, humidityDeltaPct: 0, windDeltaKmh: 15 });
  const invalid = runScenario({ ...hour, relativeHumidity: 90 }, { temperatureDeltaC: 0, humidityDeltaPct: 20, windDeltaKmh: 0 });
  const missing = assessHeat({ temperatureC: 35, relativeHumidity: null, timestamp: 0 });
  return [
    { name: 'No change reproduces forecast', pass: zero.ok && zero.heatIndexDeltaC === 0, detail: `Δ ${zero.heatIndexDeltaC}` },
    { name: '+3 °C raises heat index', pass: (hotter.heatIndexDeltaC ?? 0) > 3, detail: `Δ ${hotter.heatIndexDeltaC?.toFixed(2)} °C` },
    { name: 'Wind-only change leaves heat index unchanged', pass: wind.heatIndexDeltaC === 0, detail: `Δ ${wind.heatIndexDeltaC}` },
    { name: 'Humidity above 100 % is rejected', pass: !invalid.ok && invalid.scenario === null, detail: invalid.errors.join(', ') },
    { name: 'Missing humidity gives no category', pass: missing.category === 'unavailable', detail: missing.completeness },
  ];
}
