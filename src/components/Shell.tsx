import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarClock, ChartLine, Database, LayoutDashboard, MapPin, Menu, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import type { Route } from '../hooks/useHashRoute';
import { useI18n, type MessageKey } from '../i18n';
import { Brand } from './Brand';
import { LocationSearch } from './LocationSearch';
import { LanguageDraftNote, LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { StatusIndicator } from './StatusIndicator';
import { AlertBanner } from './AlertBanner';

const NAV: Array<{ route: Route; key: MessageKey; Icon: typeof Bell }> = [
  { route: 'dashboard', key: 'nav.dashboard', Icon: LayoutDashboard },
  { route: 'outlook', key: 'nav.outlook', Icon: ChartLine },
  { route: 'window', key: 'nav.window', Icon: CalendarClock },
  { route: 'map', key: 'nav.map', Icon: MapPin },
  { route: 'simulator', key: 'nav.simulator', Icon: SlidersHorizontal },
  { route: 'alerts', key: 'nav.alerts', Icon: Bell },
  { route: 'method', key: 'nav.method', Icon: Database },
];

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
                className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] no-underline transition-colors ${
                  active ? 'bg-raised font-semibold text-fg' : 'text-muted hover:bg-raised/70 hover:text-fg'
                }`}
              >
                <Icon size={17} aria-hidden className={active ? 'text-accent' : ''} />
                <span className="flex-1">{t(key)}</span>
                {r === 'alerts' && alerts.visible.length > 0 && (
                  <span className="num min-w-5 rounded-full bg-alert px-1.5 text-center text-xs font-semibold text-white">{alerts.visible.length}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DemoToggle() {
  const { t } = useI18n();
  const { demoMode, setDemoMode } = useApp();
  return (
    <button
      type="button"
      onClick={() => setDemoMode(!demoMode)}
      className="w-full rounded-[10px] border border-line px-3 py-2 text-start text-xs text-muted transition-colors hover:bg-raised hover:text-fg"
      aria-pressed={demoMode}
    >
      {demoMode ? t('status.demoOff') : t('status.demoOn')}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { route, weather } = useApp();
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

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
        {t('app.skip')}
      </a>

      {/* Desktop sidebar: brand and navigation (the column keeps the panel colour for the full page height) */}
      <div className="hidden border-e border-line bg-panel lg:block">
      <aside className="sticky top-0 flex h-screen flex-col gap-7 overflow-y-auto px-3 py-5">
        <div className="px-2">
          <Brand />
        </div>
        <NavList />
        <div className="mt-auto flex flex-col gap-3 px-1">
          <LanguageDraftNote />
          <DemoToggle />
        </div>
      </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Top bar: search, data status, language, theme */}
        <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Brand size={28} />
            </div>
            <div className="hidden min-w-0 flex-1 sm:block lg:max-w-md">
              <LocationSearch />
            </div>
            <div className="ms-auto flex items-center gap-2">
              <div className="hidden md:block">
                <StatusIndicator />
              </div>
              <div className="hidden sm:block">
                <LanguageSelector />
              </div>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-fg lg:hidden"
                aria-label={menuOpen ? t('app.closeMenu') : t('app.menu')}
              >
                {menuOpen ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
              </button>
            </div>
          </div>
          {/* Small screens: search gets its own full-width row */}
          <div className="px-4 pb-2.5 sm:hidden">
            <LocationSearch />
          </div>
        </header>

        {menuOpen && (
          <div id="mobile-menu" className="fixed inset-x-0 top-[106px] bottom-0 z-30 flex flex-col gap-5 overflow-y-auto border-t border-line bg-panel px-4 py-5 sm:top-[57px] lg:hidden">
            <StatusIndicator />
            <NavList onNavigate={() => setMenuOpen(false)} />
            <div className="sm:hidden">
              <LanguageSelector />
            </div>
            <LanguageDraftNote />
            <DemoToggle />
          </div>
        )}

        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8">
          {weather.snapshot?.source === 'demo' && (
            <div className="mb-5">
              <div role="note" className="demo-hatch rounded-xl border border-accent/40 px-3.5 py-2.5 text-sm text-fg">
                {t('status.demoBanner', { place: weather.snapshot.location.name })}
              </div>
            </div>
          )}
          <AlertBanner />
          {children}
        </main>

        <footer className="mx-auto w-full max-w-[1200px] px-4 pb-8 sm:px-6 lg:px-8">
          <div className="border-t border-line pt-4 text-xs leading-relaxed text-faint">
            <p className="max-w-3xl">{t('app.disclaimer')}</p>
            <p className="mt-1">{t('app.attribution')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
