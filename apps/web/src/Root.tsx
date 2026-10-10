import { Navigate, Outlet, Route, Routes } from 'react-router';
import { App } from './App';
import { useAuth } from './authContext';
import { PlanProvider } from './plan';
import { AuthLoading } from './pages/AuthLayout';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';

/** Pages that work on a plan: the account's, or the guest's in the browser. */
function PlanRoute() {
  const { status, guestMode, user } = useAuth();

  // A guest does not wait for the server, which may be waking up. The key
  // starts the plan afresh when someone signs in or out, so a plan never
  // outlives the session it belongs to.
  if (status === 'signed-in' || guestMode) {
    return (
      <PlanProvider key={user?.id ?? 'guest'}>
        <Outlet />
      </PlanProvider>
    );
  }
  return status === 'loading' ? <AuthLoading /> : <Navigate to="/" replace />;
}

export function Root() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterPage />} />
      <Route element={<PlanRoute />}>
        <Route path="/kalendarz" element={<App />} />
        <Route path="/ustawienia" element={<SettingsPage />} />
      </Route>
      {/* The account page became a section of the settings. */}
      <Route
        path="/konto"
        element={
          <Navigate to={{ pathname: '/ustawienia', hash: '#konto' }} replace />
        }
      />
      <Route path="/prywatnosc" element={<PrivacyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
