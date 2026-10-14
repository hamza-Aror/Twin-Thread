/**
 * The 24-hour heat ribbon: one bar per forecast hour, height = heat index, colour = category.
 * It doubles as the hour picker (roving tab index, arrow keys). Always laid out left-to-right
 * so time reads the same way as the chart in every language.
 */
import { useRef, type KeyboardEvent } from 'react';
import type { AssessedHour } from '../types/risk';
import { CATEGORY_COLORS } from '../services/risk/categories';
import { formatHour, formatTemp } from '../utils/format';
import { useI18n } from '../i18n';

interface Props {
  hours: AssessedHour[];
  timeZone: string;
  selectedIndex?: number;
  onSelect?: (i: number) => void;
  /** Inclusive index range to outline (e.g. the chosen safe window). */
  highlight?: [number, number] | null;
  height?: number;
  label: string;
}

export function HeatRibbon({ hours, timeZone, selectedIndex, onSelect, highlight, height = 76, label }: Props) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const values = hours.map((h) => h.assessment.indicator.valueC).filter((v): v is number => v !== null);
  const min = values.length ? Math.min(...values) - 2 : 0;
  const max = values.length ? Math.max(...values) : 1;
  const scale = (v: number) => 0.28 + 0.72 * ((v - min) / Math.max(1, max - min));
  const interactive = Boolean(onSelect);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect || selectedIndex === undefined) return;
    let next = selectedIndex;
    if (e.key === 'ArrowRight') next = Math.min(hours.length - 1, selectedIndex + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, selectedIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = hours.length - 1;
    else return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };

  return (
    <div dir="ltr" className="w-full overflow-x-auto pb-1">
      <div role="group" aria-label={label} onKeyDown={onKey} className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
        {hours.map((h, i) => {
          const a = h.assessment;
          const color = CATEGORY_COLORS[a.category];
          const v = a.indicator.valueC;
          const selected = i === selectedIndex;
          const inHighlight = highlight ? i >= highlight[0] && i <= highlight[1] : false;
          const time = formatHour(h.hour.time, timeZone);
          const aria = t('risk.hourAria', { time, category: t(`cat.${a.category}`), hi: formatTemp(v) });
          const bar = (
            // Dimming lives on the wrapper: the entrance animation's final keyframe would override it on the bar itself.
            <div className="relative flex w-full items-end transition-opacity" style={{ height, opacity: highlight && !inHighlight ? 0.3 : 1 }}>
              <div
                className={`ribbon-cell w-full rounded-t-[3px] ${a.status !== 'ok' ? 'demo-hatch' : ''}`}
                style={{
                  height: `${(v === null ? 0.18 : scale(v)) * 100}%`,
                  backgroundColor: a.status === 'ok' ? color : 'transparent',
                  border: a.status === 'ok' ? undefined : `1px dashed ${color}`,
                  animationDelay: `${i * 18}ms`,
                }}
              />
            </div>
          );
          const showLabel = i === 0 || i % 3 === 0;
          const cellLabel = (
            <span className={`num mt-1 block h-4 text-center text-[11px] leading-4 ${selected ? 'font-semibold text-fg' : 'text-faint'}`}>
              {i === 0 ? t('risk.now') : showLabel ? time.replace(' ', '') : ''}
            </span>
          );
          const outline = selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : inHighlight ? 'ring-1 ring-fg/70' : '';
          return interactive ? (
            <button
              key={h.hour.time}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={selected ? 0 : -1}
              aria-pressed={selected}
              aria-label={aria}
              title={aria}
              onClick={() => onSelect?.(i)}
              className={`flex flex-col rounded-[4px] px-0 ${outline}`}
            >
              {bar}
              {cellLabel}
            </button>
          ) : (
            <div key={h.hour.time} className={`flex flex-col rounded-[4px] ${outline}`} title={aria}>
              <span className="sr-only">{aria}</span>
              {bar}
              {cellLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryLegend() {
  const { t } = useI18n();
  const cats = ['lower', 'caution', 'extreme_caution', 'danger', 'extreme_danger'] as const;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
      {cats.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
          {t(`cat.${c}`)}
        </li>
      ))}
    </ul>
  );
}
