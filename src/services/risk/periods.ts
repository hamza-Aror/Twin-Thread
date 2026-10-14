/** Groups consecutive elevated hours into periods. Shared by the chart highlight and the alert rules. */
import type { AssessedHour, RiskCategory } from '../../types/risk';
import { categoryRank } from './categories';

export interface ElevatedPeriod {
  startIndex: number;
  endIndex: number; // inclusive
  startTime: number;
  /** End of the last hour (unix seconds). */
  endTime: number;
  peakCategory: RiskCategory;
  peakHeatIndexC: number;
  hours: number;
}

export function findElevatedPeriods(hours: AssessedHour[], threshold: RiskCategory): ElevatedPeriod[] {
  const minRank = categoryRank(threshold);
  const periods: ElevatedPeriod[] = [];
  let current: ElevatedPeriod | null = null;

  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    const a = h.assessment;
    const elevated = a.status === 'ok' && a.rank >= minRank;
    if (elevated && a.category !== 'unavailable' && a.indicator.valueC !== null) {
      if (!current) {
        current = {
          startIndex: i,
          endIndex: i,
          startTime: h.hour.time,
          endTime: h.hour.time + 3600,
          peakCategory: a.category,
          peakHeatIndexC: a.indicator.valueC,
          hours: 1,
        };
      } else {
        current.endIndex = i;
        current.endTime = h.hour.time + 3600;
        current.hours += 1;
        if (a.rank > categoryRank(current.peakCategory)) current.peakCategory = a.category;
        current.peakHeatIndexC = Math.max(current.peakHeatIndexC, a.indicator.valueC);
      }
    } else if (current) {
      periods.push(current);
      current = null;
    }
  }
  if (current) periods.push(current);
  return periods;
}
