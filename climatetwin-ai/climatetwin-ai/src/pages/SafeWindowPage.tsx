import { useId, useMemo, useState } from 'react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { HeatRibbon } from '../components/HeatRibbon';
import { CategoryBadge, Field, Notice, PageHeader, Panel, inputClass } from '../components/ui';
import { type ActivitySetting, type CriterionComparison, type RankedWindow, findSafeWindows } from '../services/safeWindow';
import type { RiskCategory } from '../types/risk';
import { formatHour, formatNumber, formatTemp } from '../utils/format';

const hourLabel = (h: number) => {
  const hh = h % 24;
  return `${((hh + 11) % 12) + 1} ${hh < 12 ? 'AM' : 'PM'}${h === 24 ? ' (midnight)' : ''}`;
};

export function SafeWindowPage() {
  const { t } = useI18n();
  const { assessed } = useApp();
  const id = useId();
  const [duration, setDuration] = useState(2);
  const [from, setFrom] = useState(6);
  const [to, setTo] = useState(20);
  const [setting, setSetting] = useState<ActivitySetting>('outdoor');
  const [fixed, setFixed] = useState<string>('');
  const [showAll, setShowAll] = useState(false);

  return (
    <WeatherGate>
      {(snap) => {
        const tz = snap.timezone;
        return (
          <SafeWindowContent
            {...{ t, assessed, id, duration, setDuration, from, setFrom, to, setTo, setting, setSetting, fixed, setFixed, showAll, setShowAll, tz }}
            offset={snap.utcOffsetSeconds}
          />
        );
      }}
    </WeatherGate>
  );
}

type ContentProps = {
  t: ReturnType<typeof useI18n>['t'];
  assessed: ReturnType<typeof useApp>['assessed'];
  id: string;
  duration: number;
  setDuration: (n: number) => void;
  from: number;
  setFrom: (n: number) => void;
  to: number;
  setTo: (n: number) => void;
  setting: ActivitySetting;
  setSetting: (s: ActivitySetting) => void;
  fixed: string;
  setFixed: (s: string) => void;
  showAll: boolean;
  setShowAll: (b: boolean) => void;
  tz: string;
  offset: number;
};

function SafeWindowContent(p: ContentProps) {
  const { t, assessed, id, tz } = p;
  const result = useMemo(
    () =>
      findSafeWindows(
        assessed,
        {
          durationHours: p.duration,
          preferredStartHour: p.from,
          preferredEndHour: p.to,
          setting: p.setting,
          fixedStartTime: p.fixed ? Number(p.fixed) : null,
        },
        p.offset,
      ),
    [assessed, p.duration, p.from, p.to, p.setting, p.fixed, p.offset],
  );

  const range = (w: RankedWindow) => `${formatHour(w.startTime, tz)} – ${formatHour(w.endTime, tz)}`;
  const reason = (c: CriterionComparison | null): string => {
    if (!c) return '';
    const fmt = (v: number | string | null) => {
      if (v === null) return t('map.unknown');
      switch (c.criterion) {
        case 'worst_category':
          return t(`cat.${v as RiskCategory}`);
        case 'peak_heat_index':
        case 'mean_heat_index':
          return formatTemp(v as number, 1);
        case 'peak_uv':
          return formatNumber(v as number, 1);
        default:
          return String(v);
      }
    };
    return t(`reason.${c.criterion}`, { value: fmt(c.value), best: fmt(c.bestValue) });
  };

  const best = result.ranked[0];
  const alternatives = result.ranked.slice(1, p.showAll ? undefined : 5);

  const stats = (w: RankedWindow) => (
    <ul className="num mt-2 grid gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
      <li>{t('window.worst', { category: t(`cat.${w.worstCategory}`) })}</li>
      <li>{t('window.hoursAtWorst', { n: w.hoursAtWorst, total: p.duration })}</li>
      <li>{t('window.peak', { value: formatTemp(w.peakHeatIndexC, 1) })}</li>
      <li>{t('window.mean', { value: formatTemp(w.meanHeatIndexC, 1) })}</li>
      {p.setting === 'outdoor' && <li>{t('window.peakUv', { value: formatNumber(w.peakUv, 1) })}</li>}
      {w.limitedConfidenceHours > 0 && <li className="text-amber">{t('risk.limited')}</li>}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('window.title')} intro={t('window.intro')} />

      <Panel>
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
          <Field label={t('window.duration')} htmlFor={`${id}-d`}>
            <select id={`${id}-d`} className={inputClass} value={p.duration} onChange={(e) => p.setDuration(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {t('window.hours', { n })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('window.from')} htmlFor={`${id}-f`}>
            <select id={`${id}-f`} className={inputClass} value={p.from} onChange={(e) => p.setFrom(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('window.to')} htmlFor={`${id}-t`}>
            <select id={`${id}-t`} className={inputClass} value={p.to} onChange={(e) => p.setTo(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm text-muted">{t('window.setting')}</legend>
            {(['outdoor', 'indoor'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-fg">
                <input type="radio" name={`${id}-s`} value={s} checked={p.setting === s} onChange={() => p.setSetting(s)} className="accent-[#5cc8e8]" />
                {t(s === 'outdoor' ? 'window.outdoor' : 'window.indoor')}
              </label>
            ))}
          </fieldset>
          <Field label={t('window.fixed')} htmlFor={`${id}-x`}>
            <select id={`${id}-x`} className={inputClass} value={p.fixed} onChange={(e) => p.setFixed(e.target.value)}>
              <option value="">{t('window.noFixed')}</option>
              {assessed.map((h) => (
                <option key={h.hour.time} value={h.hour.time}>
                  {formatHour(h.hour.time, tz)}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Panel>

      {!result.ok && result.error && (
        <Notice tone="warn" role="status">
          {t(`window.err.${result.error}`)}
        </Notice>
      )}

      {best && (
        <Panel title={t('window.best')}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="num text-2xl font-semibold text-fg">{range(best)}</span>
            <CategoryBadge category={best.worstCategory} />
          </div>
          {stats(best)}
          <div className="mt-4">
            <HeatRibbon hours={assessed} timeZone={tz} highlight={[best.startIndex, best.startIndex + p.duration - 1]} height={40} label={t('window.best')} />
          </div>
        </Panel>
      )}

      {result.fixed && (
        <Panel title={t('window.fixedTitle')}>
          {result.fixed.window ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="num text-xl font-semibold text-fg">{range(result.fixed.window)}</span>
                <CategoryBadge category={result.fixed.window.worstCategory} />
              </div>
              {stats(result.fixed.window)}
              <p className="mt-3 text-sm text-fg">
                {result.fixed.window.position === 1
                  ? t('window.fixedSame')
                  : result.fixed.window.versusBest
                    ? t('window.fixedCompare', { reason: reason(result.fixed.window.versusBest) })
                    : ''}
              </p>
              {result.fixed.window.position === 0 && <p className="mt-1 text-xs text-faint">{t('window.fixedOutside')}</p>}
            </>
          ) : (
            <p className="text-sm text-amber">{t(result.fixed.error === 'incomplete_data' ? 'window.incomplete' : 'window.notInForecast')}</p>
          )}
        </Panel>
      )}

      {alternatives.length > 0 && (
        <Panel title={t('window.alternatives')}>
          <ol className="flex flex-col divide-y divide-line">
            {alternatives.map((w) => (
              <li key={w.startTime} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="num w-8 text-sm text-faint">{w.position}</span>
                <span className="num min-w-[9rem] font-medium text-fg">{range(w)}</span>
                <CategoryBadge category={w.worstCategory} size="sm" />
                <span className="text-sm text-muted">{t('window.rankedLower', { reason: reason(w.versusBest) })}</span>
              </li>
            ))}
          </ol>
          {result.ranked.length > 5 && (
            <button type="button" className="mt-3 text-sm text-accent" onClick={() => p.setShowAll(!p.showAll)} aria-expanded={p.showAll}>
              {p.showAll ? 'Show top 5' : `Show all ${result.ranked.length}`}
            </button>
          )}
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('window.rules')}>
          <p className="text-sm text-muted">{t('window.rulesIntro')}</p>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-fg">
            {result.criteria.map((c) => (
              <li key={c}>{t(`criterion.${c}`)}</li>
            ))}
          </ol>
        </Panel>
        <Panel title={t('window.uncertainty')}>
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted">
            <li>{t('window.unc1')}</li>
            <li>{t('window.unc2')}</li>
            <li>{t('window.unc3')}</li>
            {p.setting === 'indoor' && <li>{t('window.uncIndoor')}</li>}
            {result.excludedForMissingData > 0 && <li className="text-amber">{t('window.excluded', { n: result.excludedForMissingData })}</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
