import { CalendarClock, Droplets, HeartPulse } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { CategoryLegend, HeatRibbon } from '../components/HeatRibbon';
import { CategoryBadge, Panel, Stat } from '../components/ui';
import { CATEGORY_COLORS, DEFAULT_ELEVATED_CATEGORY } from '../services/risk/categories';
import { findElevatedPeriods } from '../services/risk/periods';
import { formatClock, formatDate, formatHour, formatNumber, formatTemp } from '../utils/format';
import type { Route } from '../hooks/useHashRoute';
import type { MessageKey } from '../i18n';

export function OverviewPage() {
  const { t } = useI18n();
  const { current, assessed, selectedIndex, setSelectedIndex, navigate } = useApp();

  return (
    <WeatherGate>
      {(snap) => {
        const c = snap.current;
        const a = current;
        const category = a?.category ?? 'unavailable';
        const color = CATEGORY_COLORS[category];
        const periods = findElevatedPeriods(assessed, DEFAULT_ELEVATED_CATEGORY);
        const today = snap.daily[0];

        const actions: Array<{ route: Route; title: MessageKey; body: MessageKey; Icon: typeof Droplets }> = [
          { route: 'window', title: 'overview.window', body: 'overview.windowBody', Icon: CalendarClock },
          { route: 'map', title: 'overview.resources', body: 'overview.resourcesBody', Icon: Droplets },
          { route: 'alerts', title: 'overview.guidance', body: 'overview.guidanceBody', Icon: HeartPulse },
        ];

        return (
          <div className="flex flex-col gap-6">
            {/* Current conditions: the heat index is the headline, its category gives it colour and meaning. */}
            <section aria-labelledby="page-title" className="grid gap-6 rounded-2xl border border-line bg-panel p-5 sm:p-7 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="text-sm text-muted">
                  {snap.location.name}
                  {!snap.location.custom && `, ${snap.location.region}`}
                </p>
                <h1 id="page-title" tabIndex={-1} className="mt-1 text-lg font-medium text-fg outline-none">
                  {t('risk.current')}
                </h1>
                <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
                  <div>
                    <div className="text-sm text-muted">{t('risk.heatIndex')}</div>
                    <div dir="ltr" className="num text-6xl font-semibold tracking-tight sm:text-7xl" style={{ color }}>
                      {a?.indicator.valueC !== null && a?.indicator.valueC !== undefined ? Math.round(a.indicator.valueC) : '—'}
                      <span className="ms-1 text-3xl font-normal text-muted">°C</span>
                    </div>
                  </div>
                  <div className="pb-2">
                    <CategoryBadge category={category} />
                    {a?.confidence === 'limited' && <p className="mt-1.5 text-xs text-amber">{t('risk.limited')}</p>}
                  </div>
                </div>
                <p className="mt-4 max-w-xl text-fg">{t(`catDesc.${category}`)}</p>
                <p className="mt-2 max-w-xl text-muted">{t(`guide.${category}`)}</p>
                <p className="mt-4 text-xs text-faint">
                  {t('risk.modelNote', { time: formatClock(c.time, snap.timezone) })} {t('risk.heatIndexHelp')}
                </p>
              </div>
              <div className="grid grid-cols-2 content-start gap-x-4 gap-y-5 border-line lg:border-s lg:ps-6">
                <Stat label={t('risk.airTemp')} value={formatTemp(c.temperatureC, 1)} />
                <Stat label={t('risk.humidity')} value={formatNumber(c.relativeHumidity, 0, '%')} />
                <Stat label={t('risk.feelsLike')} value={formatTemp(c.apparentTemperatureC, 1)} />
                <Stat label={t('risk.wind')} value={formatNumber(c.windSpeedKmh, 0, 'km/h')} />
                {today && (
                  <div className="col-span-2">
                    <Stat label={`${t('risk.today')} (${formatDate(today.date)})`} value={t('risk.highLow', { max: formatTemp(today.tempMaxC), min: formatTemp(today.tempMinC) })} />
                  </div>
                )}
              </div>
            </section>

            <Panel title={t('risk.next24')} aside={<CategoryLegend />}>
              <HeatRibbon
                hours={assessed}
                timeZone={snap.timezone}
                selectedIndex={selectedIndex}
                onSelect={(i) => {
                  setSelectedIndex(i);
                  navigate('outlook');
                }}
                label={t('outlook.selectHour')}
              />
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="text-sm font-semibold text-fg">{t('risk.elevated')}</h3>
                {periods.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{t('risk.noElevated', { category: t(`cat.${DEFAULT_ELEVATED_CATEGORY}`) })}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {periods.map((p) => (
                      <li key={p.startTime} className="flex items-center gap-2 text-sm text-fg">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[p.peakCategory] }} />
                        {t('risk.period', {
                          start: formatHour(p.startTime, snap.timezone),
                          end: formatHour(p.endTime, snap.timezone),
                          category: t(`cat.${p.peakCategory}`),
                          hi: formatTemp(p.peakHeatIndexC),
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            <section aria-label={t('overview.next')}>
              <h2 className="mb-3 text-base font-semibold">{t('overview.next')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {actions.map(({ route, title, body, Icon }) => (
                  <a
                    key={route}
                    href={`#/${route}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(route);
                    }}
                    className="group flex gap-3 rounded-xl border border-line bg-panel p-4 text-fg no-underline hover:border-accent/60"
                  >
                    <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                    <span>
                      <span className="block font-semibold group-hover:text-accent">{t(title)}</span>
                      <span className="mt-0.5 block text-sm text-muted">{t(body)}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>

            {snap.daily.length > 0 && (
              <Panel title={t('overview.daily')}>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {snap.daily.slice(0, 3).map((d) => (
                    <li key={d.date} className="rounded-lg border border-line bg-ink px-3 py-2.5">
                      <div className="text-sm text-muted">{formatDate(d.date)}</div>
                      <div className="num mt-1 text-fg">{t('risk.highLow', { max: formatTemp(d.tempMaxC), min: formatTemp(d.tempMinC) })}</div>
                      <div className="num mt-0.5 text-xs text-faint">
                        {t('risk.uv')} {formatNumber(d.uvIndexMax, 1)}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        );
      }}
    </WeatherGate>
  );
}
