import { describe, expect, it } from 'vitest';
import { computeHeatIndex, cToF, fToC } from '../services/risk/heatIndex';
import { CATEGORY_RULES, categorize, isElevated } from '../services/risk/categories';
import { assessHeat, assessHours } from '../services/risk/assess';
import { findElevatedPeriods } from '../services/risk/periods';
import { bandRangeC, explainAssessment } from '../services/risk/explain';
import { NWS_CHART_REFERENCE_CASES, REFERENCE_TOLERANCE_F } from '../data/referenceCases';
import type { HourlyPoint } from '../types/weather';

describe('heat index formula', () => {
  it.each(NWS_CHART_REFERENCE_CASES)('matches NWS chart at $tempF °F / $rh % (≈ $expectedHiF °F)', ({ tempF, rh, expectedHiF }) => {
    const { valueF } = computeHeatIndex(fToC(tempF), rh);
    expect(Math.abs(valueF - expectedHiF)).toBeLessThanOrEqual(REFERENCE_TOLERANCE_F);
  });

  it('uses the simple formula in mild conditions', () => {
    const r = computeHeatIndex(20, 50);
    expect(r.method).toBe('simple');
    expect(r.valueC).toBeGreaterThan(18);
    expect(r.valueC).toBeLessThan(22);
  });

  it('applies the low-humidity adjustment', () => {
    expect(computeHeatIndex(fToC(100), 10).method).toBe('rothfusz_low_rh_adjusted');
  });

  it('applies the high-humidity adjustment', () => {
    expect(computeHeatIndex(fToC(84), 90).method).toBe('rothfusz_high_rh_adjusted');
  });

  it('increases with humidity at a fixed hot temperature', () => {
    let prev = -Infinity;
    for (let rh = 40; rh <= 100; rh += 5) {
      const v = computeHeatIndex(35, rh).valueC;
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('rejects invalid inputs instead of returning a number', () => {
    expect(() => computeHeatIndex(Number.NaN, 50)).toThrow(RangeError);
    expect(() => computeHeatIndex(35, 120)).toThrow(RangeError);
    expect(() => computeHeatIndex(35, -1)).toThrow(RangeError);
    expect(() => computeHeatIndex(75, 50)).toThrow(RangeError);
  });

  it('converts units consistently', () => {
    expect(cToF(0)).toBe(32);
    expect(fToC(212)).toBeCloseTo(100, 10);
  });
});

describe('category boundaries (°F, lower bound inclusive)', () => {
  const cases: Array<[number, string]> = [
    [79.99, 'lower'],
    [80, 'caution'],
    [89.99, 'caution'],
    [90, 'extreme_caution'],
    [102.99, 'extreme_caution'],
    [103, 'danger'],
    [124.99, 'danger'],
    [125, 'extreme_danger'],
    [160, 'extreme_danger'],
    [-20, 'lower'],
  ];
  it.each(cases)('%f °F → %s', (f, cat) => {
    expect(categorize(f).category).toBe(cat);
  });

  it('bands are contiguous with no gaps or overlaps', () => {
    for (let i = 1; i < CATEGORY_RULES.length; i++) {
      expect(CATEGORY_RULES[i].minF).toBe(CATEGORY_RULES[i - 1].maxF);
    }
  });

  it('rejects non-finite values', () => {
    expect(() => categorize(Number.NaN)).toThrow();
  });

  it('elevated threshold defaults to extreme caution', () => {
    expect(isElevated('caution')).toBe(false);
    expect(isElevated('extreme_caution')).toBe(true);
    expect(isElevated('unavailable')).toBe(false);
  });
});

describe('assessHeat', () => {
  it('returns a complete documented assessment', () => {
    const a = assessHeat({ temperatureC: 37, relativeHumidity: 45, timestamp: 1000, isForecast: true });
    expect(a.status).toBe('ok');
    expect(a.indicator.name).toBe('Heat Index (NWS)');
    expect(a.indicator.valueC).not.toBeNull();
    expect(a.category).toBe('danger');
    expect(a.rule?.minF).toBe(103);
    expect(a.inputs).toEqual({ temperatureC: 37, relativeHumidity: 45 });
    expect(a.timestamp).toBe(1000);
    expect(a.completeness).toBe('complete');
    expect(a.notes).toContain('forecast_uncertainty');
    expect(a.notes).toContain('shade_assumption');
  });

  it('returns unavailable — not a guess — when humidity is missing', () => {
    const a = assessHeat({ temperatureC: 40, relativeHumidity: null, timestamp: 0 });
    expect(a.status).toBe('unavailable');
    expect(a.category).toBe('unavailable');
    expect(a.indicator.valueC).toBeNull();
    expect(a.completeness).toBe('missing_inputs');
    expect(a.notes).toContain('missing_humidity');
  });

  it('flags invalid inputs separately from missing ones', () => {
    const a = assessHeat({ temperatureC: 40, relativeHumidity: 140, timestamp: 0 });
    expect(a.completeness).toBe('invalid_inputs');
    expect(a.notes).toContain('invalid_humidity');
    expect(a.rank).toBe(-1);
  });

  it('marks dry extreme heat as extrapolated (limited confidence)', () => {
    const a = assessHeat({ temperatureC: 47, relativeHumidity: 15, timestamp: 0 });
    expect(a.status).toBe('ok');
    expect(a.confidence).toBe('limited');
    expect(a.notes).toContain('extrapolated_low_humidity');
    expect(a.notes).toContain('extrapolated_high_temperature');
  });

  it('is deterministic', () => {
    const x = assessHeat({ temperatureC: 36.4, relativeHumidity: 61, timestamp: 5 });
    const y = assessHeat({ temperatureC: 36.4, relativeHumidity: 61, timestamp: 5 });
    expect(x).toEqual(y);
  });
});

describe('elevated periods', () => {
  const mk = (i: number, t: number | null, rh: number | null): HourlyPoint => ({
    time: i * 3600,
    temperatureC: t,
    relativeHumidity: rh,
    apparentTemperatureC: null,
    windSpeedKmh: null,
    uvIndex: null,
    precipitationProbability: null,
    isDay: null,
  });

  it('groups consecutive elevated hours and splits on gaps', () => {
    const hours = assessHours([mk(0, 25, 50), mk(1, 36, 60), mk(2, 38, 60), mk(3, null, 60), mk(4, 37, 60), mk(5, 26, 40)]);
    const periods = findElevatedPeriods(hours, 'extreme_caution');
    expect(periods).toHaveLength(2);
    expect(periods[0].startIndex).toBe(1);
    expect(periods[0].endIndex).toBe(2);
    expect(periods[0].hours).toBe(2);
    expect(periods[0].endTime).toBe(3 * 3600);
    expect(periods[1].startIndex).toBe(4);
  });

  it('reports the peak category within a period', () => {
    // 33 °C / 50 % ≈ 36 °C HI (extreme caution); 37 °C / 45 % ≈ 43 °C HI (danger)
    const hours = assessHours([mk(0, 33, 50), mk(1, 37, 45)]);
    const [p] = findElevatedPeriods(hours, 'caution');
    expect(p.peakCategory).toBe('danger');
  });
});

describe('plain-language explanation', () => {
  it('names temperature, humidity effect, sun and band in order', () => {
    const a = assessHeat({ temperatureC: 37, relativeHumidity: 45, timestamp: 0 });
    const keys = explainAssessment(a, { uvIndex: 9, isDay: true }).map((r) => r.key);
    expect(keys).toEqual(['why.temp', 'why.humid', 'why.sun', 'why.band']);
  });

  it('describes dry air and night correctly', () => {
    const a = assessHeat({ temperatureC: 30, relativeHumidity: 20, timestamp: 0 });
    const reasons = explainAssessment(a, { uvIndex: 0, isDay: false });
    expect(reasons.map((r) => r.key)).toContain('why.night');
    expect(reasons.map((r) => r.key)).not.toContain('why.humid');
  });

  it('gives no reasons, rather than invented ones, when data is missing', () => {
    const a = assessHeat({ temperatureC: 37, relativeHumidity: null, timestamp: 0 });
    expect(explainAssessment(a, { uvIndex: 9, isDay: true })).toEqual([]);
  });

  it('shows band ranges in Celsius', () => {
    expect(bandRangeC({ category: 'danger', minF: 103, maxF: 125 })).toBe('39–52 °C');
    expect(bandRangeC({ category: 'lower', minF: null, maxF: 80 })).toBe('< 27 °C');
    expect(bandRangeC({ category: 'extreme_danger', minF: 125, maxF: null })).toBe('≥ 52 °C');
  });
});
