import type { ReactNode } from 'react';
import type { AssessedHour } from '../types/risk';
import { useI18n, type MessageKey } from '../i18n';
import { formatHour, formatNumber, formatSigned, formatTemp } from '../utils/format';
import { CategoryBadge, Stat } from './ui';

/** Plain-language factors behind one hour's assessment. */
export function hourFactors(h: AssessedHour): Array<{ key: MessageKey; params: Record<string, string | number> }> {
  const out: Array<{ key: MessageKey; params: Record<string, string | number> }> = [];
  const a = h.assessment;
  const { temperatureC: t, relativeHumidity: rh, uvIndex: uv, isDay } = h.hour;
  if (a.status === 'ok' && a.indicator.valueC !== null && t !== null && rh !== null) {
    const delta = a.indicator.valueC - t;
    out.push({
      key: rh >= 40 && delta >= 1 ? 'outlook.factorHumid' : 'outlook.factorDry',
      params: { rh: Math.round(rh), delta: formatSigned(delta, 1, '°C') },
    });
  }
  if (isDay && uv !== null && uv >= 3) out.push({ key: 'outlook.factorSun', params: { uv: uv.toFixed(1) } });
  if (isDay === false) out.push({ key: 'outlook.factorNight', params: {} });
  return out;
}

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
        <h3 className="text-sm font-semibold text-fg">{t('outlook.factors')}</h3>
        <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm text-muted">
          {hourFactors(hour).map((f) => (
            <li key={f.key}>{t(f.key, f.params)}</li>
          ))}
          {a.notes
            .filter((n) => n !== 'forecast_uncertainty')
            .map((n) => (
              <li key={n}>{t(`note.${n}`)}</li>
            ))}
        </ul>
      </div>
      <p className="text-sm text-fg">{t(`guide.${a.category}`)}</p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
