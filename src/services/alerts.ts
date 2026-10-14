/**
 * Alert rules. An alert is raised for each upcoming period (within the look-ahead)
 * where the hourly heat-index category reaches the user's threshold.
 *
 * Duplicate prevention: an alert's id is location + period start + peak category,
 * so the same period is announced once, but an escalation (e.g. Danger → Extreme
 * Danger) produces a new alert.
 */
import type { AssessedHour, RiskCategory } from '../types/risk';
import { findElevatedPeriods } from './risk/periods';

export interface AlertPrefs {
  enabled: boolean;
  threshold: RiskCategory;
  lookaheadHours: 6 | 12 | 24;
  browserNotifications: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  enabled: true,
  threshold: 'extreme_caution',
  lookaheadHours: 12,
  browserNotifications: false,
};

export interface HeatAlert {
  id: string;
  locationId: string;
  startTime: number;
  endTime: number;
  peakCategory: RiskCategory;
  peakHeatIndexC: number;
  hours: number;
  /** True if the period has already started. */
  ongoing: boolean;
  createdAt: number;
  simulatedData: boolean;
}

export function buildAlerts(
  hours: AssessedHour[],
  prefs: AlertPrefs,
  locationId: string,
  nowSeconds: number,
  isDemoData: boolean,
): HeatAlert[] {
  if (!prefs.enabled || hours.length === 0) return [];
  const horizon = nowSeconds + prefs.lookaheadHours * 3600;
  const inWindow = hours.filter((h) => h.hour.time + 3600 > nowSeconds && h.hour.time < horizon);
  const prefix = isDemoData ? 'demo:' : '';
  return findElevatedPeriods(inWindow, prefs.threshold).map((p) => ({
    id: `${prefix}${locationId}|${p.startTime}|${p.peakCategory}`,
    locationId,
    startTime: p.startTime,
    endTime: p.endTime,
    peakCategory: p.peakCategory,
    peakHeatIndexC: p.peakHeatIndexC,
    hours: p.hours,
    ongoing: p.startTime <= nowSeconds,
    createdAt: nowSeconds * 1000,
    simulatedData: isDemoData,
  }));
}

export interface SeenAlert {
  id: string;
  at: number;
}

/** Alerts not yet announced. */
export function selectNewAlerts(alerts: HeatAlert[], seen: SeenAlert[]): HeatAlert[] {
  const ids = new Set(seen.map((s) => s.id));
  return alerts.filter((a) => !ids.has(a.id));
}

/** Forget announcements older than 48 h so storage does not grow forever. */
export function pruneSeen(seen: SeenAlert[], nowMs: number, maxAgeMs = 48 * 3600 * 1000): SeenAlert[] {
  return seen.filter((s) => nowMs - s.at <= maxAgeMs);
}
