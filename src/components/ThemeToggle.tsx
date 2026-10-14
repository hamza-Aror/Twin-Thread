import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';

/** One button: shows the theme you will switch to, and says so to screen readers. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const label = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-fg transition-colors hover:bg-raised"
    >
      {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}
