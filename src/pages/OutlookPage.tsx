import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { HourlyChart } from '../components/HourlyChart';
import { HourDetail } from '../components/HourDetail';
import { CategoryLegend, HeatRibbon } from '../components/HeatRibbon';
import { Button, PageHeader, Panel } from '../components/ui';
import { CATEGORY_INK, DEFAULT_ELEVATED_CATEGORY } from '../services/risk/categories';
import { formatHour, formatNumber, formatTemp } from '../utils/format';

export function OutlookPage() {
  const { t } = useI18n();
  const { assessed, selectedIndex, setSelectedIndex, navigate } = useApp();

  return (
    <WeatherGate>
      {(snap) => {
        const selected = assessed[selectedIndex];
        const nowOffset = snap.hourly.length ? (snap.current.time - snap.hourly[0].time) / 3600 : 0;
        return (
          <div className="flex flex-col gap-5">
            <PageHeader title={t('outlook.title')} intro={t('outlook.intro', { category: t(`cat.${DEFAULT_ELEVATED_CATEGORY}`) })} />
            <Panel aside={<CategoryLegend />} title={`${snap.location.name}: ${t('risk.next24')}`}>
              <HourlyChart
                hours={assessed}
                timeZone={snap.timezone}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                elevatedFrom={DEFAULT_ELEVATED_CATEGORY}
                nowOffset={nowOffset}
              />
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" dir="ltr">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-0.5 w-5 bg-fg" />
                  {t('outlook.seriesHi')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-faint" />
                  {t('outlook.seriesTemp')}
                </span>
              </div>
              <div className="mt-4">
                <HeatRibbon hours={assessed} timeZone={snap.timezone} selectedIndex={selectedIndex} onSelect={setSelectedIndex} height={44} label={t('outlook.selectHour')} />
              </div>
              <p className="mt-3 text-xs text-faint">{t('outlook.notGuaranteed')}</p>
            </Panel>

            {selected && (
              <Panel title={t('outlook.selectHour')}>
                <HourDetail
                  hour={selected}
                  timeZone={snap.timezone}
                  actions={
<Button onClick={() => navigate('simulator')}>{t('outlook.simulate')}</Button>
                  }
                />
              </Panel>
            )}

            <details className="rounded-2xl border border-line bg-panel p-4 shadow-card">
              <summary className="cursor-pointer text-sm font-semibold text-fg">Data table (24 hours)</summary>
              <div className="mt-3 overflow-x-auto" dir="ltr">
                <table className="num w-full min-w-[560px] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1.5 pe-3 font-medium">Time</th>
                      <th className="py-1.5 pe-3 font-medium">Air temp</th>
                      <th className="py-1.5 pe-3 font-medium">Humidity</th>
                      <th className="py-1.5 pe-3 font-medium">Heat index</th>
                      <th className="py-1.5 pe-3 font-medium">Category</th>
                      <th className="py-1.5 font-medium">UV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessed.map((h) => (
                      <tr key={h.hour.time} className="border-t border-line">
                        <td className="py-1.5 pe-3">{formatHour(h.hour.time, snap.timezone)}</td>
                        <td className="py-1.5 pe-3">{formatTemp(h.hour.temperatureC, 1)}</td>
                        <td className="py-1.5 pe-3">{formatNumber(h.hour.relativeHumidity, 0, '%')}</td>
                        <td className="py-1.5 pe-3">{formatTemp(h.assessment.indicator.valueC, 1)}</td>
                        <td className="py-1.5 pe-3" style={{ color: CATEGORY_INK[h.assessment.category] }}>
                          {t(`cat.${h.assessment.category}`)}
                        </td>
                        <td className="py-1.5">{formatNumber(h.hour.uvIndex, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      }}
    </WeatherGate>
  );
}
