import { LANGUAGES, useI18n } from '../i18n';

export function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs text-muted">{t('lang.label')}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-ink p-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            dir={l.dir}
            aria-pressed={lang === l.code}
            onClick={() => setLang(l.code)}
            className={`min-h-9 rounded-md px-2 text-sm transition-colors ${lang === l.code ? 'bg-raised font-semibold text-fg' : 'text-muted hover:text-fg'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {lang !== 'en' && <p className="text-xs leading-relaxed text-faint">{t('lang.draftNotice')}</p>}
    </fieldset>
  );
}
