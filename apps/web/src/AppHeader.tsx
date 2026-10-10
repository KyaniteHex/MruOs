import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuth } from './authContext';

type AppHeaderProps = {
  /** The calendar's views and navigation. */
  controls?: ReactNode;
  /** Page actions before settings, e.g. "+ Dodaj". */
  actions?: ReactNode;
};

// The "settings" icon of Material Icons (Apache License 2.0).
function GearIcon() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The bar on top of the calendar and the settings. */
export function AppHeader({ controls, actions }: AppHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <Link className="brand" to="/kalendarz" aria-label="MruOS, kalendarz">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <span className="brand-name">MruOS</span>
      </Link>
      {controls && <div className="topbar-controls">{controls}</div>}
      <div className="topbar-actions">
        {actions}
        {!user && (
          <Link className="secondary-button" to="/">
            Zaloguj się
          </Link>
        )}
        <NavLink
          aria-label="Ustawienia"
          className="icon-button"
          title="Ustawienia"
          to="/ustawienia"
        >
          <GearIcon />
        </NavLink>
      </div>
    </header>
  );
}
