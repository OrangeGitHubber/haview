import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/**
 * Shared modal primitive: fixed overlay, Esc and backdrop-click close.
 * The panel is an empty shell — callers bring their own padding/layout.
 */
export function Modal({
  onClose,
  maxWidth = 480,
  children,
}: {
  onClose: () => void;
  maxWidth?: number;
  children: ComponentChildren;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // stopPropagation on the overlay too: a modal may be rendered inside a
    // clickable card, and its clicks must never reach that card's handlers
    <div
      class="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        class="modal-panel"
        style={{ maxWidth: `${maxWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
