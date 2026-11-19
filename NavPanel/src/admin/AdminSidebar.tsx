import { Link, NavLink } from 'react-router-dom';
import {
  IconActivity,
  IconAnalytics,
  IconArrowLeft,
  IconClose,
  IconLogo,
  IconOverview,
  IconUsers,
} from './icons';

const ADMIN_NAV = [
  {
    to: '/admin',
    label: 'Overview',
    hint: 'Platform metrics',
    icon: IconOverview,
    end: true,
  },
  {
    to: '/admin/users',
    label: 'Users',
    hint: 'Directory & engagement',
    icon: IconUsers,
    end: false,
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    hint: 'Rooms & watch sessions',
    icon: IconAnalytics,
    end: false,
  },
  {
    to: '/admin/activity',
    label: 'Activity',
    hint: 'Persisted event feed',
    icon: IconActivity,
    end: false,
  },
] as const;

export default function AdminSidebar({
  open,
  onNavigate,
  onClose,
}: {
  open: boolean;
  onNavigate: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          className="admin-sidebar-overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}

      <aside className={`admin-sidebar${open ? ' is-open' : ''}`} aria-label="Admin navigation">
        <div className="admin-sidebar__top">
          <Link to="/admin" className="admin-brand" onClick={onNavigate}>
            <span className="admin-brand__mark" aria-hidden="true">
              <IconLogo size={18} />
            </span>
            <span className="admin-brand__text">
              <span className="admin-brand__name">CineSync</span>
              <span className="admin-brand__tag">Admin console</span>
            </span>
          </Link>
          <button
            type="button"
            className="admin-icon-btn admin-sidebar__close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <IconClose size={18} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          <p className="admin-nav__label">Workspace</p>
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-nav__link${isActive ? ' is-active' : ''}`
                }
                onClick={onNavigate}
              >
                <span className="admin-nav__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="admin-nav__text">
                  <span className="admin-nav__title">{item.label}</span>
                  <span className="admin-nav__hint">{item.hint}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <Link to="/" className="admin-nav__link admin-nav__link--back" onClick={onNavigate}>
            <span className="admin-nav__icon" aria-hidden="true">
              <IconArrowLeft size={18} />
            </span>
            <span className="admin-nav__text">
              <span className="admin-nav__title">Back to CineSync</span>
              <span className="admin-nav__hint">Watch party app</span>
            </span>
          </Link>
          <p className="admin-sidebar__note">
            Admin access is verified by the backend on every request.
          </p>
        </div>
      </aside>
    </>
  );
}
