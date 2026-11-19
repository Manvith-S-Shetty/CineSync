import {
  ADMIN_RANGE_PRESETS,
  createAdminDateRange,
  type AdminDateRange,
} from './dateRange';
import { formatRangeLabel } from './format';
import { IconCalendar } from './icons';

export default function AdminDateRangeSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: AdminDateRange;
  onChange: (range: AdminDateRange) => void;
  disabled?: boolean;
}) {
  return (
    <div className="admin-range">
      <div className="admin-range__header">
        <span className="admin-range__label">
          <IconCalendar size={15} />
          Reporting period
        </span>
        <span className="admin-range__exact" title={`${value.fromIso} → ${value.toIso} (UTC)`}>
          {formatRangeLabel(value.fromIso, value.toIso)}
        </span>
      </div>

      <div className="admin-range__options" role="group" aria-label="Reporting period">
        {ADMIN_RANGE_PRESETS.map((preset) => {
          const isActive = value.days === preset.days;
          return (
            <button
              key={preset.days}
              type="button"
              className={`admin-range__option${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              title={preset.title}
              disabled={disabled}
              onClick={() => onChange(createAdminDateRange(preset.days))}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
