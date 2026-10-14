import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssessedHour } from '../types/risk';
import type { WeatherSnapshot } from '../types/weather';
import { type AlertPrefs, DEFAULT_ALERT_PREFS, type HeatAlert, type SeenAlert, buildAlerts, pruneSeen, selectNewAlerts } from '../services/alerts';
import { showBrowserNotification } from '../services/notifications';
import { readJSON, writeJSON } from '../utils/storage';

const PREFS_KEY = 'ct:alerts:prefs';
const SEEN_KEY = 'ct:alerts:seen';
const HISTORY_KEY = 'ct:alerts:history';

export interface AnnouncedAlert extends HeatAlert {
  announcedAt: number;
  notified: boolean;
}

export interface AlertCenter {
  prefs: AlertPrefs;
  setPrefs: (p: AlertPrefs) => void;
  alerts: HeatAlert[];
  visible: HeatAlert[];
  dismiss: (id: string) => void;
  history: AnnouncedAlert[];
}

/**
 * Builds alerts from the assessed forecast, announces new ones once (in-app history,
 * plus a browser notification if the user allowed it), and remembers what was announced.
 */
export function useAlertCenter(
  snapshot: WeatherSnapshot | null,
  assessed: AssessedHour[],
  formatMessage: (a: HeatAlert) => { title: string; body: string },
): AlertCenter {
  const [prefs, setPrefsState] = useState<AlertPrefs>(() => ({ ...DEFAULT_ALERT_PREFS, ...readJSON<Partial<AlertPrefs>>(PREFS_KEY, {}) }));
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [history, setHistory] = useState<AnnouncedAlert[]>(() => readJSON<AnnouncedAlert[]>(HISTORY_KEY, []));

  const setPrefs = useCallback((p: AlertPrefs) => {
    setPrefsState(p);
    writeJSON(PREFS_KEY, p);
  }, []);

  const alerts = useMemo(() => {
    if (!snapshot) return [];
    return buildAlerts(assessed, prefs, snapshot.location.id, Math.floor(Date.now() / 1000), snapshot.source === 'demo');
    // `Date.now()` is sampled when the forecast or preferences change.
  }, [snapshot, assessed, prefs]);

  useEffect(() => {
    if (alerts.length === 0) return;
    const now = Date.now();
    const seen = pruneSeen(readJSON<SeenAlert[]>(SEEN_KEY, []), now);
    const fresh = selectNewAlerts(alerts, seen);
    if (fresh.length === 0) return;
    const announced: AnnouncedAlert[] = fresh.map((a) => {
      let notified = false;
      if (prefs.browserNotifications) {
        const { title, body } = formatMessage(a);
        notified = showBrowserNotification(title, body, a.id);
      }
      return { ...a, announcedAt: now, notified };
    });
    writeJSON(SEEN_KEY, [...seen, ...fresh.map((a) => ({ id: a.id, at: now }))]);
    setHistory((h) => {
      const next = [...announced, ...h].slice(0, 20);
      writeJSON(HISTORY_KEY, next);
      return next;
    });
  }, [alerts, prefs.browserNotifications, formatMessage]);

  const dismiss = useCallback((id: string) => setDismissed((d) => [...d, id]), []);
  const visible = useMemo(() => alerts.filter((a) => !dismissed.includes(a.id)), [alerts, dismissed]);

  return { prefs, setPrefs, alerts, visible, dismiss, history };
}
