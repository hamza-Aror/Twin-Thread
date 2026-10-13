import { describe, expect, it } from 'vitest';
import { assessHours } from '../services/risk/assess';
import { compareWindows, criteriaFor, findSafeWindows, hourInRange, localHourOf, validateRequest } from '../services/safeWindow';
import { NO_ADJUSTMENT, runScenario } from '../services/scenario';
import { DEFAULT_ALERT_PREFS, buildAlerts, pruneSeen, selectNewAlerts } from '../services/alerts';
import { generateDemoSnapshot } from '../data/demoWeather';
import { DEFAULT_LOCATION } from '../data/locations';
import type { HourlyPoint } from '../types/weather';
import { SAMPLE_RESOURCES, nearbyResources } from '../data/resources';

const OFFSET = 5 * 3600; // Pakistan time
/** Unix time of local midnight in Pakistan for a fixed day. */
const DAY0 = Math.floor(1_780_000_000 / 86400) * 86400 - OFFSET;

const hour = (localH: number, t: number | null, rh: number | null, uv: number | null = 0): HourlyPoint => ({
  time: DAY0 + localH * 3600,
  temperatureC: t,
  relativeHumidity: rh,
  apparentTemperatureC: null,
  windSpeedKmh: 10,
  uvIndex: uv,
  precipitationProbability: 0,
  isDay: localH >= 6 && localH < 18,
});

/** 24 hours: cool night/morning, hot afternoon. */
function day(): HourlyPoint[] {
  return Array.from({ length: 24 }, (_, h) => {
    const t = 26 + 12 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 14)); // 26 °C at night, 38 °C ~13:00
    const uv = h >= 6 && h < 18 ? 9 * Math.sin((Math.PI * (h - 6)) / 12) : 0;
    return hour(h, Math.round(t * 10) / 10, 50, Math.round(uv * 10) / 10);
  });
}

describe('safe window helpers', () => {
  it('computes local hour with the UTC offset', () => {
    expect(localHourOf(DAY0 + 7 * 3600, OFFSET)).toBe(7);
  });

  it('handles ranges that wrap midnight', () => {
    expect(hourInRange(23, 20, 6)).toBe(true);
    expect(hourInRange(3, 20, 6)).toBe(true);
    expect(hourInRange(12, 20, 6)).toBe(false);
    expect(hourInRange(12, 0, 0)).toBe(true);
  });

  it('validates requests', () => {
    expect(validateRequest({ durationHours: 0, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor' })).toBe('invalid_duration');
    expect(validateRequest({ durationHours: 2.5, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor' })).toBe('invalid_duration');
    expect(validateRequest({ durationHours: 2, preferredStartHour: 25, preferredEndHour: 20, setting: 'outdoor' })).toBe('invalid_range');
    expect(validateRequest({ durationHours: 5, preferredStartHour: 6, preferredEndHour: 9, setting: 'outdoor' })).toBe('duration_exceeds_range');
    expect(validateRequest({ durationHours: 3, preferredStartHour: 20, preferredEndHour: 6, setting: 'indoor' })).toBeNull();
  });

  it('only outdoor activities consider UV', () => {
    expect(criteriaFor('outdoor')).toContain('peak_uv');
    expect(criteriaFor('indoor')).not.toContain('peak_uv');
  });
});

describe('findSafeWindows', () => {
  const hours = assessHours(day());

  it('prefers the cooler early-morning window for a daytime outdoor task', () => {
    const r = findSafeWindows(hours, { durationHours: 2, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor' }, OFFSET);
    expect(r.ok).toBe(true);
    const best = r.ranked[0];
    expect(localHourOf(best.startTime, OFFSET)).toBe(6);
    expect(best.versusBest).toBeNull();
  });

  it('keeps every window inside the preferred range', () => {
    const r = findSafeWindows(hours, { durationHours: 3, preferredStartHour: 9, preferredEndHour: 17, setting: 'indoor' }, OFFSET);
    for (const w of r.ranked) {
      const s = localHourOf(w.startTime, OFFSET);
      expect(s).toBeGreaterThanOrEqual(9);
      expect(s + 3).toBeLessThanOrEqual(17);
    }
    expect(r.ranked).toHaveLength(6);
  });

  it('is ordered consistently with the documented comparator', () => {
    const r = findSafeWindows(hours, { durationHours: 2, preferredStartHour: 0, preferredEndHour: 24, setting: 'outdoor' }, OFFSET);
    for (let i = 1; i < r.ranked.length; i++) {
      expect(compareWindows(r.ranked[i - 1], r.ranked[i], r.criteria).diff).toBeLessThanOrEqual(0);
    }
  });

  it('explains why lower windows ranked lower', () => {
    const r = findSafeWindows(hours, { durationHours: 2, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor' }, OFFSET);
    const last = r.ranked[r.ranked.length - 1];
    expect(last.versusBest?.criterion).toBe('worst_category');
    expect(last.versusBest?.bestValue).toBe(r.ranked[0].worstCategory);
  });

  it('excludes windows with missing data rather than guessing', () => {
    const raw = day();
    raw[7] = { ...raw[7], relativeHumidity: null };
    const r = findSafeWindows(assessHours(raw), { durationHours: 2, preferredStartHour: 6, preferredEndHour: 10, setting: 'outdoor' }, OFFSET);
    // windows 6-8 and 7-9 both include hour 7; only 8-10 remains
    expect(r.excludedForMissingData).toBe(2);
    expect(r.ranked).toHaveLength(1);
    expect(localHourOf(r.ranked[0].startTime, OFFSET)).toBe(8);
  });

  it('reports no feasible window honestly', () => {
    const raw = day().map((h) => ({ ...h, temperatureC: null }));
    const r = findSafeWindows(assessHours(raw), { durationHours: 2, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor' }, OFFSET);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('no_feasible_window');
  });

  it('evaluates a fixed start time against the best window', () => {
    const fixed = DAY0 + 13 * 3600;
    const r = findSafeWindows(
      hours,
      { durationHours: 2, preferredStartHour: 6, preferredEndHour: 20, setting: 'outdoor', fixedStartTime: fixed },
      OFFSET,
    );
    expect(r.fixed?.window?.startTime).toBe(fixed);
    expect(r.fixed?.window?.position).toBeGreaterThan(1);
    expect(r.fixed?.window?.versusBest).not.toBeNull();
  });
});

describe('runScenario', () => {
  const base = hour(14, 35, 50);

  it('zero adjustment reproduces the forecast assessment', () => {
    const r = runScenario(base, NO_ADJUSTMENT);
    expect(r.ok).toBe(true);
    expect(r.scenario?.indicator.valueC).toBeCloseTo(r.base.indicator.valueC as number, 10);
    expect(r.categoryChanged).toBe(false);
    expect(r.changes).toHaveLength(0);
  });

  it('a hotter scenario raises the heat index and records the change', () => {
    const r = runScenario(base, { temperatureDeltaC: 5, humidityDeltaPct: 0, windDeltaKmh: 0 });
    expect(r.heatIndexDeltaC as number).toBeGreaterThan(5);
    expect(r.changes).toEqual([{ field: 'temperatureC', from: 35, to: 40 }]);
    expect(r.scenario?.notes).toContain('simulated');
    expect(r.categoryChanged).toBe(true);
  });

  it('a wind-only change does not alter the heat index', () => {
    const r = runScenario(base, { temperatureDeltaC: 0, humidityDeltaPct: 0, windDeltaKmh: 10 });
    expect(r.windOnlyChange).toBe(true);
    expect(r.heatIndexDeltaC).toBe(0);
  });

  it('rejects scenarios that push humidity outside 0–100 %', () => {
    const r = runScenario(hour(3, 28, 85), { temperatureDeltaC: 0, humidityDeltaPct: 30, windDeltaKmh: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('scenario_humidity_out_of_range');
    expect(r.scenario).toBeNull();
  });

  it('rejects out-of-range adjustments and negative wind', () => {
    expect(runScenario(base, { temperatureDeltaC: 25, humidityDeltaPct: 0, windDeltaKmh: 0 }).errors).toContain('adjustment_out_of_range');
    expect(runScenario(base, { temperatureDeltaC: 0, humidityDeltaPct: 0, windDeltaKmh: -30 }).errors).toContain('scenario_wind_negative');
  });

  it('refuses to simulate when the base hour lacks inputs', () => {
    const r = runScenario(hour(14, 35, null), { temperatureDeltaC: 1, humidityDeltaPct: 0, windDeltaKmh: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('base_missing_inputs');
  });
});

describe('alerts', () => {
  const hours = assessHours(day());
  const now = DAY0 + 8 * 3600;

  it('raises one alert per elevated period within the look-ahead', () => {
    const alerts = buildAlerts(hours, DEFAULT_ALERT_PREFS, 'karachi', now, false);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    for (const a of alerts) {
      expect(a.startTime).toBeLessThan(now + 12 * 3600);
      expect(['extreme_caution', 'danger', 'extreme_danger']).toContain(a.peakCategory);
    }
  });

  it('produces no alerts when disabled', () => {
    expect(buildAlerts(hours, { ...DEFAULT_ALERT_PREFS, enabled: false }, 'karachi', now, false)).toHaveLength(0);
  });

  it('prevents duplicates and expires old records', () => {
    const alerts = buildAlerts(hours, DEFAULT_ALERT_PREFS, 'karachi', now, false);
    const seen = alerts.map((a) => ({ id: a.id, at: 0 }));
    expect(selectNewAlerts(alerts, seen)).toHaveLength(0);
    expect(selectNewAlerts(alerts, [])).toHaveLength(alerts.length);
    expect(pruneSeen(seen, 49 * 3600 * 1000)).toHaveLength(0);
  });

  it('keeps demo-data alerts separate from live ones', () => {
    const live = buildAlerts(hours, DEFAULT_ALERT_PREFS, 'karachi', now, false);
    const demo = buildAlerts(hours, DEFAULT_ALERT_PREFS, 'karachi', now, true);
    expect(demo[0].id).not.toBe(live[0].id);
    expect(demo[0].simulatedData).toBe(true);
  });

  it('the demo dataset produces elevated afternoon hours', () => {
    const snap = generateDemoSnapshot(DEFAULT_LOCATION, (DAY0 + 6 * 3600) * 1000);
    const assessed = assessHours(snap.hourly);
    expect(assessed.some((h) => h.assessment.rank >= 3)).toBe(true);
    expect(assessed.some((h) => h.assessment.rank <= 1)).toBe(true);
  });
});

describe('resources follow the selected city', () => {
  const all = { water: true, cooling: true, assistance: true };
  it('lists Karachi samples for Karachi and nothing for a far-away city', () => {
    expect(nearbyResources(SAMPLE_RESOURCES, { latitude: 24.8607, longitude: 67.0011 }, all, true).length).toBe(5);
    expect(nearbyResources(SAMPLE_RESOURCES, { latitude: 51.5, longitude: -0.12 }, all, true)).toEqual([]);
  });

  it('applies type filters and sorts by distance', () => {
    const list = nearbyResources(SAMPLE_RESOURCES, { latitude: 24.8607, longitude: 67.0011 }, { water: true, cooling: false, assistance: false }, true);
    expect(list.every((x) => x.r.type === 'water')).toBe(true);
    expect(list[0].km).toBeLessThanOrEqual(list[list.length - 1].km);
  });
});
