import { Navigate, Route, Routes } from 'react-router';
import { App } from './App';
import { useAuth } from './authContext';
import { AccountPage } from './pages/AccountPage';
import { AuthLoading } from './pages/AuthLayout';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';

function CalendarRoute() {
  const { status, guestMode, user } = useAuth();

  // A guest does not wait for the server, which may be waking up. The key
  // starts the calendar afresh when someone signs in or out, so a plan never
  // outlives the session it belongs to.
  if (status === 'signed-in' || guestMode) {
    return <App key={user?.id ?? 'guest'} />;
  }
  return status === 'loading' ? <AuthLoading /> : <Navigate to="/" replace />;
}

function AccountRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <AuthLoading />;
  }
  return status === 'signed-in' ? <AccountPage /> : <Navigate to="/" replace />;
}

export function Root() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterPage />} />
      <Route path="/kalendarz" element={<CalendarRoute />} />
      <Route path="/konto" element={<AccountRoute />} />
      <Route path="/prywatnosc" element={<PrivacyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
