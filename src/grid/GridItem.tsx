import type { ComponentChildren, JSX } from 'preact';
import { GEAR_ICON } from '../lib/icons';
import styles from './grid.module.css';

const X_ICON =
  'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

// "open elsewhere" — move this card to another page/collection
const MOVE_ICON =
  'M19 13v6H5V5h6V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z';

/**
 * One absolutely-positioned grid element. In edit mode a transparent overlay
 * captures pointer drags (so card-internal buttons are inert), an SE handle
 * resizes, and a ✕ badge deletes. Pointer capture keeps move/up events
 * flowing to the pressed element even outside its bounds.
 */
export function GridItem({
  style,
  editing,
  hideTitle,
  dragged,
  onStart,
  onMove,
  onEnd,
  onDelete,
  onOptions,
  onRelocate,
  children,
}: {
  style: JSX.CSSProperties;
  editing: boolean;
  /** hides elements marked .card-title inside this item */
  hideTitle?: boolean;
  dragged: boolean;
  onStart: (mode: 'move' | 'resize', clientX: number, clientY: number) => void;
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
  onDelete: () => void;
  /** present when the element type has a per-instance options editor */
  onOptions?: () => void;
  /** opens the "move this card to another page/collection" picker */
  onRelocate?: () => void;
  children: ComponentChildren;
}) {
  const press =
    (mode: 'move' | 'resize') => (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onStart(mode, e.clientX, e.clientY);
    };
  const move = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (dragged) onMove(e.clientX, e.clientY);
  };
  const end = () => {
    if (dragged) onEnd();
  };

  const cls = [
    styles.item,
    editing ? styles.itemEditing : '',
    dragged ? styles.itemDragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={cls} style={style}>
      <div class={`${styles.itemContent}${hideTitle ? ' hide-card-title' : ''}`}>{children}</div>
      {editing && (
        <>
          <div
            class={styles.moveOverlay}
            onPointerDown={press('move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <div
            class={styles.resizeHandle}
            onPointerDown={press('resize')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-hidden="true"
          />
          <button
            class={styles.deleteBadge}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            aria-label="Remove element"
          >
            <svg viewBox="0 0 24 24">
              <path d={X_ICON} fill="currentColor" />
            </svg>
          </button>
          {onRelocate && (
            <button
              class={styles.moveBadge}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onRelocate}
              aria-label="Move to another page or collection"
            >
              <svg viewBox="0 0 24 24">
                <path d={MOVE_ICON} fill="currentColor" />
              </svg>
            </button>
          )}
          {onOptions && (
            <button
              class={styles.optionsBadge}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onOptions}
              aria-label="Element settings"
            >
              <svg viewBox="0 0 24 24">
                <path d={GEAR_ICON} fill="currentColor" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}
