import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import ChartTooltip from './ChartTooltip';
import {
  chartMax,
  formatAxisValue,
  formatChartDay,
  pickLabelIndices,
  pointPercent,
} from '../chartUtils';
import type { TrendPoint } from './LineChart';

export default function BarChart({
  points,
  valueLabel,
  formatValue,
  formatAxis = formatAxisValue,
  color = '#60a5fa',
  height = 220,
}: {
  points: TrendPoint[];
  valueLabel: string;
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  color?: string;
  height?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = chartMax(points.map((point) => point.value));
  const rawMax = points.reduce((peak, point) => Math.max(peak, point.value), 0);
  const length = points.length;
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
      ? points[activeIndex]
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
          className="chart__canvas chart__canvas--bars"
          style={{ height }}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={handleKeyDown}
          aria-label="Interactive bar chart. Use left and right arrow keys to inspect daily values."
        >
          <div className="chart__grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div
            className={`chart__bars${length > 90 ? ' chart__bars--dense' : ''}`}
            aria-hidden="true"
          >
            {points.map((point) => {
              const percent = max > 0 ? (point.value / max) * 100 : 0;
              return (
                <span className="chart__bar-slot" key={point.date}>
                  <span
                    className="chart__bar"
                    style={{
                      height: `${percent}%`,
                      minHeight: point.value > 0 ? 2 : 0,
                      backgroundColor: color,
                    }}
                  />
                </span>
              );
            })}
          </div>

          {activePoint ? (
            <ChartTooltip
              leftPercent={pointPercent(activeIndex ?? 0, length)}
              date={activePoint.date}
              valueLabel={valueLabel}
              formattedValue={formatValue(activePoint.value)}
              color={color}
            />
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
