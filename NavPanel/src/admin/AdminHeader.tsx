import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { IconArrowLeft, IconMenu } from './icons';

export default function AdminHeader({
  title,
  description,
  onOpenNav,
}: {
  title: string;
  description: string;
  onOpenNav: () => void;
}) {
  const { profile } = useAuth();
  const displayName = profile?.displayName || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button
          type="button"
          className="admin-icon-btn admin-menu-button"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          <IconMenu size={20} />
        </button>
        <div className="admin-header__titles">
          <h1 className="admin-header__title">{title}</h1>
          <p className="admin-header__description">{description}</p>
        </div>
      </div>

      <div className="admin-header__right">
        <Link to="/" className="admin-back-link">
          <IconArrowLeft size={16} />
          <span>Back to CineSync</span>
        </Link>

        <div className="admin-identity" title={displayName}>
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              className="admin-identity__avatar"
              width={34}
              height={34}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="admin-identity__avatar admin-identity__avatar--placeholder" aria-hidden="true">
              {initial}
            </span>
          )}
          <span className="admin-identity__text">
            <span className="admin-identity__name">{displayName}</span>
            <span className="admin-identity__role">Administrator</span>
          </span>
        </div>
      </div>
    </header>
  );
}
