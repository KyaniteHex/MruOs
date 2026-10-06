import { Link } from 'react-router';
import type { ReactNode } from 'react';

export function AuthLayout({
  title,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link className="brand" to="/" aria-label="MruOS, strona główna">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>MruOS</span>
        </Link>
        <p className="auth-tagline">Plan zajęć studenta</p>
      </header>
      <main className={wide ? 'auth-card auth-card-wide' : 'auth-card'}>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="auth-footer">
        <Link to="/prywatnosc">Prywatność</Link>
      </footer>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-shell">
      <p className="auth-loading" role="status">
        Łączenie z serwerem…
      </p>
    </div>
  );
}
