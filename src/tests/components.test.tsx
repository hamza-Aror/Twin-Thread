import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { LanguageSelector } from '../components/LanguageSelector';
import { CategoryBadge } from '../components/ui';
import { HeatRibbon } from '../components/HeatRibbon';
import { ThemeToggle } from '../components/ThemeToggle';
import { ThemeProvider } from '../theme/ThemeProvider';
import { assessHours } from '../services/risk/assess';
import { generateDemoSnapshot } from '../data/demoWeather';
import { DEFAULT_LOCATION } from '../data/locations';

describe('interface components', () => {
  it('switching to Urdu sets right-to-left layout', () => {
    window.localStorage.clear();
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>,
    );
    const select = screen.getByLabelText('Language');
    fireEvent.change(select, { target: { value: 'ur' } });
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ur');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('theme toggle starts in light mode, switches to dark and remembers it', () => {
    window.localStorage.clear();
    const ui = (
      <ThemeProvider>
        <I18nProvider>
          <ThemeToggle />
        </I18nProvider>
      </ThemeProvider>
    );
    const { unmount } = render(ui);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('ct:theme')).toBe('dark');
    unmount();
    render(ui);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('category badge shows the translated label', () => {
    render(
      <I18nProvider>
        <CategoryBadge category="danger" />
      </I18nProvider>,
    );
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('heat ribbon supports keyboard selection', () => {
    const snap = generateDemoSnapshot(DEFAULT_LOCATION, Date.UTC(2026, 5, 1, 1, 0, 0));
    const hours = assessHours(snap.hourly);
    let selected = 0;
    const { rerender } = render(
      <I18nProvider>
        <HeatRibbon hours={hours} timeZone={snap.timezone} selectedIndex={selected} onSelect={(i) => (selected = i)} label="Hours" />
      </I18nProvider>,
    );
    const group = screen.getByRole('group', { name: 'Hours' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(selected).toBe(1);
    rerender(
      <I18nProvider>
        <HeatRibbon hours={hours} timeZone={snap.timezone} selectedIndex={selected} onSelect={(i) => (selected = i)} label="Hours" />
      </I18nProvider>,
    );
    fireEvent.keyDown(group, { key: 'End' });
    expect(selected).toBe(23);
    expect(screen.getAllByRole('button')).toHaveLength(24);
  });
});
