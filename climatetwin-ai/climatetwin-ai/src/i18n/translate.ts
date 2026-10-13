import { en, type MessageKey } from './en';
import { ur } from './ur';
import { sd } from './sd';

export type Lang = 'en' | 'ur' | 'sd';
export type Params = Record<string, string | number>;

export const LANGUAGES: Array<{ code: Lang; label: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ur', label: 'اردو', dir: 'rtl' },
  { code: 'sd', label: 'سنڌي', dir: 'rtl' },
];

const DICTS: Record<Lang, Partial<Record<MessageKey, string>>> = { en, ur, sd };

/** Pure translation function. Falls back to English, then to the key itself. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = DICTS[lang][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
