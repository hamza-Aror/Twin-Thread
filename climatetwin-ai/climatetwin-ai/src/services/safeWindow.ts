/**
 * Safe Window Finder — ranks contiguous forecast windows for an activity.
 *
 * No opaque score. Windows are compared lexicographically, criterion by criterion,
 * and the first criterion that differs decides the order:
 *   1. worst_category     – highest heat-index category inside the window (lower is better)
 *   2. hours_at_worst     – how many hours sit in that worst category (fewer is better)
 *   3. peak_heat_index    – highest heat index in the window, °C (lower is better)
 *   4. mean_heat_index    – average heat index in the window, °C (lower is better)
 *   5. peak_uv            – outdoor activities only: highest UV index (lower is better; unknown ranks last)
 *   6. start_time         – earlier start wins a full tie (deterministic)
 *
 * Windows containing any hour without a valid assessment are excluded, not guessed.
 * "Lower-risk" means "comparatively more favourable forecast", never "safe".
 */
import type { AssessedHour, RiskCategory } from '../types/risk';
import { CATEGORY_ORDER } from './risk/categories';

export type ActivitySetting = 'outdoor' | 'indoor';

export interface SafeWindowRequest {
  durationHours: number;
  /** Local hour (0–23) at which the preferred range starts. */
  preferredStartHour: number;
  /** Local hour (1–24) at which the preferred range ends (exclusive). If <= start, the range wraps past midnight. */
  preferredEndHour: number;
  setting: ActivitySetting;
  /** Optional fixed start (unix seconds of a forecast hour). */
  fixedStartTime?: number | null;
}

export type RankCriterion = 'worst_category' | 'hours_at_worst' | 'peak_heat_index' | 'mean_heat_index' | 'peak_uv' | 'start_time';

export interface WindowStats {
  startIndex: number;
  startTime: number;
  endTime: number;
  worstCategory: RiskCategory;
  worstRank: number;
  hoursAtWorst: number;
  peakHeatIndexC: number;
  meanHeatIndexC: number;
  peakUv: number | null;
  limitedConfidenceHours: number;
  inPreferredRange: boolean;
}

export interface CriterionComparison {
  criterion: RankCriterion;
  value: number | string | null;
  bestValue: number | string | null;
}

export interface RankedWindow extends WindowStats {
  position: number; // 1-based
  /** Why this window ranks below the top window (absent for the top window). */
  versusBest: CriterionComparison | null;
}

export type SafeWindowError = 'invalid_duration' | 'invalid_range' | 'duration_exceeds_range' | 'no_forecast' | 'no_feasible_window';

export interface SafeWindowResult {
  ok: boolean;
  error?: SafeWindowError;
  criteria: RankCriterion[];
  ranked: RankedWindow[];
  /** Windows inside the preferred range that were skipped because of missing/invalid data. */
  excludedForMissingData: number;
  fixed: { window: RankedWindow | null; error?: 'not_in_forecast' | 'incomplete_data' } | null;
}

const EPS = 0.05;

export function localHourOf(unixSeconds: number, utcOffsetSeconds: number): number {
  return Math.floor((((unixSeconds + utcOffsetSeconds) % 86400) + 86400) % 86400 / 3600);
}

export function hourInRange(hour: number, start: number, end: number): boolean {
  if (start === end) return true; // full day
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function criteriaFor(setting: ActivitySetting): RankCriterion[] {
  return setting === 'outdoor'
    ? ['worst_category', 'hours_at_worst', 'peak_heat_index', 'mean_heat_index', 'peak_uv', 'start_time']
    : ['worst_category', 'hours_at_worst', 'peak_heat_index', 'mean_heat_index', 'start_time'];
}

/** Returns stats, or null if any hour in the window lacks a valid assessment. */
export function windowStats(hours: AssessedHour[], startIndex: number, duration: number, inPreferredRange: boolean): WindowStats | null {
  const slice = hours.slice(startIndex, startIndex + duration);
  if (slice.length < duration) return null;
  let worstRank = -1;
  let peak = -Infinity;
  let sum = 0;
  let peakUv: number | null = -Infinity;
  let limited = 0;
  for (const { assessment: a, hour } of slice) {
    if (a.status !== 'ok' || a.indicator.valueC === null) return null;
    worstRank = Math.max(worstRank, a.rank);
    peak = Math.max(peak, a.indicator.valueC);
    sum += a.indicator.valueC;
    if (a.confidence === 'limited') limited++;
    if (hour.uvIndex === null || peakUv === null) peakUv = null;
    else peakUv = Math.max(peakUv, hour.uvIndex);
  }
  const hoursAtWorst = slice.filter((h) => h.assessment.rank === worstRank).length;
  return {
    startIndex,
    startTime: slice[0].hour.time,
    endTime: slice[slice.length - 1].hour.time + 3600,
    worstCategory: CATEGORY_ORDER[worstRank],
    worstRank,
    hoursAtWorst,
    peakHeatIndexC: peak,
    meanHeatIndexC: sum / slice.length,
    peakUv,
    limitedConfidenceHours: limited,
    inPreferredRange,
  };
}

function criterionValue(w: WindowStats, c: RankCriterion): number | string | null {
  switch (c) {
    case 'worst_category':
      return w.worstCategory;
    case 'hours_at_worst':
      return w.hoursAtWorst;
    case 'peak_heat_index':
      return w.peakHeatIndexC;
    case 'mean_heat_index':
      return w.meanHeatIndexC;
    case 'peak_uv':
      return w.peakUv;
    case 'start_time':
      return w.startTime;
  }
}

/** Negative if a ranks before b. Also reports which criterion decided. */
export function compareWindows(a: WindowStats, b: WindowStats, criteria: RankCriterion[]): { diff: number; criterion: RankCriterion | null } {
  for (const c of criteria) {
    let diff = 0;
    switch (c) {
      case 'worst_category':
        diff = a.worstRank - b.worstRank;
        break;
      case 'hours_at_worst':
        diff = a.hoursAtWorst - b.hoursAtWorst;
        break;
      case 'peak_heat_index':
        diff = Math.abs(a.peakHeatIndexC - b.peakHeatIndexC) < EPS ? 0 : a.peakHeatIndexC - b.peakHeatIndexC;
        break;
      case 'mean_heat_index':
        diff = Math.abs(a.meanHeatIndexC - b.meanHeatIndexC) < EPS ? 0 : a.meanHeatIndexC - b.meanHeatIndexC;
        break;
      case 'peak_uv':
        if (a.peakUv === null && b.peakUv === null) diff = 0;
        else if (a.peakUv === null) diff = 1;
        else if (b.peakUv === null) diff = -1;
        else diff = Math.abs(a.peakUv - b.peakUv) < EPS ? 0 : a.peakUv - b.peakUv;
        break;
      case 'start_time':
        diff = a.startTime - b.startTime;
        break;
    }
    if (diff !== 0) return { diff, criterion: c };
  }
  return { diff: 0, criterion: null };
}

export function validateRequest(req: SafeWindowRequest): SafeWindowError | null {
  const { durationHours: d, preferredStartHour: s, preferredEndHour: e } = req;
  if (!Number.isInteger(d) || d < 1 || d > 12) return 'invalid_duration';
  if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || s > 23 || e < 1 || e > 24) return 'invalid_range';
  const rangeLength = s === e % 24 ? 24 : (e - s + 24) % 24;
  if (d > rangeLength) return 'duration_exceeds_range';
  return null;
}

export function findSafeWindows(hours: AssessedHour[], req: SafeWindowRequest, utcOffsetSeconds: number): SafeWindowResult {
  const criteria = criteriaFor(req.setting);
  const empty: SafeWindowResult = { ok: false, criteria, ranked: [], excludedForMissingData: 0, fixed: null };
  const invalid = validateRequest(req);
  if (invalid) return { ...empty, error: invalid };
  if (hours.length === 0) return { ...empty, error: 'no_forecast' };

  const d = req.durationHours;
  const candidates: WindowStats[] = [];
  let excluded = 0;
  for (let i = 0; i + d <= hours.length; i++) {
    const allInRange = hours
      .slice(i, i + d)
      .every((h) => hourInRange(localHourOf(h.hour.time, utcOffsetSeconds), req.preferredStartHour, req.preferredEndHour % 24));
    if (!allInRange) continue;
    const stats = windowStats(hours, i, d, true);
    if (stats) candidates.push(stats);
    else excluded++;
  }

  candidates.sort((a, b) => compareWindows(a, b, criteria).diff);
  const best = candidates[0];
  const ranked: RankedWindow[] = candidates.map((w, idx) => {
    if (idx === 0) return { ...w, position: 1, versusBest: null };
    const { criterion } = compareWindows(w, best, criteria);
    return {
      ...w,
      position: idx + 1,
      versusBest: criterion ? { criterion, value: criterionValue(w, criterion), bestValue: criterionValue(best, criterion) } : null,
    };
  });

  let fixed: SafeWindowResult['fixed'] = null;
  if (req.fixedStartTime !== undefined && req.fixedStartTime !== null) {
    const idx = hours.findIndex((h) => h.hour.time === req.fixedStartTime);
    if (idx < 0 || idx + d > hours.length) fixed = { window: null, error: 'not_in_forecast' };
    else {
      const inRange = ranked.find((r) => r.startIndex === idx);
      if (inRange) fixed = { window: inRange };
      else {
        const stats = windowStats(hours, idx, d, false);
        if (!stats) fixed = { window: null, error: 'incomplete_data' };
        else if (!best) fixed = { window: { ...stats, position: 0, versusBest: null } };
        else {
          const { criterion } = compareWindows(stats, best, criteria);
          fixed = {
            window: {
              ...stats,
              position: 0,
              versusBest: criterion ? { criterion, value: criterionValue(stats, criterion), bestValue: criterionValue(best, criterion) } : null,
            },
          };
        }
      }
    }
  }

  if (ranked.length === 0) return { ...empty, error: 'no_feasible_window', excludedForMissingData: excluded, fixed };
  return { ok: true, criteria, ranked, excludedForMissingData: excluded, fixed };
}
