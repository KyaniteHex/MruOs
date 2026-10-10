import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type MenuItem = {
  label: string;
  onSelect: () => void;
};

type MenuButtonProps = {
  /** The button's content; "▾" is added after it. */
  children: ReactNode;
  items: readonly MenuItem[];
  className?: string;
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end';
};

/**
 * A button that opens a short menu, following the WAI-ARIA menu button
 * pattern: arrow keys move between items, Escape closes and returns focus.
 */
export function MenuButton({
  children,
  items,
  className = 'secondary-button',
  align = 'start',
}: MenuButtonProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  // Moves the menu back on screen, e.g. on a phone held upright.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) {
      return;
    }
    const margin = 8;
    const screenWidth =
      document.documentElement.clientWidth || window.innerWidth;
    const { left, right } = menu.getBoundingClientRect();
    const shift =
      left < margin
        ? margin - left
        : right > screenWidth - margin
          ? screenWidth - margin - right
          : 0;
    menu.style.transform = shift === 0 ? '' : `translateX(${shift}px)`;
  }, [open]);

  useEffect(() => {
    if (open) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function openAt(index: number) {
    setFocusIndex(index);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(item: MenuItem) {
    // Focus goes back first, so a dialog the item opens returns it there.
    close();
    item.onSelect();
  }

  function handleButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openAt(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(items.length - 1);
    }
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: focusIndex === last ? 0 : focusIndex + 1,
      ArrowUp: focusIndex === 0 ? last : focusIndex - 1,
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setFocusIndex(moves[event.key] ?? 0);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Keeps dialogs underneath from closing too.
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className="menu-button" ref={containerRef}>
      <button
        ref={buttonRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className={className}
        type="button"
        onClick={() => (open ? setOpen(false) : openAt(0))}
        onKeyDown={handleButtonKey}
      >
        {children}
        <span aria-hidden="true" className="menu-button-caret">
          ▾
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          className={`menu-list menu-list-${align}`}
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKey}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className="menu-item"
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => choose(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
