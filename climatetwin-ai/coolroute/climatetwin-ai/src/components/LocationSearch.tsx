/**
 * Worldwide city search (ARIA combobox pattern).
 *
 * - Shows the selected place when idle; focusing selects the text so typing replaces it.
 * - Debounced requests (300 ms), the previous request is cancelled when typing continues.
 * - Arrow keys move through results, Enter chooses, Escape closes and restores the current place.
 * - Before typing: recent places and a few suggestions (quick picks, not a limit).
 * - Typing "lat, lon" offers those coordinates directly.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { History, LoaderCircle, MapPin, Search } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { PRESET_LOCATIONS } from '../data/locations';
import { MIN_QUERY_LENGTH, describeLocation, parseQuery, searchPlaces } from '../services/weather/geocoding';
import { addRecent, loadRecent, saveRecent } from '../services/weather/locationSync';
import type { WeatherLocation } from '../types/weather';

type Status = 'idle' | 'short' | 'loading' | 'done' | 'error';

interface Option {
  loc: WeatherLocation;
  group: 'recent' | 'suggested' | 'results' | 'coords';
}

export function LocationSearch({ autoFocus = false, onChosen }: { autoFocus?: boolean; onChosen?: () => void }) {
  const { t } = useI18n();
  const { location, setLocation } = useApp();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [coordsOption, setCoordsOption] = useState<WeatherLocation | null>(null);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<WeatherLocation[]>(loadRecent);

  const currentLabel = describeLocation(location);
  const trimmed = query.trim();

  // Search as the user types (debounced, cancellable).
  useEffect(() => {
    if (!editing) return;
    setActive(-1);
    const parsed = parseQuery(trimmed);
    if (!trimmed) {
      setStatus('idle');
      setResults([]);
      setCoordsOption(null);
      return;
    }
    if (!parsed.coordinates && parsed.name.length < MIN_QUERY_LENGTH) {
      setStatus('short');
      setResults([]);
      setCoordsOption(null);
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const outcome = await searchPlaces(trimmed, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (outcome.kind === 'coordinates') {
          setCoordsOption(outcome.location);
          setResults([]);
          setStatus('done');
        } else if (outcome.kind === 'results') {
          setCoordsOption(null);
          setResults(outcome.locations);
          setStatus('done');
        } else {
          setStatus('short');
        }
      } catch {
        // Network, timeout, HTTP or malformed response (GeocodingError): show the error state, never invented results.
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus('error');
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, editing]);

  const options: Option[] = useMemo(() => {
    if (!editing) return [];
    if (coordsOption) return [{ loc: coordsOption, group: 'coords' }];
    if (trimmed) return results.map((loc) => ({ loc, group: 'results' as const }));
    const recentIds = new Set(recent.map((r) => r.id));
    return [
      ...recent.map((loc) => ({ loc, group: 'recent' as const })),
      ...PRESET_LOCATIONS.filter((p) => !recentIds.has(p.id)).map((loc) => ({ loc, group: 'suggested' as const })),
    ];
  }, [editing, coordsOption, trimmed, results, recent]);

  const open = editing && (options.length > 0 || status !== 'idle');

  const choose = (loc: WeatherLocation) => {
    setLocation(loc);
    const next = addRecent(recent, loc);
    setRecent(next);
    saveRecent(next);
    setEditing(false);
    setQuery('');
    setStatus('idle');
    inputRef.current?.blur();
    onChosen?.();
  };

  const cancel = () => {
    setEditing(false);
    setQuery('');
    setStatus('idle');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!editing) setEditing(true);
      setActive((a) => (options.length ? (a + 1) % options.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = options[active] ?? (trimmed ? options[0] : undefined);
      if (pick) choose(pick.loc);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      inputRef.current?.blur();
    }
  };

  const statusText =
    status === 'short'
      ? t('search.short')
      : status === 'loading'
        ? t('search.loading')
        : status === 'error'
          ? t('search.error')
          : status === 'done' && options.length === 0
            ? t('search.none', { q: trimmed })
            : status === 'done'
              ? t('search.results', { n: options.length })
              : '';
  const showExactHint = status === 'done' && parseQuery(trimmed).name.length === 2 && !coordsOption;

  const groupLabel: Record<Option['group'], string> = {
    recent: t('search.recent'),
    suggested: t('search.suggested'),
    results: '',
    coords: '',
  };

  return (
    <div className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">
        {t('search.label')}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
          {status === 'loading' ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
        </span>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-describedby={`${id}-status`}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={t('search.placeholder')}
          value={editing ? query : currentLabel}
          onFocus={(e) => {
            if (!editing) {
              setEditing(true);
              setQuery('');
            }
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setEditing(true);
            setQuery(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Let a click on an option register before closing.
            window.setTimeout(() => {
              if (document.activeElement !== inputRef.current) cancel();
            }, 150);
          }}
          className="h-10 w-full rounded-full border border-line bg-raised ps-9 pe-4 text-[14px] text-fg placeholder:text-faint focus:border-accent focus:bg-panel focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {editing ? statusText : t('search.current', { place: currentLabel })}
      </p>

      {open && (
        <div className="pop-in absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-pop">
          {statusText && !(status === 'done' && options.length > 0) && (
            <p className={`px-4 py-3 text-sm ${status === 'error' ? 'text-alert' : 'text-muted'}`}>{statusText}</p>
          )}
          {showExactHint && <p className="px-4 pt-3 text-xs text-faint">{t('search.exactOnly')}</p>}
          {options.length > 0 && (
            <ul id={`${id}-list`} role="listbox" aria-label={t('search.label')} className="max-h-[min(60vh,360px)] overflow-y-auto py-1.5">
              {options.map((o, i) => {
                const header = i === 0 || options[i - 1].group !== o.group ? groupLabel[o.group] : '';
                const secondary = [o.loc.region, o.loc.country].filter(Boolean).filter((p, j, a) => a.indexOf(p) === j && p !== o.loc.name).join(', ');
                return (
                  <li key={`${o.group}-${o.loc.id}`} role="presentation">
                    {header && <div className="px-4 pt-2 pb-1 text-xs font-medium text-faint">{header}</div>}
                    <div
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o.loc)}
                      onMouseEnter={() => setActive(i)}
                      className={`mx-1.5 flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 ${i === active ? 'bg-raised' : ''}`}
                    >
                      {o.group === 'recent' ? (
                        <History size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
                      ) : (
                        <MapPin size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">
                          {o.group === 'coords' ? t('search.useCoords', { coords: o.loc.name }) : o.loc.name}
                        </span>
                        {secondary && <span className="block truncate text-xs text-muted">{secondary}</span>}
                      </span>
                      {o.loc.id === location.id && <span className="ms-auto mt-0.5 shrink-0 text-xs text-accent">✓</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!trimmed && <p className="border-t border-line px-4 py-2.5 text-xs text-faint">{t('search.tip')}</p>}
        </div>
      )}
    </div>
  );
}
