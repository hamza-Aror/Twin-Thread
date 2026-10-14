import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { useResources } from '../hooks/useResources';
import { RESOURCE_COLORS } from '../data/resources';
import type { ResourceType } from '../types/resources';
import { Chip, Panel } from './ui';
import { PlacesStatusLine, ResourceDetails, ResourceLegend, displayName, sourceTag } from './ResourceDetails';

// Leaflet is loaded on demand so the rest of the dashboard appears without waiting for the map library.
const ResourceMap = lazy(() => import('./ResourceMap').then((m) => ({ default: m.ResourceMap })));

const TYPES: Array<Extract<ResourceType, 'water' | 'park' | 'indoor'>> = ['water', 'park', 'indoor'];

/**
 * The live resource map on the Dashboard: real OpenStreetMap places near the selected city
 * (demo entries only in demo mode), sharing data with the full Resource map page.
 */
export function DashboardMap() {
  const { t } = useI18n();
  const { location, navigate, demoMode } = useApp();
  const { types, toggleType, visible, counts, places, retry } = useResources(location, demoMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new city clears the selection so details from the previous city never linger.
  useEffect(() => setSelectedId(null), [location.id]);

  const selected = visible.find((x) => x.r.id === selectedId) ?? null;
  const openFullMap = (
    <a
      href="#/map"
      onClick={(e) => {
        e.preventDefault();
        navigate('map');
      }}
      className="text-[13px] font-medium no-underline hover:underline"
    >
      {t('dash.openMap')}
    </a>
  );

  return (
    <Panel title={t('dash.mapTitle')} aside={openFullMap} className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={t('map.filters')}>
        {TYPES.map((ty) => (
          <Chip key={ty} pressed={types[ty]} onClick={() => toggleType(ty)} color={RESOURCE_COLORS[ty]}>
            {t(`map.chip.${ty}`)}
            {places.status !== 'loading' && <span className="num text-faint">{counts[ty]}</span>}
          </Chip>
        ))}
      </div>

      {/* The map grows to fill the column beside the risk summary on wide screens. */}
      <div className="relative min-h-[300px] flex-1 lg:min-h-[380px]">
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center rounded-xl border border-line bg-raised text-sm text-muted">{t('dash.loadingMap')}</div>}>
          <ResourceMap
            center={[location.latitude, location.longitude]}
            resources={visible.map((x) => x.r)}
            selectedId={selectedId}
            onSelect={setSelectedId}
            picking={false}
            onPick={() => undefined}
            pickedPoint={null}
            centerLabel={`${t('map.center')}: ${location.name}`}
            ariaLabel={t('map.mapLabel')}
            heightClass="absolute inset-0"
            labelFor={(r) => displayName(r, t)}
          />
        </Suspense>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <ResourceLegend />
        <PlacesStatusLine state={places} count={visible.length} place={location.name} onRetry={retry} />
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-line p-3">
          <ResourceDetails item={selected} onClose={() => setSelectedId(null)} />
        </div>
      ) : (
        visible.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-xs font-medium text-faint">{t('dash.nearest')}</h3>
            <ul className="-mx-1">
              {visible.slice(0, 4).map(({ r, km }) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start hover:bg-raised">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[r.type] }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{displayName(r, t)}</span>
                    <span className="num shrink-0 text-xs text-muted">{t('map.distance', { km: km.toFixed(1) })}</span>
                    <span className={`shrink-0 text-xs ${r.verification === 'mapped' ? 'text-muted' : 'text-amber'}`}>{sourceTag(r, t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </Panel>
  );
}
