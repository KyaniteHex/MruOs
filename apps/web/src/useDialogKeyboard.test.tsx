import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDialogKeyboard } from './useDialogKeyboard';

function Dialog({ onClose }: { onClose: () => void }) {
  useDialogKeyboard(onClose);

  return (
    <div role="dialog" aria-label="Test">
      <input aria-label="Pole" autoFocus />
    </div>
  );
}

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Otwórz
      </button>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </>
  );
}

describe('useDialogKeyboard', () => {
  afterEach(cleanup);

  it('closes on Escape and returns focus to the opener', async () => {
    // StrictMode remounts effects, which must not steal focus from the dialog.
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    const opener = screen.getByRole('button', { name: 'Otwórz' });
    opener.focus();
    fireEvent.click(opener);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(screen.getByLabelText('Pole'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
