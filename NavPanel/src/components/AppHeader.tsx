import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import './AppHeader.css';

export default function AppHeader() {
  const { profile, logout } = useAuth();

  if (!profile) return null;

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand">
          <span className="app-header__logo">CineSync</span>
          <span className="app-header__tagline">Watch party</span>
        </Link>

        <div className="app-header__user">
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              className="app-header__avatar"
              width={36}
              height={36}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="app-header__avatar app-header__avatar--placeholder" aria-hidden />
          )}
          <div className="app-header__user-text">
            <span className="app-header__name">{profile.displayName}</span>
            <span className="app-header__email" title={profile.email}>
              {profile.email}
            </span>
          </div>
          <button
            type="button"
            className="app-header__logout"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
