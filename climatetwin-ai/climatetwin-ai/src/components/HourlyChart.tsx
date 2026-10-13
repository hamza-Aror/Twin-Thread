import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssessedHour, AssessmentCategory, RiskCategory } from '../types/risk';
import { CATEGORY_COLORS } from '../services/risk/categories';
import { findElevatedPeriods } from '../services/risk/periods';
import { formatHour, formatNumber, formatTemp } from '../utils/format';
import { useI18n } from '../i18n';

interface Row {
  i: number;
  time: number;
  hi: number | null;
  temp: number | null;
  rh: number | null;
  category: AssessmentCategory;
}

interface Props {
  hours: AssessedHour[];
  timeZone: string;
  selectedIndex: number;
  onSelect: (i: number) => void;
  elevatedFrom: RiskCategory;
  /** Fraction of an hour past the first forecast hour, for the "now" marker. */
  nowOffset: number;
}

interface DotArgs {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: Row;
}

export function HourlyChart({ hours, timeZone, selectedIndex, onSelect, elevatedFrom, nowOffset }: Props) {
  const { t } = useI18n();
  const rows: Row[] = hours.map((h, i) => ({
    i,
    time: h.hour.time,
    hi: h.assessment.indicator.valueC === null ? null : Math.round(h.assessment.indicator.valueC * 10) / 10,
    temp: h.hour.temperatureC,
    rh: h.hour.relativeHumidity,
    category: h.assessment.category,
  }));
  const periods = findElevatedPeriods(hours, elevatedFrom);
  const ticks = rows.filter((r) => r.i % 3 === 0).map((r) => r.i);
  const label = (i: number) => (rows[i] ? formatHour(rows[i].time, timeZone) : '');

  const renderDot = (props: unknown) => {
    const p = props as DotArgs;
    if (p.cx === undefined || p.cy === undefined || !p.payload) return <g key={`d${p.index}`} />;
    const selected = p.payload.i === selectedIndex;
    return (
      <circle
        key={`d${p.index}`}
        cx={p.cx}
        cy={p.cy}
        r={selected ? 6 : 3.5}
        fill={CATEGORY_COLORS[p.payload.category]}
        stroke={selected ? '#e8eef6' : '#0e1726'}
        strokeWidth={selected ? 2 : 1}
      />
    );
  };

  return (
    <div dir="ltr" className="h-[300px] w-full" role="img" aria-label={t('outlook.chartLabel')}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 16, right: 12, left: -8, bottom: 0 }}
          onClick={(state) => {
            const idx = Number((state as { activeTooltipIndex?: unknown } | null)?.activeTooltipIndex);
            if (Number.isInteger(idx) && idx >= 0 && idx < rows.length) onSelect(idx);
          }}
        >
          <CartesianGrid stroke="#273a56" strokeDasharray="2 4" vertical={false} />
          {periods.map((p) => (
            <ReferenceArea
              key={p.startTime}
              x1={p.startIndex - 0.5}
              x2={p.endIndex + 0.5}
              fill={CATEGORY_COLORS[p.peakCategory]}
              fillOpacity={0.1}
              stroke="none"
            />
          ))}
          <XAxis
            dataKey="i"
            type="number"
            domain={[-0.5, rows.length - 0.5]}
            ticks={ticks}
            tickFormatter={(v: number) => label(v)}
            tick={{ fill: '#a3b2c7', fontSize: 12 }}
            axisLine={{ stroke: '#273a56' }}
            tickLine={false}
          />
          <YAxis
            domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]}
            tickFormatter={(v: number) => `${v}°`}
            tick={{ fill: '#a3b2c7', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: '#5cc8e8', strokeOpacity: 0.4 }}
            content={({ active, payload }) => {
              const row = active && payload && payload.length ? (payload[0].payload as Row) : null;
              if (!row) return null;
              return (
                <div className="rounded-lg border border-line bg-ink px-3 py-2 text-sm shadow-lg">
                  <div className="font-semibold text-fg">{formatHour(row.time, timeZone)}</div>
                  <div className="num text-fg">
                    {t('outlook.seriesHi')}: {formatTemp(row.hi, 1)}
                  </div>
                  <div className="num text-muted">
                    {t('outlook.seriesTemp')}: {formatTemp(row.temp, 1)}
                  </div>
                  <div className="num text-muted">
                    {t('risk.humidity')}: {formatNumber(row.rh, 0, '%')}
                  </div>
                  <div style={{ color: CATEGORY_COLORS[row.category] }}>{t(`cat.${row.category}`)}</div>
                </div>
              );
            }}
          />
          <ReferenceLine x={selectedIndex} stroke="#5cc8e8" strokeOpacity={0.5} />
          <ReferenceLine
            x={Math.min(Math.max(nowOffset, -0.5), rows.length - 0.5)}
            stroke="#e8eef6"
            strokeDasharray="3 3"
            label={{ value: t('risk.now'), position: 'top', fill: '#e8eef6', fontSize: 11 }}
          />
          <Line type="monotone" dataKey="temp" stroke="#73869f" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
          <Line type="monotone" dataKey="hi" stroke="#e8eef6" strokeWidth={2} dot={renderDot} activeDot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
