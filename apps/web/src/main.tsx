import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { appVersion, versionLabel } from './appVersion';
import { AuthProvider } from './auth';
import { Root } from './Root';
import { applyTheme, followSystemTheme } from './theme';
import './index.css';

applyTheme();
followSystemTheme();
// Tells which build runs here, e.g. production or a preview.
console.info(`MruOS ${versionLabel(appVersion)}`);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
