import type { ReactNode } from 'react';
import { IconAlertTriangle, IconInfo, IconRefresh } from '../icons';

export type ChartStatus = 'loading' | 'error' | 'empty' | 'ready';

export default function ChartCard({
  title,
  subtitle,
  status,
  errorMessage,
  onRetry,
  emptyMessage = 'No activity was recorded in this period.',
  footnote,
  children,
}: {
  title: string;
  subtitle?: string;
  status: ChartStatus;
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`chart-card chart-card--${status}`} aria-busy={status === 'loading' || undefined}>
      <header className="chart-card__header">
        <h3 className="chart-card__title">{title}</h3>
        {subtitle ? <p className="chart-card__subtitle">{subtitle}</p> : null}
      </header>

      <div className="chart-card__body">
        {status === 'loading' ? (
          <div className="chart-skeleton" role="status" aria-live="polite">
            <span className="admin-sr-only">Loading chart…</span>
            <div className="chart-skeleton__plot" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => (
                <span
                  key={index}
                  className="chart-skeleton__bar"
                  style={{ height: `${22 + ((index * 37) % 68)}%` }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="chart-error" role="alert">
            <span className="chart-error__icon" aria-hidden="true">
              <IconAlertTriangle size={18} />
            </span>
            <div className="chart-error__body">
              <p className="chart-error__title">Chart unavailable</p>
              <p className="chart-error__text">
                {errorMessage ?? 'This chart could not be loaded.'}
              </p>
              {onRetry ? (
                <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
                  <IconRefresh size={15} />
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {status === 'empty' ? (
          <div className="chart-empty" role="status">
            <span className="chart-empty__icon" aria-hidden="true">
              <IconInfo size={18} />
            </span>
            <div>
              <p className="chart-empty__title">No data in this period</p>
              <p className="chart-empty__text">{emptyMessage}</p>
            </div>
          </div>
        ) : null}

        {status === 'ready' ? children : null}
      </div>

      {footnote ? <p className="chart-card__footnote">{footnote}</p> : null}
    </section>
  );
}
