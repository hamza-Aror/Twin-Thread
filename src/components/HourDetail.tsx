import type { ReactNode } from 'react';
import type { AssessedHour } from '../types/risk';
import { useI18n } from '../i18n';
import { formatHour, formatNumber, formatTemp } from '../utils/format';
import { CategoryBadge, Stat } from './ui';
import { CalculationDetails, RiskReasons } from './RiskExplanation';

/** One forecast hour: values, plain-language reasons (same logic as the Dashboard), and the calculation on request. */
export function HourDetail({ hour, timeZone, actions }: { hour: AssessedHour; timeZone: string; actions?: ReactNode }) {
  const { t } = useI18n();
  const a = hour.assessment;
  const h = hour.hour;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="num text-2xl font-semibold text-fg">{formatHour(h.time, timeZone)}</div>
          <div className="text-sm text-muted">
            {t('risk.heatIndex')} <span className="num font-semibold text-fg">{formatTemp(a.indicator.valueC, 1)}</span>
          </div>
        </div>
        <CategoryBadge category={a.category} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label={t('risk.airTemp')} value={formatTemp(h.temperatureC, 1)} />
        <Stat label={t('risk.humidity')} value={formatNumber(h.relativeHumidity, 0, '%')} />
        <Stat label={t('risk.feelsLike')} value={formatTemp(h.apparentTemperatureC, 1)} />
        <Stat label={t('risk.uv')} value={formatNumber(h.uvIndex, 1)} />
        <Stat label={t('risk.wind')} value={formatNumber(h.windSpeedKmh, 0, 'km/h')} />
        <Stat label={t('risk.rain')} value={formatNumber(h.precipitationProbability, 0, '%')} />
      </div>
      <div>
        <h3 className="mb-1.5 text-[13px] font-medium text-muted">{t('dash.why')}</h3>
        <RiskReasons assessment={a} context={{ uvIndex: h.uvIndex, isDay: h.isDay }} />
      </div>
      <p className="rounded-xl bg-raised px-3 py-2.5 text-sm text-fg">{t(`guide.${a.category}`)}</p>
      <CalculationDetails assessment={a} />
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
