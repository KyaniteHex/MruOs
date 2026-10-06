import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from './auth';
import { Root } from './Root';

// Test helpers: the whole app on a chosen route with a stubbed API.

export type ApiRoute = (
  init: RequestInit | undefined,
) => Response | Promise<Response>;

/**
 * Stubs fetch with handlers keyed by "METHOD /path"; unknown requests get
 * 404. Returns the mock to inspect calls.
 */
export function stubApi(routes: Record<string, ApiRoute>) {
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).replace(/^\/api/, '');
      const method = init?.method ?? 'GET';
      const handler = routes[`${method} ${path}`];
      return handler ? handler(init) : new Response(null, { status: 404 });
    },
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export const signedOut: ApiRoute = () => json({ error: 'unauthorized' }, 401);

export function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider apiBaseUrl="/api">
        <Root />
      </AuthProvider>
    </MemoryRouter>,
  );
}
