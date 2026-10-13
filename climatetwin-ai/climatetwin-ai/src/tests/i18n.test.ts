import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { ur } from '../i18n/ur';
import { sd } from '../i18n/sd';
import { translate } from '../i18n/translate';
import { addSuggestion, loadSuggestions, validateSuggestion } from '../services/resourceStore';
import { SAMPLE_RESOURCES } from '../data/resources';

describe('translations', () => {
  const required = Object.keys(en).filter((k) => /^(cat|catDesc|guide|nav)\./.test(k) || /^guidance\.(e|s)/.test(k)) as Array<keyof typeof en>;

  it.each([
    ['ur', ur],
    ['sd', sd],
  ] as const)('%s covers every category, guidance, warning-sign and navigation string', (_name, dict) => {
    const missing = required.filter((k) => !dict[k]);
    expect(missing).toEqual([]);
  });

  it('keeps the same placeholders as English', () => {
    for (const dict of [ur, sd]) {
      for (const [key, value] of Object.entries(dict)) {
        const want = (en[key as keyof typeof en].match(/\{\w+\}/g) ?? []).sort();
        const got = ((value as string).match(/\{\w+\}/g) ?? []).sort();
        expect(got).toEqual(want);
      }
    }
  });

  it('substitutes parameters and falls back to English', () => {
    expect(translate('en', 'status.minutesAgo', { n: 5 })).toBe('5 min ago');
    expect(translate('ur', 'cat.danger')).toBe('خطرہ');
    expect(translate('sd', 'method.endpoint')).toBe(en['method.endpoint']);
  });
});

describe('resources', () => {
  it('ships only sample entries, never marked verified', () => {
    expect(SAMPLE_RESOURCES.length).toBeGreaterThan(0);
    expect(SAMPLE_RESOURCES.every((r) => r.verification === 'sample' && !r.hoursVerified)).toBe(true);
  });

  it('validates suggestions', () => {
    const base = { type: 'water' as const, name: 'Tap', description: '', latitude: 24.8, longitude: 67, hours: '', accessibility: '', areaId: 'karachi' };
    expect(validateSuggestion(base)).toEqual([]);
    expect(validateSuggestion({ ...base, name: '  ' })).toContain('name_required');
    expect(validateSuggestion({ ...base, latitude: Number.NaN })).toContain('invalid_coordinates');
  });

  it('stores suggestions locally as unverified', () => {
    window.localStorage.clear();
    const saved = addSuggestion({ type: 'cooling', name: ' Community hall ', description: '', latitude: 24.86, longitude: 67.01, hours: '', accessibility: '', areaId: 'karachi' }, 1000);
    expect(saved.verification).toBe('unverified_report');
    expect(saved.name).toBe('Community hall');
    expect(loadSuggestions()).toHaveLength(1);
  });
});
