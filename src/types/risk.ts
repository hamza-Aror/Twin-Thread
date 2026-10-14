/** Heat index categories, ordered from lowest to highest concern. */
export type RiskCategory = 'lower' | 'caution' | 'extreme_caution' | 'danger' | 'extreme_danger';

export type AssessmentCategory = RiskCategory | 'unavailable';

export type HeatIndexMethod = 'simple' | 'rothfusz' | 'rothfusz_low_rh_adjusted' | 'rothfusz_high_rh_adjusted';

/** Machine-readable notes so the interface can translate them. */
export type AssessmentNoteCode =
  | 'missing_temperature'
  | 'missing_humidity'
  | 'invalid_temperature'
  | 'invalid_humidity'
  | 'extrapolated_low_humidity'
  | 'extrapolated_high_temperature'
  | 'shade_assumption'
  | 'forecast_uncertainty'
  | 'simulated';

export interface CategoryRule {
  category: RiskCategory;
  /** Inclusive lower bound in °F (heat index), or null for the lowest band. */
  minF: number | null;
  /** Exclusive upper bound in °F, or null for the highest band. */
  maxF: number | null;
}

export interface HeatAssessment {
  status: 'ok' | 'unavailable';
  indicator: {
    name: 'Heat Index (NWS)';
    valueC: number | null;
    valueF: number | null;
    method: HeatIndexMethod | null;
  };
  category: AssessmentCategory;
  /** Numeric rank: 0 = lower ... 4 = extreme danger, -1 = unavailable. */
  rank: number;
  inputs: { temperatureC: number | null; relativeHumidity: number | null };
  /** The band that determined the category. */
  rule: CategoryRule | null;
  timestamp: number;
  completeness: 'complete' | 'missing_inputs' | 'invalid_inputs';
  confidence: 'standard' | 'limited' | 'none';
  notes: AssessmentNoteCode[];
}

export interface AssessedHour {
  hour: import('./weather').HourlyPoint;
  assessment: HeatAssessment;
}
