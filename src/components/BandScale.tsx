import { CATEGORY_COLORS, CATEGORY_RULES } from '../services/risk/categories';
import { fToC } from '../services/risk/heatIndex';

const SCALE_MIN = 70;
const SCALE_MAX = 140;
const pct = (f: number) => `${((Math.min(Math.max(f, SCALE_MIN), SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`;

/**
 * Horizontal heat-index scale with the NWS category bands and a marker at the computed value.
 * Bands are defined in °F (their source unit); labels are shown in °C.
 */
export function BandScale({ valueF, label }: { valueF: number | null; label: string }) {
  return (
    <div dir="ltr" className="mt-2" role="img" aria-label={label}>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full">
        {CATEGORY_RULES.map((r) => {
          const from = r.minF ?? SCALE_MIN;
          const to = r.maxF ?? SCALE_MAX;
          return (
            <div
              key={r.category}
              className="absolute top-0 h-full"
              style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)} - 2px)`, backgroundColor: CATEGORY_COLORS[r.category] }}
            />
          );
        })}
      </div>
      {valueF !== null && (
        <div className="relative h-4">
          <div className="absolute -top-4 h-5 w-[3px] -translate-x-1/2 rounded-full bg-fg ring-2 ring-panel" style={{ left: pct(valueF) }} />
        </div>
      )}
      <div className="num relative h-4 text-[11px] text-faint">
        {[80, 90, 103, 125].map((f) => (
          <span key={f} className="absolute -translate-x-1/2" style={{ left: pct(f) }}>
            {Math.round(fToC(f))}°C
          </span>
        ))}
      </div>
    </div>
  );
}
