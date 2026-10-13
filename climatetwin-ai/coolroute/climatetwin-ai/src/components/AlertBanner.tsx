import { TriangleAlert, X } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { CATEGORY_COLORS, CATEGORY_INK, tint } from '../services/risk/categories';
import { formatHour, formatTemp } from '../utils/format';

/** In-app alert banner. Shown on every page except the dashboard (which has an alerts card) and the alerts page. */
export function AlertBanner() {
  const { t } = useI18n();
  const { alerts, weather, route, navigate } = useApp();
  const snap = weather.snapshot;
  if (!snap || route === 'alerts' || route === 'dashboard' || alerts.visible.length === 0) return null;
  const a = alerts.visible[0];
  const color = CATEGORY_COLORS[a.peakCategory];
  const more = alerts.visible.length - 1;

  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: tint(color, 45), backgroundColor: tint(color, 8) }}>
      <TriangleAlert size={20} aria-hidden style={{ color: CATEGORY_INK[a.peakCategory] }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">
          {t(a.ongoing ? 'alerts.ongoing' : 'alerts.upcoming', { category: t(`cat.${a.peakCategory}`) })}
          {a.simulatedData && <span className="ms-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">{t('alerts.demoTag')}</span>}
        </p>
        <p className="text-sm text-muted">
          {t('alerts.body', { start: formatHour(a.startTime, snap.timezone), end: formatHour(a.endTime, snap.timezone), place: snap.location.name, hi: formatTemp(a.peakHeatIndexC) })}
          {more > 0 && ` (+${more})`}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => navigate('outlook')}>
            {t('alerts.view')}
          </button>
          <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => navigate('alerts')}>
            {t('nav.alerts')}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => alerts.dismiss(a.id)} aria-label={t('alerts.dismiss')} className="rounded p-1 text-muted hover:text-fg">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
