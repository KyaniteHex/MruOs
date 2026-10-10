import { useEffect, useRef, useState } from 'react';

// Keyboard contract shared by modal dialogs: Escape closes the dialog and
// focus returns to the element that opened it. An inactive dialog, e.g. one
// with a form open on top, leaves Escape to the form.
export function useDialogKeyboard(onClose: () => void, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const activeRef = useRef(active);
  activeRef.current = active;
  const mountedRef = useRef(false);
  // Read during the first render, before autoFocus moves focus into the dialog.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    mountedRef.current = true;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && activeRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('keydown', handleKeyDown);
      // StrictMode remounts right after a simulated unmount; restoring focus
      // synchronously would pull it out of the still-open dialog.
      setTimeout(() => {
        if (!mountedRef.current && opener?.isConnected) {
          opener.focus();
        }
      }, 0);
    };
  }, [opener]);
}

// For dialogs rendered inline in a parent component's conditional branch.
export function DialogKeyboard({ onClose }: { onClose: () => void }) {
  useDialogKeyboard(onClose);

  return null;
}
