const countFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

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

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatCount(value: number): string {
  return Number.isFinite(value) ? countFormatter.format(value) : '—';
}

/** Seconds -> readable duration. Null means the metric genuinely has no value. */
export function formatDurationSeconds(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;

  const total = Math.max(0, Math.round(value));
  if (total === 0) return '0s';
  if (total < 60) return `${total}s`;

  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  if (total < 86400) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/** Compact duration for chart axis ticks. Tooltips use formatDurationSeconds. */
export function formatDurationAxis(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  if (value < 86400) return `${(value / 3600).toFixed(1)}h`;
  return `${(value / 86400).toFixed(1)}d`;
}

/** Human-readable UTC range label for the selected window. */
export function formatRangeLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '—';

  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  if (!sameYear) {
    return `${dayYearFormatter.format(from)} – ${dayYearFormatter.format(to)} UTC`;
  }
  return `${dayFormatter.format(from)} – ${dayFormatter.format(to)}, ${to.getUTCFullYear()} UTC`;
}

export function formatGeneratedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return timeFormatter.format(date);
}

export function humanizeKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
