import { useId } from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, useI18n, type Lang } from '../i18n';

/** Compact language menu for the top bar. A native select keeps it accessible everywhere. */
export function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  const id = useId();
  return (
    <div className="relative flex shrink-0 items-center">
      <label htmlFor={id} className="sr-only">
        {t('lang.label')}
      </label>
      <Languages size={15} aria-hidden className="pointer-events-none absolute start-2.5 text-muted" />
      <select
        id={id}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="h-9 appearance-none rounded-full border border-line bg-panel ps-8 pe-3 text-[13px] text-fg hover:bg-raised focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LanguageDraftNote() {
  const { lang, t } = useI18n();
  if (lang === 'en') return null;
  return <p className="text-xs leading-relaxed text-faint">{t('lang.draftNotice')}</p>;
}
