import { useId, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { WeatherGate } from '../components/WeatherGate';
import { Button, CategoryBadge, Notice, PageHeader, Panel, inputClass } from '../components/ui';
import { BandScale } from './ExplainPage';
import { NO_ADJUSTMENT, SCENARIO_LIMITS, SCENARIO_PRESETS, type ScenarioAdjustments, runScenario } from '../services/scenario';
import type { HeatAssessment } from '../types/risk';
import { formatHour, formatNumber, formatSigned, formatTemp } from '../utils/format';

function AssessmentColumn({
  title,
  inputs,
  assessment,
  simulated,
}: {
  title: string;
  inputs: { temperatureC: number | null; relativeHumidity: number | null; windSpeedKmh: number | null };
  assessment: HeatAssessment | null;
  simulated?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl border p-4 ${simulated ? 'demo-hatch border-accent/50' : 'border-line bg-ink'}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-fg">{title}</h2>
        {simulated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            <FlaskConical size={12} aria-hidden />
            {t('sim.badge')}
          </span>
        )}
      </div>
      <dl className="num mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-muted">{t('field.temperatureC')}</dt>
          <dd className="text-fg">{formatTemp(inputs.temperatureC, 1)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('field.relativeHumidity')}</dt>
          <dd className="text-fg">{formatNumber(inputs.relativeHumidity, 0, '%')}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('field.windSpeedKmh')}</dt>
          <dd className="text-fg">{formatNumber(inputs.windSpeedKmh, 0, 'km/h')}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{t('risk.heatIndex')}</div>
          <div className="num text-3xl font-semibold text-fg">{formatTemp(assessment?.indicator.valueC, 1)}</div>
        </div>
        <CategoryBadge category={assessment?.category ?? 'unavailable'} />
      </div>
      <BandScale valueF={assessment?.indicator.valueF ?? null} label={t('explain.scale')} />
    </div>
  );
}

export function SimulatorPage() {
  const { t } = useI18n();
  const { assessed, selectedIndex, setSelectedIndex } = useApp();
  const id = useId();
  const [adj, setAdj] = useState<ScenarioAdjustments>(NO_ADJUSTMENT);
  const [preset, setPreset] = useState<string | null>(null);

  const sliders: Array<{ key: keyof ScenarioAdjustments; label: string; unit: string }> = [
    { key: 'temperatureDeltaC', label: t('sim.tempDelta'), unit: '°C' },
    { key: 'humidityDeltaPct', label: t('sim.rhDelta'), unit: '%' },
    { key: 'windDeltaKmh', label: t('sim.windDelta'), unit: 'km/h' },
  ];

  return (
    <WeatherGate>
      {(snap) => {
        const hour = assessed[selectedIndex];
        if (!hour) return null;
        const r = runScenario(hour.hour, adj);
        const fieldLabel = (f: 'temperatureC' | 'relativeHumidity' | 'windSpeedKmh') => t(`field.${f}`);
        const unit = (f: string) => (f === 'temperatureC' ? '°C' : f === 'relativeHumidity' ? '%' : 'km/h');

        return (
          <div className="flex flex-col gap-5">
            <PageHeader title={t('sim.title')} intro={`${t('sim.intro')} ${t('note.simulated')}`} />

            <Panel>
              <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
                <div>
                  <label htmlFor={`${id}-h`} className="text-sm text-muted">
                    {t('sim.hour')}
                  </label>
                  <select id={`${id}-h`} className={`${inputClass} mt-1.5`} value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))}>
                    {assessed.map((h, i) => (
                      <option key={h.hour.time} value={i}>
                        {formatHour(h.hour.time, snap.timezone)}
                        {i === 0 ? ` (${t('risk.now')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-sm text-muted">{t('sim.presets')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {SCENARIO_PRESETS.map((p) => (
                      <Button
                        key={p.id}
                        ariaPressed={preset === p.id}
                        className={preset === p.id ? 'border-accent text-accent' : ''}
                        onClick={() => {
                          setPreset(p.id);
                          setAdj(p.adjustments);
                        }}
                      >
                        {t(`sim.preset.${p.id}`)}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPreset(null);
                        setAdj(NO_ADJUSTMENT);
                      }}
                    >
                      {t('sim.reset')}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                {sliders.map((s) => {
                  const lim = SCENARIO_LIMITS[s.key];
                  return (
                    <div key={s.key}>
                      <div className="flex items-baseline justify-between">
                        <label htmlFor={`${id}-${s.key}`} className="text-sm text-muted">
                          {s.label}
                        </label>
                        <output htmlFor={`${id}-${s.key}`} className="num text-sm font-semibold text-fg">
                          {formatSigned(adj[s.key], s.key === 'temperatureDeltaC' ? 1 : 0, s.unit)}
                        </output>
                      </div>
                      <input
                        id={`${id}-${s.key}`}
                        type="range"
                        dir="ltr"
                        min={lim.min}
                        max={lim.max}
                        step={lim.step}
                        value={adj[s.key]}
                        onChange={(e) => {
                          setPreset(null);
                          setAdj({ ...adj, [s.key]: Number(e.target.value) });
                        }}
                        className="mt-2 w-full"
                      />
                      <div className="num flex justify-between text-[11px] text-faint" dir="ltr">
                        <span>
                          {lim.min} {s.unit}
                        </span>
                        <span>
                          +{lim.max} {s.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <AssessmentColumn title={`${t('sim.original')} (${formatHour(hour.hour.time, snap.timezone)})`} inputs={r.baseInputs} assessment={r.base} />
              <AssessmentColumn title={t('sim.scenario')} inputs={r.scenarioInputs} assessment={r.scenario} simulated />
            </div>

            {r.errors.length > 0 && (
              <Notice tone="danger" role="alert">
                <ul className="list-disc space-y-0.5 ps-5">
                  {r.errors.map((e) => (
                    <li key={e}>{t(`sim.err.${e}`, { value: formatNumber(r.scenarioInputs.relativeHumidity, 0) })}</li>
                  ))}
                </ul>
              </Notice>
            )}

            <Panel title={t('sim.changes')}>
              {r.changes.length === 0 ? (
                <p className="text-sm text-muted">{t('sim.noChanges')}</p>
              ) : (
                <ul className="num space-y-1 text-sm text-fg">
                  {r.changes.map((c) => (
                    <li key={c.field}>
                      {fieldLabel(c.field)}: {formatNumber(c.from, 1, unit(c.field))} → {formatNumber(c.to, 1, unit(c.field))}
                    </li>
                  ))}
                </ul>
              )}
              {r.ok && r.scenario && r.changes.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-fg">
                  {r.heatIndexDeltaC !== null && <p>{t('sim.hiDelta', { delta: formatSigned(r.heatIndexDeltaC, 1, '°C') })}</p>}
                  <p>
                    {r.categoryChanged
                      ? t('sim.catChanged', { from: t(`cat.${r.base.category}`), to: t(`cat.${r.scenario.category}`) })
                      : t('sim.catSame', { category: t(`cat.${r.scenario.category}`) })}
                  </p>
                </div>
              )}
              {r.changes.some((c) => c.field === 'windSpeedKmh') && <p className="mt-3 text-sm text-muted">{t('sim.windNote')}</p>}
            </Panel>
          </div>
        );
      }}
    </WeatherGate>
  );
}
