/**
 * What-If Simulator. Applies explicit adjustments to one forecast hour and re-runs
 * the SAME assessment engine. Results are always marked as simulated.
 *
 * Inputs are validated before they reach the formula: a scenario that pushes humidity
 * outside 0–100 % or temperature outside the engine's limits is rejected with a
 * reason, not clamped.
 *
 * Wind speed is shown and can be adjusted, but the NWS heat index does not use wind,
 * so a wind-only change cannot change the category. The interface says so.
 */
import type { HeatAssessment } from '../types/risk';
import type { HourlyPoint } from '../types/weather';
import { assessHeat } from './risk/assess';
import { isValidHumidity, isValidTemperatureC } from './risk/heatIndex';

export interface ScenarioAdjustments {
  temperatureDeltaC: number;
  humidityDeltaPct: number;
  windDeltaKmh: number;
}

export const NO_ADJUSTMENT: ScenarioAdjustments = { temperatureDeltaC: 0, humidityDeltaPct: 0, windDeltaKmh: 0 };

export const SCENARIO_LIMITS = {
  temperatureDeltaC: { min: -10, max: 10, step: 0.5 },
  humidityDeltaPct: { min: -40, max: 40, step: 1 },
  windDeltaKmh: { min: -30, max: 30, step: 1 },
} as const;

export interface ScenarioPreset {
  id: 'hotter2' | 'heatwave4' | 'humid_breeze' | 'dry_heat' | 'calm_air';
  adjustments: ScenarioAdjustments;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: 'hotter2', adjustments: { temperatureDeltaC: 2, humidityDeltaPct: 0, windDeltaKmh: 0 } },
  { id: 'heatwave4', adjustments: { temperatureDeltaC: 4, humidityDeltaPct: -5, windDeltaKmh: -5 } },
  { id: 'humid_breeze', adjustments: { temperatureDeltaC: -1, humidityDeltaPct: 20, windDeltaKmh: 10 } },
  { id: 'dry_heat', adjustments: { temperatureDeltaC: 3, humidityDeltaPct: -20, windDeltaKmh: 0 } },
  { id: 'calm_air', adjustments: { temperatureDeltaC: 0, humidityDeltaPct: 0, windDeltaKmh: -10 } },
];

export type ScenarioError =
  | 'adjustment_out_of_range'
  | 'base_missing_inputs'
  | 'scenario_temperature_out_of_range'
  | 'scenario_humidity_out_of_range'
  | 'scenario_wind_negative';

export interface ScenarioChange {
  field: 'temperatureC' | 'relativeHumidity' | 'windSpeedKmh';
  from: number | null;
  to: number | null;
}

export interface ScenarioResult {
  ok: boolean;
  errors: ScenarioError[];
  base: HeatAssessment;
  scenario: HeatAssessment | null;
  baseInputs: { temperatureC: number | null; relativeHumidity: number | null; windSpeedKmh: number | null };
  scenarioInputs: { temperatureC: number | null; relativeHumidity: number | null; windSpeedKmh: number | null };
  changes: ScenarioChange[];
  heatIndexDeltaC: number | null;
  categoryChanged: boolean;
  /** True when wind was the only modified input (it does not enter the indicator). */
  windOnlyChange: boolean;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

function within(v: number, l: { min: number; max: number }) {
  return Number.isFinite(v) && v >= l.min && v <= l.max;
}

export function runScenario(hour: HourlyPoint, adj: ScenarioAdjustments): ScenarioResult {
  const base = assessHeat({ temperatureC: hour.temperatureC, relativeHumidity: hour.relativeHumidity, timestamp: hour.time, isForecast: true });
  const baseInputs = { temperatureC: hour.temperatureC, relativeHumidity: hour.relativeHumidity, windSpeedKmh: hour.windSpeedKmh };
  const errors: ScenarioError[] = [];

  if (
    !within(adj.temperatureDeltaC, SCENARIO_LIMITS.temperatureDeltaC) ||
    !within(adj.humidityDeltaPct, SCENARIO_LIMITS.humidityDeltaPct) ||
    !within(adj.windDeltaKmh, SCENARIO_LIMITS.windDeltaKmh)
  ) {
    errors.push('adjustment_out_of_range');
  }
  if (base.status !== 'ok') errors.push('base_missing_inputs');

  const t = hour.temperatureC === null ? null : r1(hour.temperatureC + adj.temperatureDeltaC);
  const rh = hour.relativeHumidity === null ? null : r1(hour.relativeHumidity + adj.humidityDeltaPct);
  const wind = hour.windSpeedKmh === null ? null : r1(hour.windSpeedKmh + adj.windDeltaKmh);

  if (t !== null && !isValidTemperatureC(t)) errors.push('scenario_temperature_out_of_range');
  if (rh !== null && !isValidHumidity(rh)) errors.push('scenario_humidity_out_of_range');
  if (wind !== null && wind < 0) errors.push('scenario_wind_negative');

  const changes: ScenarioChange[] = [];
  if (adj.temperatureDeltaC !== 0) changes.push({ field: 'temperatureC', from: hour.temperatureC, to: t });
  if (adj.humidityDeltaPct !== 0) changes.push({ field: 'relativeHumidity', from: hour.relativeHumidity, to: rh });
  if (adj.windDeltaKmh !== 0) changes.push({ field: 'windSpeedKmh', from: hour.windSpeedKmh, to: wind });
  const windOnlyChange = changes.length === 1 && changes[0].field === 'windSpeedKmh';

  const scenarioInputs = { temperatureC: t, relativeHumidity: rh, windSpeedKmh: wind };
  if (errors.length > 0) {
    return { ok: false, errors, base, scenario: null, baseInputs, scenarioInputs, changes, heatIndexDeltaC: null, categoryChanged: false, windOnlyChange };
  }

  const scenario = assessHeat({ temperatureC: t, relativeHumidity: rh, timestamp: hour.time, isSimulated: true });
  const heatIndexDeltaC =
    scenario.indicator.valueC !== null && base.indicator.valueC !== null ? scenario.indicator.valueC - base.indicator.valueC : null;

  return {
    ok: true,
    errors,
    base,
    scenario,
    baseInputs,
    scenarioInputs,
    changes,
    heatIndexDeltaC,
    categoryChanged: scenario.category !== base.category,
    windOnlyChange,
  };
}
