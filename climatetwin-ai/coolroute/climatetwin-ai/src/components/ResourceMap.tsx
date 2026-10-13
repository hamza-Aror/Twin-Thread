import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommunityResource } from '../types/resources';
import { RESOURCE_COLORS } from '../data/resources';

interface Props {
  center: [number, number];
  resources: CommunityResource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  picking: boolean;
  onPick: (lat: number, lon: number) => void;
  pickedPoint: [number, number] | null;
  centerLabel: string;
  ariaLabel: string;
  heightClass?: string;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() < 12 ? 13 : map.getZoom());
  }, [map, center]);
  return null;
}

function PickHandler({ picking, onPick }: { picking: boolean; onPick: (lat: number, lon: number) => void }) {
  const map = useMapEvents({
    click(e) {
      if (picking) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    map.getContainer().classList.toggle('picking', picking);
  }, [map, picking]);
  return null;
}

/**
 * OpenStreetMap tiles via Leaflet. OSM's tile usage policy requires visible attribution
 * and forbids heavy use; this is fine for a prototype demo but a production deployment
 * should use a tile provider with a suitable plan.
 */
export function ResourceMap({ center, resources, selectedId, onSelect, picking, onPick, pickedPoint, centerLabel, ariaLabel, heightClass = 'h-[420px]' }: Props) {
  return (
    <div dir="ltr" className={`w-full overflow-hidden rounded-xl border border-line ${heightClass}`} role="region" aria-label={ariaLabel}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Recenter center={center} />
        <PickHandler picking={picking} onPick={onPick} />
        <CircleMarker center={center} radius={6} pathOptions={{ color: 'var(--c-panel)', weight: 3, fillColor: 'var(--c-accent)', fillOpacity: 1 }}>
          <Tooltip>{centerLabel}</Tooltip>
        </CircleMarker>
        {resources.map((r) => {
          const color = RESOURCE_COLORS[r.type];
          const selected = r.id === selectedId;
          return (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={selected ? 12 : 9}
              pathOptions={{
                color: selected ? 'var(--c-fg)' : color,
                weight: selected ? 3 : 2,
                fillColor: color,
                fillOpacity: r.verification === 'verified' ? 0.9 : 0.45,
                dashArray: r.verification === 'verified' ? undefined : '4 3',
              }}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Tooltip>{r.name}</Tooltip>
            </CircleMarker>
          );
        })}
        {pickedPoint && <CircleMarker center={pickedPoint} radius={8} pathOptions={{ color: 'var(--c-amber)', weight: 3, fillOpacity: 0 }} />}
      </MapContainer>
    </div>
  );
}
