import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MessageKey } from './en';
import { LANGUAGES, translate, type Lang, type Params } from './translate';
import { readJSON, writeJSON } from '../utils/storage';

export { LANGUAGES, translate };
export type { Lang, MessageKey, Params };

interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'ct:lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = readJSON<string>(STORAGE_KEY, 'en');
    return saved === 'ur' || saved === 'sd' ? saved : 'en';
  });
  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeJSON(STORAGE_KEY, l);
  }, []);
  const t = useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
