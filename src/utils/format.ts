/**
 * Display formatting. Numbers always use Western digits so charts, tables and
 * inputs stay consistent across English, Urdu and Sindhi.
 *
 * Every formatted value is wrapped in Unicode left-to-right isolate marks
 * (U+2066 … U+2069) so that "40.7 °C" or "1 PM" is not reordered to "C° 40.7"
 * or "PM 1" inside right-to-left Urdu/Sindhi sentences. The marks are invisible.
 */
const LRI = '\u2066';
const PDI = '\u2069';
export const ltr = (s: string): string => `${LRI}${s}${PDI}`;

function safeFormatter(options: Intl.DateTimeFormatOptions, timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  }
}

/** "3 PM" */
export function formatHour(unix: number, timeZone: string): string {
  return ltr(safeFormatter({ hour: 'numeric', hour12: true }, timeZone).format(new Date(unix * 1000)));
}

/** "3:15 PM" */
export function formatClock(unix: number, timeZone: string): string {
  return ltr(safeFormatter({ hour: 'numeric', minute: '2-digit', hour12: true }, timeZone).format(new Date(unix * 1000)));
}

/** "Tue, Oct 13, 3:15 PM" */
export function formatDateTime(unix: number, timeZone: string): string {
  return ltr(
    safeFormatter({ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }, timeZone).format(new Date(unix * 1000)),
  );
}

/** "Tue, Oct 13" from YYYY-MM-DD */
export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return ltr(safeFormatter({ weekday: 'short', month: 'short', day: 'numeric' }, 'UTC').format(d));
}

export function formatTemp(c: number | null | undefined, digits = 0): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return '—';
  return ltr(`${c.toFixed(digits)} °C`);
}

export function formatNumber(v: number | null | undefined, digits = 0, unit = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return ltr(`${v.toFixed(digits)}${unit ? ` ${unit}` : ''}`);
}

export function formatSigned(v: number, digits = 1, unit = ''): string {
  const s = v > 0 ? '+' : v < 0 ? '−' : '±';
  return ltr(`${s}${Math.abs(v).toFixed(digits)}${unit ? ` ${unit}` : ''}`);
}

/** Minutes since a timestamp in ms. */
export function minutesSince(ms: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - ms) / 60000));
}
