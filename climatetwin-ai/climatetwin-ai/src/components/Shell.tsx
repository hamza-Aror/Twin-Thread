import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarClock, ChartLine, Database, LayoutDashboard, ListOrdered, MapPin, Menu, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import type { Route } from '../hooks/useHashRoute';
import { useI18n, type MessageKey } from '../i18n';
import { LocationPicker } from './LocationPicker';
import { LanguageSelector } from './LanguageSelector';
import { StatusIndicator } from './StatusIndicator';
import { AlertBanner } from './AlertBanner';

const NAV: Array<{ route: Route; key: MessageKey; Icon: typeof Bell }> = [
  { route: 'overview', key: 'nav.overview', Icon: LayoutDashboard },
  { route: 'outlook', key: 'nav.outlook', Icon: ChartLine },
  { route: 'explain', key: 'nav.explain', Icon: ListOrdered },
  { route: 'window', key: 'nav.window', Icon: CalendarClock },
  { route: 'map', key: 'nav.map', Icon: MapPin },
  { route: 'simulator', key: 'nav.simulator', Icon: SlidersHorizontal },
  { route: 'alerts', key: 'nav.alerts', Icon: Bell },
  { route: 'method', key: 'nav.method', Icon: Database },
];

function Brand() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#1a2a42" />
        <rect x="5" y="19" width="4" height="7" rx="1" fill="#2BB3A3" />
        <rect x="11" y="15" width="4" height="11" rx="1" fill="#E8C547" />
        <rect x="17" y="10" width="4" height="16" rx="1" fill="#F0913A" />
        <rect x="23" y="6" width="4" height="20" rx="1" fill="#E5484D" />
      </svg>
      <div className="leading-tight">
        <div className="font-sans text-[15px] font-semibold text-fg">ClimateTwin AI</div>
        <div className="text-xs text-faint">{t('app.tagline')}</div>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const { route, navigate, alerts } = useApp();
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-0.5">
        {NAV.map(({ route: r, key, Icon }) => {
          const active = r === route;
          return (
            <li key={r}>
              <a
                href={`#/${r}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(r);
                  onNavigate?.();
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
                  active ? 'bg-raised font-semibold text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg'
                }`}
              >
                <Icon size={17} aria-hidden className={active ? 'text-accent' : ''} />
                <span className="flex-1">{t(key)}</span>
                {r === 'alerts' && alerts.visible.length > 0 && (
                  <span className="num rounded-full bg-alert px-1.5 text-xs font-semibold text-white">{alerts.visible.length}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { route, demoMode, setDemoMode, weather } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const prevRoute = useRef(route);

  // Move focus to the new page heading after navigation (screen readers announce it).
  // Compares with the previous route rather than a "first render" flag, which React
  // StrictMode's double-invoked effects would consume and then steal focus on load.
  useEffect(() => {
    if (prevRoute.current === route) return;
    prevRoute.current = route;
    const h = document.getElementById('page-title');
    (h ?? mainRef.current)?.focus();
    window.scrollTo({ top: 0 });
  }, [route]);

  const demoToggle = (
    <button
      type="button"
      onClick={() => setDemoMode(!demoMode)}
      className="w-full rounded-lg border border-line px-3 py-2 text-start text-xs text-muted hover:text-fg"
      aria-pressed={demoMode}
    >
      {demoMode ? t('status.demoOff') : t('status.demoOn')}
    </button>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-ink">
        {t('app.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-e border-line bg-panel px-4 py-5 lg:flex">
        <Brand />
        <LocationPicker />
        <NavList />
        <div className="mt-auto flex flex-col gap-4">
          <LanguageSelector />
          {demoToggle}
          <p className="text-xs text-faint">{t('app.team')}</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-fg"
          aria-label={menuOpen ? t('app.closeMenu') : t('app.menu')}
        >
          {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>
      </header>
      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 top-[65px] bottom-0 z-30 flex flex-col gap-5 overflow-y-auto bg-panel px-4 py-5 lg:hidden">
          <LocationPicker />
          <NavList onNavigate={() => setMenuOpen(false)} />
          <LanguageSelector />
          {demoToggle}
        </div>
      )}

      <div className="min-w-0">
        <div className="border-b border-line bg-ink px-4 py-2.5 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="max-w-3xl text-xs text-muted">{t('app.disclaimer')}</p>
            <StatusIndicator />
          </div>
        </div>
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:px-8 sm:py-8">
          {weather.snapshot?.source === 'demo' && (
            <div className="mb-4">
              <div role="note" className="demo-hatch rounded-lg border border-accent/50 px-3.5 py-2.5 text-sm text-fg">
                {t('status.demoBanner', { place: weather.snapshot.location.name })}
              </div>
            </div>
          )}
          <AlertBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
