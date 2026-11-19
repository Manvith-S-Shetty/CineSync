const dayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const dayYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Parse the backend's `YYYY-MM-DD` day key as a UTC date. */
function parseDay(iso: string): Date | null {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatChartDay(iso: string): string {
  const date = parseDay(iso);
  return date ? dayFormatter.format(date) : iso;
}

export function formatChartDayFull(iso: string): string {
  const date = parseDay(iso);
  return date ? `${dayYearFormatter.format(date)} UTC` : iso;
}

/** Round a maximum up to a readable axis value (1/2/5 x power of ten). */
export function chartMax(values: number[]): number {
  let max = 0;
  for (const value of values) {
    if (Number.isFinite(value) && value > max) max = value;
  }
  if (max <= 0) return 0;

  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function formatAxisValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  if (value < 10 && !Number.isInteger(value)) return value.toFixed(1);
  return String(Math.round(value));
}

/** Evenly spaced label indices, always including first and last. */
export function pickLabelIndices(length: number, maxLabels = 5): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];

  const count = Math.min(maxLabels, length);
  const indices = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

/** Left position (%) for a point index, treating a single point as centered. */
export function pointPercent(index: number, length: number): number {
  if (length <= 1) return 50;
  return (index / (length - 1)) * 100;
}

export function sumValues(values: number[]): number {
  return values.reduce((total, value) => (Number.isFinite(value) ? total + value : total), 0);
}
