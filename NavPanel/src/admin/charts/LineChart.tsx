import { useId, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import ChartTooltip from './ChartTooltip';
import {
  chartMax,
  formatAxisValue,
  formatChartDay,
  pickLabelIndices,
  pointPercent,
} from '../chartUtils';

export interface TrendPoint {
  date: string;
  value: number;
}

const TOP = 6;
const BOTTOM = 94;

export default function LineChart({
  points,
  valueLabel,
  formatValue,
  formatAxis = formatAxisValue,
  color = '#a78bfa',
  fill = false,
  height = 220,
}: {
  points: TrendPoint[];
  valueLabel: string;
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  color?: string;
  fill?: boolean;
  height?: number;
}) {
  const rawId = useId();
  const gradientId = `chart-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = chartMax(points.map((point) => point.value));
  const rawMax = points.reduce((peak, point) => Math.max(peak, point.value), 0);
  const length = points.length;

  const coords = points.map((point, index) => {
    const x = pointPercent(index, length);
    const y = max > 0 ? BOTTOM - (point.value / max) * (BOTTOM - TOP) : BOTTOM;
    return { x, y };
  });

  const linePath = coords.length
    ? coords
        .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
        .join(' ')
    : '';
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(2)},${BOTTOM} L${coords[0].x.toFixed(2)},${BOTTOM} Z`
      : '';

  const ticks = [max, max / 2, 0];

  const handlePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActiveIndex(Math.round(ratio * (length - 1)));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActiveIndex((previous) => {
      const base = previous ?? length - 1;
      const next = base + (event.key === 'ArrowRight' ? 1 : -1);
      return Math.min(length - 1, Math.max(0, next));
    });
  };

  const activePoint =
    activeIndex !== null && activeIndex >= 0 && activeIndex < length
      ? { point: points[activeIndex], coord: coords[activeIndex] }
      : null;

  return (
    <div
      className="chart"
      role="group"
      aria-label={`${valueLabel} chart. ${length} UTC day${length === 1 ? '' : 's'}. Peak ${formatValue(rawMax)}.`}
    >
      <div className="chart__plot">
        <div className="chart__yaxis" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={index}>{formatAxis(tick)}</span>
          ))}
        </div>

        <div
          className="chart__canvas"
          style={{ height }}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={handleKeyDown}
          aria-label={`Interactive chart. Use left and right arrow keys to inspect daily values.`}
        >
          <svg
            className="chart__svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {[0, 0.5, 1].map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={100}
                y1={TOP + tick * (BOTTOM - TOP)}
                y2={TOP + tick * (BOTTOM - TOP)}
                className="chart__gridline"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {fill ? (
              <>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
              </>
            ) : null}

            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {activePoint ? (
              <line
                x1={activePoint.coord.x}
                x2={activePoint.coord.x}
                y1={TOP}
                y2={BOTTOM}
                className="chart__cursor"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {activePoint ? (
            <>
              <span
                className="chart__marker"
                style={{
                  left: `${activePoint.coord.x}%`,
                  top: `${activePoint.coord.y}%`,
                  backgroundColor: color,
                }}
                aria-hidden="true"
              />
              <ChartTooltip
                leftPercent={activePoint.coord.x}
                date={activePoint.point.date}
                valueLabel={valueLabel}
                formattedValue={formatValue(activePoint.point.value)}
                color={color}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="chart__xaxis" aria-hidden="true">
        {pickLabelIndices(length).map((index) => (
          <span
            key={points[index].date}
            className="chart__xlabel"
            style={{ left: `${pointPercent(index, length)}%` }}
          >
            {formatChartDay(points[index].date)}
          </span>
        ))}
      </div>
    </div>
  );
}
