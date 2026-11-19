import { formatChartDayFull } from '../chartUtils';

export default function ChartTooltip({
  leftPercent,
  date,
  valueLabel,
  formattedValue,
  color,
}: {
  leftPercent: number;
  date: string;
  valueLabel: string;
  formattedValue: string;
  color: string;
}) {
  const clamped = Math.min(94, Math.max(6, leftPercent));

  return (
    <div className="chart-tooltip" style={{ left: `${clamped}%` }}>
      <span className="chart-tooltip__date">{formatChartDayFull(date)}</span>
      <span className="chart-tooltip__value">
        <span className="chart-tooltip__dot" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="chart-tooltip__label">{valueLabel}</span>
        <strong>{formattedValue}</strong>
      </span>
    </div>
  );
}
