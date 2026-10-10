import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDialogKeyboard } from './useDialogKeyboard';

type BottomSheetProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** False while a form is open on top, so Escape closes only the form. */
  active?: boolean;
};

/**
 * A panel sliding up over the calendar on narrow screens, e.g. with the
 * details of a class. A tap next to it closes it, like "Zamknij" and Escape.
 */
export function BottomSheet({
  eyebrow,
  title,
  children,
  onClose,
  active = true,
}: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogKeyboard(onClose, active);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={sheetRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="sheet"
        role="dialog"
        tabIndex={-1}
      >
        <div className="sheet-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-close" type="button" onClick={onClose}>
            Zamknij
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
