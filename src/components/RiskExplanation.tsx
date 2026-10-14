/**
 * "Why this level": plain-language reasons first, the calculation behind an expander.
 * This replaces the former "Why this risk level" page (its full content is kept in the
 * expander, and the methodology page documents the engine in depth).
 */
import { ChevronDown } from 'lucide-react';
import type { HeatAssessment } from '../types/risk';
import { useI18n } from '../i18n';
import { CATEGORY_SOURCE } from '../services/risk/categories';
import { cToF, fToC } from '../services/risk/heatIndex';
import { explainAssessment, type ReasonContext } from '../services/risk/explain';
import { formatNumber } from '../utils/format';
import { BandScale } from './BandScale';
import type { Route } from '../hooks/useHashRoute';

export function RiskReasons({ assessment, context }: { assessment: HeatAssessment; context: ReasonContext }) {
  const { t } = useI18n();
  const reasons = explainAssessment(assessment, context);
  if (reasons.length === 0) return <p className="text-sm text-muted">{t('catDesc.unavailable')}</p>;
  return (
    <ul className="space-y-1.5 text-sm text-fg">
      {reasons.map((r) => (
        <li key={r.key} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
          <span>{t(r.key, r.key === 'why.band' ? { ...r.params, category: t(`cat.${r.params.category as 'danger'}`) } : r.params)}</span>
        </li>
      ))}
    </ul>
  );
}

function bandText(a: HeatAssessment): string {
  if (!a.rule) return '—';
  const f = (x: number) => `${x} °F (${fToC(x).toFixed(1)} °C)`;
  if (a.rule.minF === null) return `< ${f(a.rule.maxF as number)}`;
  if (a.rule.maxF === null) return `≥ ${f(a.rule.minF)}`;
  return `${f(a.rule.minF)} ≤ HI < ${f(a.rule.maxF)}`;
}

/** The technical calculation, collapsed by default. */
export function CalculationDetails({ assessment: a, onNavigate }: { assessment: HeatAssessment; onNavigate?: (r: Route) => void }) {
  const { t } = useI18n();
  const ok = a.status === 'ok';
  const tC = a.inputs.temperatureC;
  const rows: Array<[string, string]> = [
    [t('explain.step.inputs'), `T = ${tC === null ? '—' : `${tC.toFixed(1)} °C (${cToF(tC).toFixed(1)} °F)`}, RH = ${formatNumber(a.inputs.relativeHumidity, 0, '%')}`],
  ];
  if (ok) {
    rows.push(
      [t('explain.step.formula'), a.indicator.method === 'simple' ? t('explain.simple') : t('explain.rothfusz')],
      [
        t('explain.step.adjust'),
        a.indicator.method === 'rothfusz_low_rh_adjusted' ? t('explain.lowAdj') : a.indicator.method === 'rothfusz_high_rh_adjusted' ? t('explain.highAdj') : t('explain.noAdj'),
      ],
      [t('explain.step.result'), `${a.indicator.valueF?.toFixed(1)} °F = ${a.indicator.valueC?.toFixed(1)} °C`],
      [t('explain.step.band'), `${bandText(a)} → ${t(`cat.${a.category}`)}`],
    );
  }
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-accent hover:bg-raised [&::-webkit-details-marker]:hidden">
        {t('why.learn')}
        <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-3.5 py-3 text-sm">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[9rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="num min-w-0 text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        {ok && <BandScale valueF={a.indicator.valueF} label={t('explain.scale')} />}
        <ul className="mt-2 list-disc space-y-0.5 ps-5 text-xs text-muted">
          {a.notes.map((n) => (
            <li key={n}>{t(`note.${n}`)}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">
          <a href="https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml" target="_blank" rel="noreferrer">
            NWS heat index equation
          </a>
          {', '}
          <a href={CATEGORY_SOURCE.url} target="_blank" rel="noreferrer">
            {CATEGORY_SOURCE.name}
          </a>
          . U.S. reference bands, not PMD/NDMA warning criteria.
          {onNavigate && (
            <>
              {' '}
              <a
                href="#/method"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('method');
                }}
              >
                {t('why.method')}
              </a>
            </>
          )}
        </p>
      </div>
    </details>
  );
}
