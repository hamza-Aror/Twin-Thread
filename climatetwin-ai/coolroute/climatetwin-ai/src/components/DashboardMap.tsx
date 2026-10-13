import { lazy, Suspense, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { NEARBY_KM, useResources } from '../hooks/useResources';
import { RESOURCE_COLORS, externalDirectionsUrl } from '../data/resources';
import type { ResourceType } from '../types/resources';
import { Chip, Panel } from './ui';

// Leaflet is loaded on demand so the rest of the dashboard appears without waiting for the map library.
const ResourceMap = lazy(() => import('./ResourceMap').then((m) => ({ default: m.ResourceMap })));

const TYPES: ResourceType[] = ['water', 'cooling', 'assistance'];

/**
 * The live resource map on the Dashboard. Follows the selected city, shows the same entries as the
 * full Resource map page (shared hook), and never presents sample entries as real facilities.
 */
export function DashboardMap() {
  const { t } = useI18n();
  const { location, navigate } = useApp();
  const { types, toggleType, visible } = useResources(location);
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
            {t(`map.type.${ty}`)}
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
          />
        </Suspense>
        {visible.length === 0 && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex justify-center">
            <div className="pointer-events-auto rounded-xl border border-line bg-panel px-3.5 py-2.5 text-center text-sm text-fg shadow-pop">
              {t('dash.noResources', { km: NEARBY_KM, place: location.name })}{' '}
              <a
                href="#/map"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('map');
                }}
              >
                {t('dash.suggestPlace')}
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
          {t('dash.legendVerified')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-muted" />
          {t('dash.legendUnverified')}
        </span>
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-line p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-fg">{selected.r.name}</div>
              <div className="text-xs text-muted">
                {t(`map.type.${selected.r.type}`)}, <span className="num">{t('map.distance', { km: selected.km.toFixed(1) })}</span>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="shrink-0 text-xs text-muted hover:text-fg">
              {t('common.close')}
            </button>
          </div>
          {selected.r.verification !== 'verified' && (
            <p className="mt-2 text-[13px] text-amber">
              {t(`map.verification.${selected.r.verification}`)}. {selected.r.verification === 'sample' ? t('map.sampleNote') : t('map.suggestIntro')}
            </p>
          )}
          <p className="mt-2 text-[13px] text-muted">
            {t('map.hours')}: {selected.r.hours ?? '—'} {!selected.r.hoursVerified && `(${t('map.hoursUnverified')})`}
          </p>
          <a href={externalDirectionsUrl(selected.r.latitude, selected.r.longitude)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px]">
            {t('map.directions')}
            <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      ) : (
        visible.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-xs font-medium text-faint">{t('dash.nearest')}</h3>
            <ul className="-mx-1">
              {visible.slice(0, 3).map(({ r, km }) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start hover:bg-raised">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[r.type] }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{r.name}</span>
                    <span className="num shrink-0 text-xs text-muted">{t('map.distance', { km: km.toFixed(1) })}</span>
                    <span className="shrink-0 text-xs text-amber">{r.verification === 'verified' ? '' : t(r.verification === 'sample' ? 'dash.sampleShort' : 'dash.unverifiedShort')}</span>
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
