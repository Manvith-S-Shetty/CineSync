import type { ReactNode } from 'react';
import { IconLogo } from './icons';

interface AdminGateShellProps {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  tone?: 'neutral' | 'danger' | 'warning';
  busy?: boolean;
  children?: ReactNode;
}

export default function AdminGateShell({
  icon,
  eyebrow,
  title,
  description,
  tone = 'neutral',
  busy = false,
  children,
}: AdminGateShellProps) {
  return (
    <div className="admin-gate">
      <div
        className={`admin-gate__panel admin-gate__panel--${tone}`}
        role={busy ? 'status' : undefined}
        aria-live={busy ? 'polite' : undefined}
        aria-busy={busy || undefined}
      >
        <div className="admin-gate__brand">
          <span className="admin-brand__mark" aria-hidden="true">
            <IconLogo size={18} />
          </span>
          <span className="admin-gate__brand-name">CineSync</span>
          <span className="admin-gate__brand-tag">Admin</span>
        </div>

        {eyebrow ? <p className="admin-gate__eyebrow">{eyebrow}</p> : null}

        <span className="admin-gate__icon" aria-hidden="true">
          {icon}
        </span>

        <h1 className="admin-gate__title">{title}</h1>
        <p className="admin-gate__text">{description}</p>

        {children ? <div className="admin-gate__actions">{children}</div> : null}
      </div>
    </div>
  );
}
