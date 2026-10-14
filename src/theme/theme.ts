/**
 * Theme preference. Light is the default for first-time visitors; a saved
 * choice always wins. The same logic runs as an inline script in index.html
 * before first paint (so there is no flash of the wrong theme); keep the two in sync.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ct:theme';
export const DEFAULT_THEME: Theme = 'light';

/** Parses a stored value. Anything unexpected falls back to the default. */
export function parseTheme(raw: unknown): Theme {
  return raw === 'dark' || raw === 'light' ? raw : DEFAULT_THEME;
}

export function readSavedTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/** Browser chrome colour (mobile address bar), matching --c-ink. */
export const THEME_COLOR: Record<Theme, string> = { light: '#f5f5f7', dark: '#0f1115' };

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}
