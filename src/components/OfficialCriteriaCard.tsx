/**
 * Official heatwave criteria for the selected place, shown SEPARATELY from CoolRoute's heat-risk
 * estimate. Always labelled as a rule-based estimate (no live PMD feed is integrated).
 */
import type { CSSProperties } from 'react';
import { ExternalLink, Landmark } from 'lucide-react';
import { tint } from '../services/risk/categories';
import { useI18n } from '../i18n';
import type { WeatherSnapshot } from '../types/weather';
import { evaluateFramework, selectFramework, type OfficialLevel } from '../services/official/heatwaveFrameworks';
import { formatDate, formatTemp } from '../utils/format';
import { describeLocation } from '../services/weather/geocoding';

/** Official levels reuse the risk palette tokens so both themes stay consistent (always shown with the level name). */
const LEVEL_STYLE: Record<OfficialLevel, CSSProperties> = {
  normal: { backgroundColor: 'var(--c-raised)', color: 'var(--c-fg)' },
  alert: { backgroundColor: tint('var(--risk-caution)', 22), color: 'var(--risk-caution-ink)' },
  warning: { backgroundColor: tint('var(--risk-extreme_caution)', 18), color: 'var(--risk-extreme_caution-ink)' },
  emergency: { backgroundColor: tint('var(--risk-danger)', 16), color: 'var(--risk-danger-ink)' },
  unavailable: { backgroundColor: 'var(--c-raised)', color: 'var(--c-muted)' },
};

export function OfficialCriteriaCard({ snapshot, className = '' }: { snapshot: WeatherSnapshot; className?: string }) {
  const { t } = useI18n();
  const place = snapshot.location;
  const selection = selectFramework(place);

  return (
    <section aria-labelledby="official-title" className={`rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="official-title" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Landmark size={16} aria-hidden className="text-muted" />
          {t('off.title')}
        </h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t('off.estimateTag')}</span>
      </div>

      {selection.kind === 'none' ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-fg">{t(`off.none.${selection.reason}`, { region: describeLocation(place) })}</p>
          <p className="text-xs text-faint">{t('off.appVsOfficial')}</p>
          <a href="https://www.pmd.gov.pk/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px]">
            {t('off.checkPmd')}
            <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      ) : (
        (() => {
          const fw = selection.framework;
          const ev = evaluateFramework(fw, snapshot.daily.slice(0, 5));
          return (
            <div className="mt-2 space-y-3 text-sm">
              <p className="text-muted">
                {t(selection.match === 'city' ? 'off.cityFramework' : 'off.provinceFramework', { name: fw.sourceTitle, scope: fw.scope })}
              </p>
              {ev.days.length === 0 ? (
                <p className="text-muted">{t('off.levelUnavailable')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {ev.days.map((d) => (
                    <li key={d.date} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="num text-[13px] text-muted">
                        {formatDate(d.date)}
                        {d.maxC !== null && (
                          <>
                            {', '}
                            {t('off.maxMin', { max: formatTemp(d.maxC, 1), min: formatTemp(d.minC, 1) })}
                          </>
                        )}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={LEVEL_STYLE[d.level]}>
                        {d.level === 'unavailable' ? t('off.levelUnavailable') : fw.levelNames[d.level]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {ev.emergencyTemperatureCriteriaMet && ev.emergencyNeedsHealthReports && <p className="rounded-lg bg-raised px-3 py-2 text-[13px] text-fg">{t('off.emergencyNeedsHealth')}</p>}
              {ev.emergencyTemperatureCriteriaMet && !ev.emergencyNeedsHealthReports && <p className="rounded-lg bg-raised px-3 py-2 text-[13px] text-fg">{t('off.emergencyKarachi')}</p>}
              {fw.id === 'karachi_hwmp_2017' && <p className="text-xs text-faint">{t('off.karachiNotes')}</p>}
              <p className="text-xs text-faint">{t('off.notLive')}</p>
              <p className="text-xs text-faint">{t('off.appVsOfficial')}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a href={fw.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px]">
                  {t('off.source')}
                  <ExternalLink size={13} aria-hidden />
                </a>
                <a href="https://www.pmd.gov.pk/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px]">
                  {t('off.checkPmd')}
                  <ExternalLink size={13} aria-hidden />
                </a>
              </div>
            </div>
          );
        })()
      )}
    </section>
  );
}
