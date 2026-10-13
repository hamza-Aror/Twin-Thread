/**
 * SYNTHETIC demonstration dataset.
 *
 * Used ONLY when the user explicitly switches on demo mode (or opens the app with ?demo=1).
 * It is a smooth idealised hot, humid day (min ~26 °C around 03:00 local time, max ~41 °C
 * around 15:00, humidity moving the opposite way), placed in the selected city's time zone.
 * It is NOT a recorded observation or a forecast for any place, and the interface labels it
 * as such everywhere it appears.
 */
import type { HourlyPoint, WeatherLocation, WeatherSnapshot } from '../types/weather';
import { localDateString } from '../services/weather/normalize';

export const DEMO_TIMEZONE = 'Asia/Karachi';
export const DEMO_UTC_OFFSET = 5 * 3600;

const round1 = (x: number) => Math.round(x * 10) / 10;

/** UTC offset in seconds of an IANA zone at a given moment, or null if the zone is unknown. */
export function utcOffsetSeconds(timeZone: string, atMs: number): number | null {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(atMs))
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return null;
    if (part === 'GMT') return 0;
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60);
  } catch {
    return null;
  }
}

/** Local hour of day (0–23, fractional) for a unix time at a UTC offset. */
function localHour(unix: number, offset: number): number {
  return ((((unix + offset) % 86400) + 86400) % 86400) / 3600;
}

export function demoHour(unix: number, offset = DEMO_UTC_OFFSET): HourlyPoint {
  const h = localHour(unix, offset);
  const phase = Math.cos((2 * Math.PI * (h - 15)) / 24); // +1 at 15:00, -1 at 03:00
  const temperatureC = round1(33.5 + 7.5 * phase);
  const relativeHumidity = Math.round(52 - 20 * phase);
  const windSpeedKmh = round1(14 + 7 * Math.cos((2 * Math.PI * (h - 16)) / 24));
  const isDay = h >= 6 && h < 18.5;
  const uvIndex = isDay ? round1(Math.max(0, 10 * Math.sin((Math.PI * (h - 6)) / 12.5))) : 0;
  return {
    time: unix,
    temperatureC,
    relativeHumidity,
    apparentTemperatureC: null, // not modelled in the demo dataset
    windSpeedKmh,
    uvIndex,
    precipitationProbability: 0,
    isDay,
  };
}

export function generateDemoSnapshot(location: WeatherLocation, nowMs: number): WeatherSnapshot {
  const tzOffset = location.timezone ? utcOffsetSeconds(location.timezone, nowMs) : null;
  const timezone = tzOffset !== null && location.timezone ? location.timezone : DEMO_TIMEZONE;
  const offset = tzOffset ?? DEMO_UTC_OFFSET;
  const nowSec = Math.floor(nowMs / 1000);
  const hourStart = Math.floor(nowSec / 3600) * 3600;
  const hourly = Array.from({ length: 24 }, (_, i) => demoHour(hourStart + i * 3600, offset));
  const cur = demoHour(nowSec, offset);

  const dayStart = (offsetDays: number) => {
    const localMidnight = Math.floor((nowSec + offset) / 86400) * 86400 - offset;
    return localMidnight + offsetDays * 86400;
  };
  const daily = [0, 1].map((d) => {
    const start = dayStart(d);
    const hours = Array.from({ length: 24 }, (_, i) => demoHour(start + i * 3600, offset));
    const temps = hours.map((x) => x.temperatureC as number);
    return {
      date: localDateString(start, offset),
      tempMaxC: Math.max(...temps),
      tempMinC: Math.min(...temps),
      apparentMaxC: null,
      uvIndexMax: Math.max(...hours.map((x) => x.uvIndex as number)),
      sunrise: start + 6 * 3600,
      sunset: start + 18 * 3600 + 30 * 60,
    };
  });

  return {
    location,
    timezone,
    utcOffsetSeconds: offset,
    current: {
      time: nowSec,
      temperatureC: cur.temperatureC,
      relativeHumidity: cur.relativeHumidity,
      apparentTemperatureC: null,
      windSpeedKmh: cur.windSpeedKmh,
      isDay: cur.isDay,
      weatherCode: 0,
    },
    hourly,
    daily,
    fetchedAt: nowMs,
    source: 'demo',
    validation: { hourlyReceived: 24, hourlyAccepted: 24, valuesRejected: 0, issues: ['Synthetic demo dataset: no API validation performed'] },
  };
}
