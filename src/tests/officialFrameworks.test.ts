import { describe, expect, it } from 'vitest';
import { FRAMEWORKS, evaluateFramework, levelForMax, selectFramework } from '../services/official/heatwaveFrameworks';
import { assessHeat } from '../services/risk/assess';
import { PRESET_LOCATIONS, makeCustomLocation } from '../data/locations';
import type { DailySummary, WeatherLocation } from '../types/weather';

const preset = (id: string) => PRESET_LOCATIONS.find((p) => p.id === id) as WeatherLocation;
const geo = (over: Partial<WeatherLocation>): WeatherLocation => ({ id: 'geo:x', name: 'X', region: '', latitude: 0, longitude: 0, ...over });
const day = (date: string, max: number | null, min: number | null): DailySummary => ({
  date,
  tempMaxC: max,
  tempMinC: min,
  apparentMaxC: null,
  uvIndexMax: null,
  sunrise: null,
  sunset: null,
});

describe('framework selection by place', () => {
  it('Karachi uses the city-specific Karachi plan', () => {
    const s = selectFramework(preset('karachi'));
    expect(s).toMatchObject({ kind: 'framework', match: 'city', framework: { id: 'karachi_hwmp_2017' } });
  });

  it('a searched place inside Karachi (e.g. Korangi) also uses the Karachi plan', () => {
    const s = selectFramework(geo({ name: 'Korangi', region: 'Sindh', countryCode: 'PK', latitude: 24.83, longitude: 67.13 }));
    expect(s.kind === 'framework' && s.framework.id).toBe('karachi_hwmp_2017');
  });

  it('places in Pakistan’s Punjab use the RMC Punjab framework', () => {
    expect(selectFramework(preset('lahore'))).toMatchObject({ kind: 'framework', match: 'province', framework: { id: 'pmd_rmc_punjab' } });
    expect(selectFramework(preset('multan'))).toMatchObject({ framework: { id: 'pmd_rmc_punjab' } });
    expect(selectFramework(geo({ name: 'Bahawalpur', region: 'Punjab', countryCode: 'PK', latitude: 29.4, longitude: 71.68 }))).toMatchObject({ framework: { id: 'pmd_rmc_punjab' } });
  });

  it('never applies the Punjab framework to India’s Punjab', () => {
    expect(selectFramework(geo({ name: 'Amritsar', region: 'Punjab', countryCode: 'IN', latitude: 31.63, longitude: 74.87 }))).toEqual({ kind: 'none', reason: 'outside_pakistan' });
  });

  it('does not treat the Punjab framework as national', () => {
    expect(selectFramework(preset('hyderabad-sindh'))).toEqual({ kind: 'none', reason: 'no_framework_for_region' });
    expect(selectFramework(preset('jacobabad'))).toEqual({ kind: 'none', reason: 'no_framework_for_region' });
    expect(selectFramework(preset('islamabad'))).toEqual({ kind: 'none', reason: 'no_framework_for_region' });
    expect(selectFramework(geo({ name: 'Peshawar', region: 'Khyber Pakhtunkhwa', countryCode: 'PK', latitude: 34.0, longitude: 71.57 }))).toMatchObject({ kind: 'none' });
  });

  it('typed coordinates: Karachi by distance, otherwise the region is unknown', () => {
    expect(selectFramework(makeCustomLocation(24.9, 67.05))).toMatchObject({ framework: { id: 'karachi_hwmp_2017' } });
    expect(selectFramework(makeCustomLocation(31.52, 74.36))).toEqual({ kind: 'none', reason: 'region_unknown' });
  });

  it('places outside Pakistan get no Pakistani framework', () => {
    expect(selectFramework(geo({ name: 'London', region: 'England', countryCode: 'GB', latitude: 51.5, longitude: -0.12 }))).toEqual({ kind: 'none', reason: 'outside_pakistan' });
  });
});

describe('published temperature thresholds', () => {
  it.each([
    [39.9, 'normal'],
    [40, 'alert'],
    [41.9, 'alert'],
    [42, 'warning'],
    [47, 'warning'],
    [null, 'unavailable'],
  ] as const)('daily max %s °C → %s', (max, level) => {
    expect(levelForMax(max)).toBe(level);
  });
});

describe('emergency criteria', () => {
  const hot = [day('2026-06-01', 43, 31), day('2026-06-02', 44, 30.5), day('2026-06-03', 41, 29)];

  it('Karachi plan: 2+ consecutive days ≥ 42 °C with minimum ≥ 30 °C reach the Red level by temperature', () => {
    const e = evaluateFramework(FRAMEWORKS.karachi_hwmp_2017, hot);
    expect(e.days.map((d) => d.level)).toEqual(['emergency', 'emergency', 'alert']);
    expect(e.peak).toBe('emergency');
    expect(e.emergencyNeedsHealthReports).toBe(false);
  });

  it('RMC Punjab: temperature alone never produces the emergency level', () => {
    const e = evaluateFramework(FRAMEWORKS.pmd_rmc_punjab, hot);
    expect(e.days.map((d) => d.level)).toEqual(['warning', 'warning', 'alert']);
    expect(e.peak).toBe('warning');
    expect(e.emergencyTemperatureCriteriaMet).toBe(true);
    expect(e.emergencyNeedsHealthReports).toBe(true);
  });

  it('a single hot day, or hot days with cooler nights, is not an emergency', () => {
    const one = evaluateFramework(FRAMEWORKS.karachi_hwmp_2017, [day('a', 43, 31), day('b', 39, 28)]);
    expect(one.emergencyTemperatureCriteriaMet).toBe(false);
    expect(one.peak).toBe('warning');
    const coolNights = evaluateFramework(FRAMEWORKS.karachi_hwmp_2017, [day('a', 45, 29), day('b', 45, 29.9)]);
    expect(coolNights.emergencyTemperatureCriteriaMet).toBe(false);
  });

  it('a gap breaks the consecutive run', () => {
    const e = evaluateFramework(FRAMEWORKS.karachi_hwmp_2017, [day('a', 43, 31), day('b', 41, 31), day('c', 43, 31)]);
    expect(e.emergencyTemperatureCriteriaMet).toBe(false);
  });

  it('missing data is reported as unavailable, not guessed', () => {
    const e = evaluateFramework(FRAMEWORKS.pmd_rmc_punjab, [day('a', null, null)]);
    expect(e.peak).toBe('unavailable');
    expect(e.days[0].level).toBe('unavailable');
  });
});

describe('application risk vs official criteria', () => {
  it('a humid 37 °C day can be "Danger" by heat index while official criteria say Normal Day', () => {
    const app = assessHeat({ temperatureC: 37, relativeHumidity: 55, timestamp: 0 });
    const official = evaluateFramework(FRAMEWORKS.pmd_rmc_punjab, [day('a', 37, 28)]);
    expect(app.category).toBe('danger');
    expect(official.peak).toBe('normal');
  });

  it('a dry 41 °C day can be an official Hot Day Alert while the heat index is close to air temperature', () => {
    const app = assessHeat({ temperatureC: 41, relativeHumidity: 12, timestamp: 0 });
    const official = evaluateFramework(FRAMEWORKS.pmd_rmc_punjab, [day('a', 41, 27)]);
    expect(official.peak).toBe('alert');
    expect(Math.abs((app.indicator.valueC as number) - 41)).toBeLessThan(3);
  });
});
