import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { ComponentChildren } from 'preact';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal primitive: fixed overlay, Esc and backdrop-click close.
 * The panel is an empty shell — callers bring their own padding/layout.
 * Rendered into document.body via a portal so it always paints above the
 * grid (grid items are positioned stacking contexts that would otherwise
 * trap a fixed modal underneath later siblings).
 *
 * Carries proper dialog semantics: role/aria-modal, focus moves in on open,
 * Tab is trapped inside, and focus returns to whatever opened it on close
 * (without which Tab walked straight out into the grid behind).
 */
export function Modal({
  onClose,
  maxWidth = 480,
  label,
  labelledBy,
  children,
}: {
  onClose: () => void;
  /** initial panel width, given in px at the 16px design baseline. It's
      applied as rem so the panel scales with the responsive root font-size
      (see html font-size in base.css) — otherwise a fixed-px width crams the
      (rem-sized) content into a proportionally tiny box on a high-res / large
      display like a wall TV. The user can still resize beyond it. */
  maxWidth?: number;
  /** accessible name; prefer labelledBy pointing at the visible title */
  label?: string;
  labelledBy?: string;
  children: ComponentChildren;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // move focus into the dialog so screen readers and keyboards land here
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === firstEl || activeEl === panel.current)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  // Close only when the press STARTED on the backdrop. Releasing a drag
  // (e.g. the panel's resize handle) over the backdrop also fires a click
  // there — that must not close the dialog.
  const pressedBackdrop = useRef(false);

  return createPortal(
    // stopPropagation on the overlay too: a modal may logically belong to a
    // clickable card, and its clicks must never reach that card's handlers
    <div
      class="modal-overlay"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        // rem (not px) so it scales with the root font; 96vw (not 100%) both
        // caps it to the viewport and avoids the auto-grid-track percentage
        // ambiguity that could collapse it on some browsers
        style={{ width: `min(${maxWidth / 16}rem, 96vw)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
