import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { WeatherLocation } from '../types/weather';
import type { AssessedHour, HeatAssessment } from '../types/risk';
import { DEFAULT_LOCATION, PRESET_LOCATIONS } from '../data/locations';
import { assessHeat, assessHours } from '../services/risk/assess';
import { useWeather, type WeatherState } from './useWeather';
import { useAlertCenter, type AlertCenter } from './useAlertCenter';
import { type Route, useHashRoute } from './useHashRoute';
import { useI18n } from '../i18n';
import { readJSON, writeJSON } from '../utils/storage';
import { formatHour, formatTemp } from '../utils/format';
import type { HeatAlert } from '../services/alerts';

interface AppState {
  location: WeatherLocation;
  setLocation: (l: WeatherLocation) => void;
  demoMode: boolean;
  setDemoMode: (on: boolean) => void;
  weather: WeatherState;
  /** Every forecast hour run through the single assessment engine. */
  assessed: AssessedHour[];
  current: HeatAssessment | null;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  alerts: AlertCenter;
  route: Route;
  navigate: (r: Route) => void;
}

const Ctx = createContext<AppState | null>(null);
const LOCATION_KEY = 'ct:location';

function initialDemoMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
}

function initialLocation(): WeatherLocation {
  const saved = readJSON<WeatherLocation | null>(LOCATION_KEY, null);
  if (saved && typeof saved.latitude === 'number' && typeof saved.longitude === 'number' && typeof saved.id === 'string') {
    return PRESET_LOCATIONS.find((p) => p.id === saved.id) ?? saved;
  }
  return DEFAULT_LOCATION;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [location, setLocationState] = useState<WeatherLocation>(initialLocation);
  const [demoMode, setDemoMode] = useState<boolean>(initialDemoMode);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [route, navigate] = useHashRoute();
  const weather = useWeather(location, demoMode);

  const setLocation = useCallback((l: WeatherLocation) => {
    setLocationState(l);
    setSelectedIndex(0);
    writeJSON(LOCATION_KEY, l);
  }, []);

  const assessed = useMemo(() => (weather.snapshot ? assessHours(weather.snapshot.hourly) : []), [weather.snapshot]);
  const current = useMemo(() => {
    const c = weather.snapshot?.current;
    if (!c) return null;
    return assessHeat({ temperatureC: c.temperatureC, relativeHumidity: c.relativeHumidity, timestamp: c.time });
  }, [weather.snapshot]);

  const tz = weather.snapshot?.timezone ?? 'UTC';
  const placeName = weather.snapshot?.location.name ?? location.name;
  const formatMessage = useCallback(
    (a: HeatAlert) => ({
      title: t(a.ongoing ? 'alerts.ongoing' : 'alerts.upcoming', { category: t(`cat.${a.peakCategory}`) }),
      body:
        t('alerts.body', { start: formatHour(a.startTime, tz), end: formatHour(a.endTime, tz), place: placeName, hi: formatTemp(a.peakHeatIndexC) }) +
        (a.simulatedData ? ` (${t('alerts.demoTag')})` : ''),
    }),
    [t, tz, placeName],
  );
  const alerts = useAlertCenter(weather.snapshot, assessed, formatMessage);

  const safeIndex = Math.min(selectedIndex, Math.max(0, assessed.length - 1));
  const value: AppState = {
    location,
    setLocation,
    demoMode,
    setDemoMode,
    weather,
    assessed,
    current,
    selectedIndex: safeIndex,
    setSelectedIndex,
    alerts,
    route,
    navigate,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
