export const ADMIN_RANGE_PRESETS = [
  { days: 7, label: '7D', title: 'Last 7 days' },
  { days: 30, label: '30D', title: 'Last 30 days' },
  { days: 90, label: '90D', title: 'Last 90 days' },
  { days: 365, label: '12M', title: 'Last 12 months' },
] as const;

export type AdminRangeDays = (typeof ADMIN_RANGE_PRESETS)[number]['days'];

export interface AdminDateRange {
  days: AdminRangeDays;
  fromIso: string;
  toIso: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Backend ranges are UTC `[from, to)`. Build ISO instants so the API receives
 * unambiguous timestamps regardless of the viewer's local timezone.
 */
export function createAdminDateRange(days: AdminRangeDays = 30): AdminDateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  const preset = ADMIN_RANGE_PRESETS.find((option) => option.days === days) ?? ADMIN_RANGE_PRESETS[1];

  return {
    days,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    label: preset.title,
  };
}
