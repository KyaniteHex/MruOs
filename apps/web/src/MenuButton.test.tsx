import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuButton } from './MenuButton';

function renderMenu() {
  const json = vi.fn();
  const ics = vi.fn();
  render(
    <>
      <MenuButton
        items={[
          { label: 'Format JSON', onSelect: json },
          { label: 'Format ICS', onSelect: ics },
        ]}
      >
        Eksport
      </MenuButton>
      <p>Poza menu</p>
    </>,
  );
  return { json, ics, button: screen.getByRole('button', { name: 'Eksport' }) };
}

describe('MenuButton', () => {
  afterEach(cleanup);

  it('opens a menu whose items run their action and close it', () => {
    const { ics, button } = renderMenu();
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Format JSON', 'Format ICS']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Format ICS' }));
    expect(ics).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('works with the keyboard', () => {
    const { json, button } = renderMenu();

    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const [first, second] = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);

    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[1]);
    expect(json).not.toHaveBeenCalled();
  });

  it('closes when the student clicks elsewhere', () => {
    const { button } = renderMenu();

    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText('Poza menu'));

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
