/**
 * Plain-language reasons for an assessment ("Why this level").
 *
 * Replaces the old step-by-step "Why this risk level" page for everyday users:
 * it states which weather factors drive the result, in words, using values the
 * engine already computed. The technical steps are still available in the
 * "Learn how this is calculated" expander and on the methodology page.
 * Pure function: no React, unit-tested.
 */
import type { MessageKey } from '../../i18n/en';
import type { CategoryRule, HeatAssessment } from '../../types/risk';
import { fToC } from './heatIndex';
import { ltr } from '../../utils/format';

export interface Reason {
  key: MessageKey;
  params: Record<string, string | number>;
}

export interface ReasonContext {
  uvIndex: number | null;
  isDay: boolean | null;
}

/** "39–52 °C" style range for a category band, in rounded Celsius. */
export function bandRangeC(rule: CategoryRule): string {
  const c = (f: number) => Math.round(fToC(f));
  if (rule.minF === null && rule.maxF !== null) return `< ${c(rule.maxF)} °C`;
  if (rule.maxF === null && rule.minF !== null) return `≥ ${c(rule.minF)} °C`;
  return `${c(rule.minF as number)}–${c(rule.maxF as number)} °C`;
}

// Values are wrapped in left-to-right isolates so "31.6 °C" never reverses inside Urdu or Sindhi sentences.
const fmtC = (v: number) => ltr(`${v.toFixed(1)} °C`);
const signed = (v: number) => ltr(`${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} °C`);

/**
 * Returns the reasons in reading order: temperature, humidity effect, sun/night, band.
 * Returns an empty list when no assessment is available (the interface then shows why).
 */
export function explainAssessment(a: HeatAssessment, ctx: ReasonContext): Reason[] {
  if (a.status !== 'ok' || a.indicator.valueC === null || a.inputs.temperatureC === null || a.inputs.relativeHumidity === null || !a.rule) return [];
  const t = a.inputs.temperatureC;
  const rh = Math.round(a.inputs.relativeHumidity);
  const hi = a.indicator.valueC;
  const delta = hi - t;
  const reasons: Reason[] = [{ key: 'why.temp', params: { t: fmtC(t) } }];

  if (delta >= 1) reasons.push({ key: 'why.humid', params: { rh: ltr(`${rh}`), delta: signed(delta) } });
  else if (delta <= -1) reasons.push({ key: 'why.cooler', params: { rh } });
  else reasons.push({ key: 'why.dry', params: { rh } });

  if (ctx.isDay && ctx.uvIndex !== null && ctx.uvIndex >= 6) reasons.push({ key: 'why.sun', params: { uv: ctx.uvIndex.toFixed(0) } });
  else if (ctx.isDay === false) reasons.push({ key: 'why.night', params: {} });

  if (a.category === 'lower') reasons.push({ key: 'why.bandLower', params: { hi: fmtC(hi), max: ltr(`${Math.round(fToC(a.rule.maxF as number))} °C`) } });
  else reasons.push({ key: 'why.band', params: { hi: fmtC(hi), category: a.category, range: ltr(bandRangeC(a.rule)) } });

  if (a.confidence === 'limited') reasons.push({ key: 'why.approx', params: {} });
  return reasons;
}
