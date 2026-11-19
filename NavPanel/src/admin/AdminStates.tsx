import { IconAlertTriangle, IconInfo, IconRefresh } from './icons';

export function AdminLoadingState({ label = 'Loading admin data…' }: { label?: string }) {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <span className="admin-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function AdminSkeletonGrid({
  count = 6,
  label = 'Loading metrics…',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="admin-skeleton-grid" role="status" aria-live="polite">
      <span className="admin-sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="admin-skeleton-card" key={index} aria-hidden="true">
          <span className="admin-skeleton admin-skeleton--label" />
          <span className="admin-skeleton admin-skeleton--value" />
          <span className="admin-skeleton admin-skeleton--desc" />
        </div>
      ))}
    </div>
  );
}

export function AdminErrorState({
  title = 'Unable to load admin data',
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="admin-state admin-state--error" role="alert">
      <span className="admin-state__icon" aria-hidden="true">
        <IconAlertTriangle size={20} />
      </span>
      <div className="admin-state__body">
        <h3 className="admin-state__title">{title}</h3>
        <p className="admin-state__text">{message}</p>
        {onRetry ? (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onRetry}
            disabled={retrying}
          >
            <IconRefresh size={16} />
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="admin-state admin-state--empty" role="status">
      <span className="admin-state__icon" aria-hidden="true">
        <IconInfo size={20} />
      </span>
      <div className="admin-state__body">
        <h3 className="admin-state__title">{title}</h3>
        <p className="admin-state__text">{message}</p>
      </div>
    </div>
  );
}
