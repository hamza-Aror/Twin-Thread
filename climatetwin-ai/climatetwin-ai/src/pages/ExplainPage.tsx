import { useId, type ReactNode } from 'react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { CategoryBadge, PageHeader, Panel, inputClass } from '../components/ui';
import { CATEGORY_COLORS, CATEGORY_RULES, CATEGORY_SOURCE } from '../services/risk/categories';
import { cToF, fToC } from '../services/risk/heatIndex';
import type { HeatAssessment } from '../types/risk';
import { formatHour, formatNumber } from '../utils/format';

const SCALE_MIN = 70;
const SCALE_MAX = 140;
const pct = (f: number) => `${((Math.min(Math.max(f, SCALE_MIN), SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`;

/** Horizontal heat-index scale with the NWS bands and a marker at the computed value. */
export function BandScale({ valueF, label }: { valueF: number | null; label: string }) {
  return (
    <div dir="ltr" className="mt-2" role="img" aria-label={label}>
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        {CATEGORY_RULES.map((r) => {
          const from = r.minF ?? SCALE_MIN;
          const to = r.maxF ?? SCALE_MAX;
          return (
            <div
              key={r.category}
              className="absolute top-0 h-full"
              style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})`, backgroundColor: CATEGORY_COLORS[r.category], opacity: 0.85 }}
            />
          );
        })}
      </div>
      {valueF !== null && (
        <div className="relative h-5">
          <div className="absolute -top-4 h-5 w-0.5 -translate-x-1/2 bg-fg" style={{ left: pct(valueF) }} />
        </div>
      )}
      <div className="num relative h-4 text-[11px] text-faint">
        {[80, 90, 103, 125].map((f) => (
          <span key={f} className="absolute -translate-x-1/2" style={{ left: pct(f) }}>
            {f}°F
          </span>
        ))}
      </div>
    </div>
  );
}

function bandText(a: HeatAssessment): string {
  if (!a.rule) return '—';
  const f = (x: number) => `${x} °F (${fToC(x).toFixed(1)} °C)`;
  if (a.rule.minF === null) return `< ${f(a.rule.maxF as number)}`;
  if (a.rule.maxF === null) return `≥ ${f(a.rule.minF)}`;
  return `${f(a.rule.minF)} ≤ HI < ${f(a.rule.maxF)}`;
}

export function ExplainPage() {
  const { t } = useI18n();
  const { assessed, selectedIndex, setSelectedIndex } = useApp();
  const id = useId();

  return (
    <WeatherGate>
      {(snap) => {
        const hour = assessed[selectedIndex];
        if (!hour) return null;
        const a = hour.assessment;
        const ok = a.status === 'ok';
        const tC = a.inputs.temperatureC;
        const rh = a.inputs.relativeHumidity;

        const steps: Array<{ title: string; body: ReactNode }> = [
          {
            title: t('explain.step.inputs'),
            body: (
              <p className="num">
                T = {tC === null ? '—' : `${tC.toFixed(1)} °C (${cToF(tC).toFixed(1)} °F)`}, RH = {formatNumber(rh, 0, '%')}
              </p>
            ),
          },
        ];
        if (ok) {
          steps.push(
            {
              title: t('explain.step.formula'),
              body: (
                <>
                  <p>{a.indicator.method === 'simple' ? t('explain.simple') : t('explain.rothfusz')}</p>
                  <p className="num mt-1 text-xs text-faint">
                    {a.indicator.method === 'simple'
                      ? 'HI = 0.5 × (T + 61 + (T − 68) × 1.2 + RH × 0.094)'
                      : 'HI = −42.379 + 2.049T + 10.143RH − 0.2248T·RH − 0.00684T² − 0.0548RH² + 0.00123T²RH + 0.000853T·RH² − 0.00000199T²RH²'}
                  </p>
                </>
              ),
            },
            {
              title: t('explain.step.adjust'),
              body: (
                <p>
                  {a.indicator.method === 'rothfusz_low_rh_adjusted'
                    ? t('explain.lowAdj')
                    : a.indicator.method === 'rothfusz_high_rh_adjusted'
                      ? t('explain.highAdj')
                      : t('explain.noAdj')}
                </p>
              ),
            },
            {
              title: t('explain.step.result'),
              body: (
                <p className="num text-lg font-semibold text-fg">
                  {a.indicator.valueF?.toFixed(1)} °F = {a.indicator.valueC?.toFixed(1)} °C
                </p>
              ),
            },
            {
              title: t('explain.step.band'),
              body: (
                <>
                  <p className="num">
                    {bandText(a)} → <CategoryBadge category={a.category} size="sm" />
                  </p>
                  <BandScale valueF={a.indicator.valueF} label={t('explain.scale')} />
                  <p className="mt-1 text-xs text-faint">
                    <a href={CATEGORY_SOURCE.url} target="_blank" rel="noreferrer">
                      {CATEGORY_SOURCE.name}
                    </a>
                    . Not PMD/NDMA warning thresholds.
                  </p>
                </>
              ),
            },
          );
        } else {
          steps.push({ title: t('explain.step.result'), body: <p className="text-amber">{t('explain.unavailable')}</p> });
        }
        steps.push(
          {
            title: t('explain.step.confidence'),
            body: (
              <>
                {ok && <p>{a.confidence === 'limited' ? t('explain.confLimited') : t('explain.confStandard')}</p>}
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted">
                  {a.notes.map((n) => (
                    <li key={n}>{t(`note.${n}`)}</li>
                  ))}
                </ul>
              </>
            ),
          },
          { title: t('explain.step.actions'), body: <p>{t(`guide.${a.category}`)}</p> },
        );

        return (
          <div className="flex flex-col gap-5">
            <PageHeader title={t('explain.title')} intro={t('explain.intro')}>
              <div className="w-48">
                <label htmlFor={id} className="text-xs text-muted">
                  {t('explain.hour')}
                </label>
                <select id={id} className={inputClass} value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))}>
                  {assessed.map((h, i) => (
                    <option key={h.hour.time} value={i}>
                      {formatHour(h.hour.time, snap.timezone)}
                      {i === 0 ? ` (${t('risk.now')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </PageHeader>
            <Panel>
              <ol className="flex flex-col">
                {steps.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
                    <span className="num flex h-7 w-7 items-center justify-center rounded-full border border-line text-sm text-muted">{i + 1}</span>
                    <div className="min-w-0 text-sm text-fg">
                      <h2 className="mb-1 font-semibold">{s.title}</h2>
                      {s.body}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <p className="text-xs text-faint">
              Source:{' '}
              <a href="https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml" target="_blank" rel="noreferrer">
                NWS Weather Prediction Center, The Heat Index Equation
              </a>
              .
            </p>
          </div>
        );
      }}
    </WeatherGate>
  );
}
