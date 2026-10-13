/**
 * Dashboard (formerly "Overview"): the landing page. Everything here belongs to the one
 * selected location, and nothing is shown unless the data for that location is loaded.
 *
 * Layout (wide screens):        Small screens stack in reading order:
 *   [ stat ][ stat ][ stat ][ stat ]   stats, risk summary, map, alerts,
 *   [       map       ][  risk     ]   next 24 hours, next days
 *   [                 ][  alerts   ]
 *   [        next 24 hours        ]
 *   [          next days          ]
 */
import { TriangleAlert } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { CategoryLegend, HeatRibbon } from '../components/HeatRibbon';
import { CategoryBadge, Panel } from '../components/ui';
import { DashboardMap } from '../components/DashboardMap';
import { CalculationDetails, RiskReasons } from '../components/RiskExplanation';
import { CATEGORY_COLORS, CATEGORY_INK, DEFAULT_ELEVATED_CATEGORY, tint } from '../services/risk/categories';
import { findElevatedPeriods } from '../services/risk/periods';
import { describeLocation } from '../services/weather/geocoding';
import { formatClock, formatDate, formatHour, formatNumber, formatTemp } from '../utils/format';
import type { ReactNode } from 'react';

function StatCard({ label, value, hint, valueColor }: { label: string; value: ReactNode; hint?: ReactNode; valueColor?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="num mt-1 text-[28px] font-semibold leading-none tracking-tight text-fg" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-medium text-accent hover:underline">
      {children}
    </button>
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const { current, assessed, selectedIndex, setSelectedIndex, navigate, alerts } = useApp();

  return (
    <WeatherGate>
      {(snap) => {
        const c = snap.current;
        const a = current;
        const category = a?.category ?? 'unavailable';
        const periods = findElevatedPeriods(assessed, DEFAULT_ELEVATED_CATEGORY);
        const today = snap.daily[0];
        const nowHour = snap.hourly[0];
        const place = snap.location;
        const subtitle = describeLocation({ name: '', region: place.region, country: place.country }).replace(/^,\s*/, '');

        return (
          <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <div>
                <h1 id="page-title" tabIndex={-1} className="text-[26px] font-semibold tracking-tight text-fg outline-none">
                  {place.name}
                </h1>
                <p className="text-sm text-muted">
                  {subtitle && `${subtitle}. `}
                  {t('risk.modelNote', { time: formatClock(c.time, snap.timezone) })}
                </p>
              </div>
            </header>

            {/* Current conditions */}
            <section aria-label={t('risk.current')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label={t('dash.hiLabel')}
                value={a?.indicator.valueC != null ? formatTemp(a.indicator.valueC) : '—'}
                valueColor={CATEGORY_INK[category]}
                hint={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CategoryBadge category={category} size="sm" />
                    {a?.confidence === 'limited' && <span className="text-amber">{t('risk.limited')}</span>}
                  </span>
                }
              />
              <StatCard
                label={t('risk.airTemp')}
                value={formatTemp(c.temperatureC, 1)}
                hint={today ? t('dash.todayRange', { max: formatTemp(today.tempMaxC), min: formatTemp(today.tempMinC) }) : undefined}
              />
              <StatCard
                label={t('risk.humidity')}
                value={formatNumber(c.relativeHumidity, 0, '%')}
                hint={c.apparentTemperatureC !== null ? `${t('risk.feelsLike')}: ${formatTemp(c.apparentTemperatureC)}` : undefined}
              />
              <StatCard
                label={t('risk.wind')}
                value={formatNumber(c.windSpeedKmh, 0, 'km/h')}
                hint={nowHour?.uvIndex != null ? t('dash.uvNow', { uv: formatNumber(nowHour.uvIndex, 0) }) : undefined}
              />
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
              {/* Risk summary (replaces the old "Why this risk level" page) */}
              <section
                aria-labelledby="risk-title"
                className="order-1 rounded-2xl border border-s-4 border-line bg-panel p-4 shadow-card sm:p-5 lg:col-start-2 lg:row-start-1"
                style={{ borderInlineStartColor: CATEGORY_COLORS[category] }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="risk-title" className="text-[15px] font-semibold text-fg">
                    {t('dash.riskTitle')}
                  </h2>
                  <CategoryBadge category={category} />
                </div>
                <p className="mt-2 text-sm text-fg">{t(`catDesc.${category}`)}</p>
                <h3 className="mt-4 mb-1.5 text-[13px] font-medium text-muted">{t('dash.why')}</h3>
                {a && <RiskReasons assessment={a} context={{ uvIndex: nowHour?.uvIndex ?? null, isDay: c.isDay }} />}
                <p className="mt-4 rounded-xl bg-raised px-3 py-2.5 text-sm text-fg">{t(`guide.${category}`)}</p>
                <div className="mt-3">{a && <CalculationDetails assessment={a} onNavigate={navigate} />}</div>
                <p className="mt-3 text-xs text-faint">{t('why.estimate')}</p>
              </section>

              {/* Live resource map */}
              <div className="order-2 min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                <DashboardMap />
              </div>

              {/* Alerts */}
              <Panel
                title={t('dash.alertsTitle')}
                aside={<LinkButton onClick={() => navigate('alerts')}>{t('dash.alertSettings')}</LinkButton>}
                className="order-3 lg:col-start-2 lg:row-start-2"
              >
                {!alerts.prefs.enabled ? (
                  <p className="text-sm text-muted">{t('alerts.disabled')}</p>
                ) : alerts.alerts.length === 0 ? (
                  <p className="text-sm text-muted">{t('alerts.none', { n: alerts.prefs.lookaheadHours })}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {alerts.alerts.slice(0, 3).map((al) => (
                      <li
                        key={al.id}
                        className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: tint(CATEGORY_COLORS[al.peakCategory], 10) }}
                      >
                        <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" style={{ color: CATEGORY_INK[al.peakCategory] }} />
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-fg">
                            {t(al.ongoing ? 'alerts.ongoing' : 'alerts.upcoming', { category: t(`cat.${al.peakCategory}`) })}
                            {al.simulatedData && <span className="ms-2 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">{t('alerts.demoTag')}</span>}
                          </p>
                          <p className="text-muted">
                            {t('alerts.body', {
                              start: formatHour(al.startTime, snap.timezone),
                              end: formatHour(al.endTime, snap.timezone),
                              place: place.name,
                              hi: formatTemp(al.peakHeatIndexC),
                            })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

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
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-t border-line pt-4">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-muted">{t('risk.elevated')}</h3>
                  {periods.length === 0 ? (
                    <p className="mt-1 text-sm text-fg">{t('risk.noElevated', { category: t(`cat.${DEFAULT_ELEVATED_CATEGORY}`) })}</p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {periods.map((p) => (
                        <li key={p.startTime} className="flex items-center gap-2 text-sm text-fg">
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[p.peakCategory] }} />
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
                <LinkButton onClick={() => navigate('outlook')}>{t('dash.openOutlook')}</LinkButton>
              </div>
            </Panel>

            {snap.daily.length > 0 && (
              <Panel title={t('overview.daily')}>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {snap.daily.slice(0, 3).map((d) => (
                    <li key={d.date} className="rounded-xl bg-raised px-3.5 py-3">
                      <div className="text-[13px] text-muted">{formatDate(d.date)}</div>
                      <div className="num mt-1 font-medium text-fg">{t('risk.highLow', { max: formatTemp(d.tempMaxC), min: formatTemp(d.tempMinC) })}</div>
                      <div className="num mt-0.5 text-xs text-muted">
                        {t('risk.uv')} {formatNumber(d.uvIndexMax, 0)}
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
