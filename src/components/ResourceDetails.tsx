/**
 * Details of one resource, used by the Dashboard map and the Resource map page.
 * Every entry states what its data actually establishes (and what it does not).
 */
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n, type MessageKey } from '../i18n';
import type { CommunityResource } from '../types/resources';
import { RESOURCE_COLORS, externalDirectionsUrl } from '../data/resources';
import type { NearbyResource, PlacesState } from '../hooks/useResources';
import { RADIUS_M } from '../services/places/overpass';
import { minutesSince } from '../utils/format';

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

export function displayName(r: CommunityResource, t: T): string {
  return r.name ?? t(`map.unnamed.${r.type}`);
}

export function caveatKey(r: CommunityResource): MessageKey {
  if (r.verification === 'sample') return 'map.caveat.demo';
  if (r.verification === 'unverified_report') return 'map.caveat.report';
  if (r.verification === 'official') return 'map.caveat.official';
  return `map.caveat.${r.type === 'cooling' || r.type === 'assistance' ? 'report' : r.type}` as MessageKey;
}

/** Short status tag shown in lists. */
export function sourceTag(r: CommunityResource, t: T): string {
  if (r.verification === 'sample') return t('dash.sampleShort');
  if (r.verification === 'unverified_report') return t('dash.unverifiedShort');
  if (r.verification === 'official') return t('map.officialShort');
  return t('map.mappedShort');
}

export function ResourceDetails({ item, footer, onClose }: { item: NearbyResource; footer?: ReactNode; onClose?: () => void }) {
  const { t } = useI18n();
  const { r, km } = item;
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-fg">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[r.type] }} />
            <span className="min-w-0 break-words">{displayName(r, t)}</span>
          </div>
          <div className="text-xs text-muted">
            {t(`map.type.${r.type}`)}, <span className="num">{t('map.distance', { km: km.toFixed(1) })}</span>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="shrink-0 text-xs text-muted hover:text-fg">
            {t('common.close')}
          </button>
        )}
      </div>
      <p className={`rounded-lg px-2.5 py-2 text-[13px] ${r.verification === 'official' ? 'bg-teal/10 text-fg' : 'bg-amber/10 text-fg'}`}>{t(caveatKey(r))}</p>
      {r.description && <p className="text-fg">{r.description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {r.address && (
          <>
            <dt className="text-muted">{t('map.address')}</dt>
            <dd className="min-w-0 break-words text-fg">{r.address}</dd>
          </>
        )}
        <dt className="text-muted">{t('map.hours')}</dt>
        <dd className="text-fg">
          {r.hours ?? t('map.unknown')} {r.hours && !r.hoursVerified && <span className="text-amber">({t('map.hoursUnverified')})</span>}
        </dd>
        {r.access && (
          <>
            <dt className="text-muted">{t('map.access')}</dt>
            <dd className="num text-fg">{r.access}</dd>
          </>
        )}
        {r.osm && (
          <>
            <dt className="text-muted">{t('map.evidence')}</dt>
            <dd className="num min-w-0 break-words text-fg" dir="ltr">
              {r.osm.evidence.join(', ')}
            </dd>
          </>
        )}
        <dt className="text-muted">{t('map.sourceLabel')}</dt>
        <dd className="text-fg">{t(`map.source.${r.source}`)}</dd>
      </dl>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {r.osm && (
          <a href={r.osm.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px]">
            {t('map.osmLink')}
            <ExternalLink size={13} aria-hidden />
          </a>
        )}
        <a href={externalDirectionsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px]">
          {t('map.directions')}
          <ExternalLink size={13} aria-hidden />
        </a>
      </div>
      <p className="text-xs text-faint">{t('map.directionsNote')}</p>
      {footer}
    </div>
  );
}

/** Legend explaining what each marker means and what is not available. */
export function ResourceLegend() {
  const { t } = useI18n();
  const items: Array<[string, MessageKey]> = [
    [RESOURCE_COLORS.water, 'legend.water'],
    [RESOURCE_COLORS.park, 'legend.park'],
    [RESOURCE_COLORS.indoor, 'legend.indoor'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label={t('legend.title')}>
      {items.map(([color, key]) => (
        <li key={key} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {t(key)}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-muted" />
        {t('legend.dashed')}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-line-strong" />
        {t('legend.official')}
      </li>
    </ul>
  );
}

/** Loading / error / empty / attribution line for map data. */
export function PlacesStatusLine({ state, count, place, onRetry }: { state: PlacesState; count: number; place: string; onRetry: () => void }) {
  const { t } = useI18n();
  if (state.status === 'demo') return <p className="text-xs text-accent">{t('places.demo')}</p>;
  if (state.status === 'loading')
    return (
      <p className="text-xs text-muted" role="status">
        {t('places.loading', { place })}
      </p>
    );
  if (state.status === 'error')
    return (
      <p className="text-xs text-alert" role="alert">
        {t(`places.error.${state.error ?? 'network'}`)}{' '}
        <button type="button" onClick={onRetry} className="font-medium text-accent underline underline-offset-2">
          {t('places.retry')}
        </button>
      </p>
    );
  return (
    <p className="text-xs text-faint">
      {count === 0 && <span className="text-fg">{t('places.empty', { place, water: RADIUS_M.water / 1000, other: RADIUS_M.park / 1000 })} </span>}
      {t('places.attribution')}
      {state.fetchedAt && state.fromCache && ` ${t('places.cached', { n: minutesSince(state.fetchedAt) })}`}
    </p>
  );
}
