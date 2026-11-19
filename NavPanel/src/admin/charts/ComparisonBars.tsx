export interface ComparisonItem {
  label: string;
  value: number;
  color: string;
  note?: string;
}

export default function ComparisonBars({
  items,
  formatValue,
  ariaLabel,
}: {
  items: ComparisonItem[];
  formatValue: (value: number) => string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="comparison" role="img" aria-label={ariaLabel}>
      {items.map((item) => (
        <div className="comparison__row" key={item.label}>
          <span className="comparison__label">{item.label}</span>
          <div className="comparison__track" aria-hidden="true">
            <span
              className="comparison__fill"
              style={{
                width: `${Math.max(0, (item.value / max) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="comparison__value">{formatValue(item.value)}</span>
          {item.note ? <span className="comparison__note">{item.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
