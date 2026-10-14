import { RefreshCw } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { isStale } from '../services/weather/cache';
import { formatClock, minutesSince } from '../utils/format';

/** Shows at a glance whether the numbers on screen are live, cached or demo data, how old they are, and refreshes them. */
export function StatusIndicator() {
  const { t } = useI18n();
  const { weather } = useApp();
  const snap = weather.snapshot;
  const loading = weather.status === 'loading' || weather.status === 'refreshing';

  let label: string = t('status.error');
  let dot = 'bg-alert';
  if (weather.status === 'loading') {
    label = t('status.loading');
    dot = 'bg-faint';
  } else if (snap?.source === 'live') {
    label = t('status.live');
    dot = 'bg-teal';
  } else if (snap?.source === 'cache') {
    label = t('status.cache');
    dot = 'bg-amber';
  } else if (snap?.source === 'demo') {
    label = t('status.demo');
    dot = 'bg-accent';
  }
  const stale = snap ? isStale(snap) : false;

  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span className={`inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 text-xs ${snap?.source === 'demo' ? 'demo-hatch bg-panel' : 'bg-panel'}`}>
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="whitespace-nowrap font-medium text-fg">{label}</span>
        {snap && (
          <span className="num whitespace-nowrap text-faint">
            {snap.source === 'demo' ? formatClock(Math.floor(snap.fetchedAt / 1000), snap.timezone) : t('status.minutesAgo', { n: minutesSince(snap.fetchedAt) })}
          </span>
        )}
        {stale && <span className="whitespace-nowrap text-amber">{t('status.stale')}</span>}
      </span>
      <button
        type="button"
        onClick={weather.refresh}
        disabled={loading}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-muted transition-colors hover:bg-raised hover:text-fg disabled:opacity-50"
        aria-label={loading ? t('status.refreshing') : t('status.refresh')}
        title={t('status.refresh')}
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden />
      </button>
    </div>
  );
}
