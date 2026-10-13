/** Where the weather numbers on screen came from. */
export type DataSource = 'live' | 'cache' | 'demo';

export interface WeatherLocation {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  /** True for user-entered coordinates rather than a preset city. */
  custom?: boolean;
}

/** One forecast hour. Values that were missing or failed validation are null, never guessed. */
export interface HourlyPoint {
  /** Start of the hour, unix seconds (UTC). */
  time: number;
  temperatureC: number | null;
  relativeHumidity: number | null;
  apparentTemperatureC: number | null;
  windSpeedKmh: number | null;
  uvIndex: number | null;
  precipitationProbability: number | null;
  isDay: boolean | null;
}

/** Model "current" conditions reported by Open-Meteo (a 15-minute nowcast, not a station observation). */
export interface CurrentConditions {
  time: number;
  temperatureC: number | null;
  relativeHumidity: number | null;
  apparentTemperatureC: number | null;
  windSpeedKmh: number | null;
  isDay: boolean | null;
  weatherCode: number | null;
}

export interface DailySummary {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  apparentMaxC: number | null;
  uvIndexMax: number | null;
  sunrise: number | null;
  sunset: number | null;
}

export interface ValidationReport {
  hourlyReceived: number;
  hourlyAccepted: number;
  /** Individual values set to null because they were missing, non-numeric or physically implausible. */
  valuesRejected: number;
  issues: string[];
}

export interface WeatherSnapshot {
  location: WeatherLocation;
  /** IANA time zone used for display, e.g. Asia/Karachi. */
  timezone: string;
  utcOffsetSeconds: number;
  current: CurrentConditions;
  /** Next 24 hours starting with the hour that contains the current time. */
  hourly: HourlyPoint[];
  daily: DailySummary[];
  /** When this data was retrieved (ms since epoch). */
  fetchedAt: number;
  source: DataSource;
  validation: ValidationReport;
}

export type WeatherErrorKind = 'timeout' | 'network' | 'http' | 'invalid_response' | 'invalid_location';

export interface WeatherError {
  kind: WeatherErrorKind;
  message: string;
  status?: number;
}

export interface RequestLogEntry {
  at: number;
  ok: boolean;
  durationMs: number;
  detail: string;
  locationName: string;
}
