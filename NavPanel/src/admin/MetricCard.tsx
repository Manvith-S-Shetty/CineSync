import type { ReactNode } from 'react';

export type MetricTone = 'default' | 'accent' | 'warning';

export interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  unavailable?: boolean;
}

export default function MetricCard({
  label,
  value,
  description,
  icon,
  tone = 'default',
  unavailable = false,
}: MetricCardProps) {
  const className = [
    'admin-metric-card',
    tone !== 'default' ? `admin-metric-card--${tone}` : '',
    unavailable ? 'is-unavailable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className}>
      <div className="admin-metric-card__head">
        {icon ? <span className="admin-metric-card__icon">{icon}</span> : null}
        <h3 className="admin-metric-card__label">{label}</h3>
      </div>
      <p className="admin-metric-card__value">{value}</p>
      {description ? <p className="admin-metric-card__desc">{description}</p> : null}
    </article>
  );
}
