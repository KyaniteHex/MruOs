import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';

function renderSheet(active = true) {
  const onClose = vi.fn();
  render(
    <BottomSheet
      eyebrow="INFORMACJE"
      title="Szczegóły"
      active={active}
      onClose={onClose}
    >
      <p>Matematyka</p>
    </BottomSheet>,
  );
  return { onClose, sheet: screen.getByRole('dialog', { name: 'Szczegóły' }) };
}

describe('BottomSheet', () => {
  afterEach(cleanup);

  it('takes the focus and closes with the button, Escape or a tap next to it', () => {
    const { onClose, sheet } = renderSheet();
    expect(document.activeElement).toBe(sheet);

    fireEvent.click(screen.getByText('Matematyka'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(sheet.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('leaves Escape to a form open on top', () => {
    const { onClose } = renderSheet(false);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
