/**
 * The single assessment entry point used by every feature (dashboard, chart,
 * safe-window finder, simulator, alerts). Pure and deterministic.
 */
import type { AssessedHour, AssessmentNoteCode, HeatAssessment } from '../../types/risk';
import type { HourlyPoint } from '../../types/weather';
import { categorize, categoryRank } from './categories';
import { NWS_CHART_RANGE, computeHeatIndex, cToF, isValidHumidity, isValidTemperatureC } from './heatIndex';

export interface AssessInput {
  temperatureC: number | null | undefined;
  relativeHumidity: number | null | undefined;
  timestamp: number;
  /** Adds the forecast-uncertainty note. */
  isForecast?: boolean;
  /** Marks a What-If scenario result. */
  isSimulated?: boolean;
}

export function assessHeat(input: AssessInput): HeatAssessment {
  const { temperatureC, relativeHumidity, timestamp } = input;
  const notes: AssessmentNoteCode[] = [];
  const t = temperatureC ?? null;
  const rh = relativeHumidity ?? null;

  if (t === null) notes.push('missing_temperature');
  else if (!isValidTemperatureC(t)) notes.push('invalid_temperature');
  if (rh === null) notes.push('missing_humidity');
  else if (!isValidHumidity(rh)) notes.push('invalid_humidity');

  if (notes.length > 0) {
    const missing = t === null || rh === null;
    return {
      status: 'unavailable',
      indicator: { name: 'Heat Index (NWS)', valueC: null, valueF: null, method: null },
      category: 'unavailable',
      rank: -1,
      inputs: { temperatureC: t, relativeHumidity: rh },
      rule: null,
      timestamp,
      completeness: missing ? 'missing_inputs' : 'invalid_inputs',
      confidence: 'none',
      notes: input.isSimulated ? [...notes, 'simulated'] : notes,
    };
  }

  // Both values validated above.
  const temp = t as number;
  const hum = rh as number;
  const hi = computeHeatIndex(temp, hum);
  const rule = categorize(hi.valueF);

  let confidence: HeatAssessment['confidence'] = 'standard';
  const tempF = cToF(temp);
  if (hi.method !== 'simple') {
    if (hum < NWS_CHART_RANGE.minRh) {
      notes.push('extrapolated_low_humidity');
      confidence = 'limited';
    }
    if (tempF > NWS_CHART_RANGE.maxTempF) {
      notes.push('extrapolated_high_temperature');
      confidence = 'limited';
    }
  }
  notes.push('shade_assumption');
  if (input.isForecast) notes.push('forecast_uncertainty');
  if (input.isSimulated) notes.push('simulated');

  return {
    status: 'ok',
    indicator: { name: 'Heat Index (NWS)', valueC: hi.valueC, valueF: hi.valueF, method: hi.method },
    category: rule.category,
    rank: categoryRank(rule.category),
    inputs: { temperatureC: temp, relativeHumidity: hum },
    rule,
    timestamp,
    completeness: 'complete',
    confidence,
    notes,
  };
}

export function assessHour(hour: HourlyPoint, isForecast = true): HeatAssessment {
  return assessHeat({
    temperatureC: hour.temperatureC,
    relativeHumidity: hour.relativeHumidity,
    timestamp: hour.time,
    isForecast,
  });
}

export function assessHours(hours: HourlyPoint[]): AssessedHour[] {
  return hours.map((hour) => ({ hour, assessment: assessHour(hour) }));
}
