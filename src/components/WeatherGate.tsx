import type { ReactNode } from 'react';
import { CloudOff, LoaderCircle } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import type { WeatherSnapshot } from '../types/weather';
import { minutesSince } from '../utils/format';
import { Button, Notice } from './ui';

/**
 * Renders children only when there is data to show. Handles the three honest states:
 * loading, failed-with-cache (shown with a warning), and failed-without-data (explicit choice).
 */
export function WeatherGate({ children }: { children: (snap: WeatherSnapshot) => ReactNode }) {
  const { t } = useI18n();
  const { weather, location, setDemoMode } = useApp();
  const { snapshot, status, error } = weather;

  if (status === 'loading' && !snapshot) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted" role="status">
        <LoaderCircle className="animate-spin text-accent" size={28} aria-hidden />
        <p>{t('loading.weather', { place: location.name })}</p>
      </div>
    );
  }

  const errorText = error ? t(`error.${error.kind}`, { detail: error.status ? `HTTP ${error.status}` : error.message }) : '';

  if (!snapshot) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-line bg-panel px-6 py-10 text-center" role="alert">
        <CloudOff size={32} className="text-amber" aria-hidden />
        <h1 className="text-xl font-semibold">{t('error.title')}</h1>
        <p className="text-muted">{errorText}</p>
        <p className="text-sm text-faint">{t('error.noCache')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={weather.refresh}>
            {t('error.retry')}
          </Button>
          <Button onClick={() => setDemoMode(true)}>{t('error.useDemo')}</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'error' && error && (
        <div className="mb-5">
          <Notice tone="warn" role="alert">
            <strong className="font-semibold">{t('error.title')}.</strong> {errorText}{' '}
            {snapshot.source === 'cache' && t('error.showingCache', { n: minutesSince(snapshot.fetchedAt) })}{' '}
            <button type="button" onClick={weather.refresh} className="text-accent underline underline-offset-2">
              {t('error.retry')}
            </button>
          </Notice>
        </div>
      )}
      {children(snapshot)}
    </>
  );
}
