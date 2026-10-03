import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPanel } from './AccountPanel';

describe('AccountPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits credentials and passes the validated user to the app', async () => {
    const onAuthenticated = vi.fn(async () => true);
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            user: { id: 'user-1', email: 'student@example.com' },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetcher);

    render(
      <AccountPanel
        user={null}
        apiBaseUrl="/api"
        onAuthenticated={onAuthenticated}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'secret' },
    });
    fireEvent.submit(
      screen.getByLabelText('E-mail').closest('form') as HTMLFormElement,
    );

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'student@example.com',
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });
});
