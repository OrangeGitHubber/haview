import { useEffect, useRef, useState } from 'preact/hooks';
import { settings, moveResizeElement, removeElement } from '../lib/settings';
import { elementDefs } from './elements';
import { AsyncView } from '../components/AsyncView';
import { EmptyState } from '../components/EmptyState';
import { GridItem } from './GridItem';
import { AddElementModal } from './AddElementModal';
import { useMediaQuery } from '../lib/useMediaQuery';
import { GRID_COLS, type GridRect } from './types';
import { collides, stackOrder } from './layout';
import styles from './grid.module.css';

// must match --grid-row / --grid-gap in theme.css
const ROW = 56;
const GAP = 12;

const PENCIL =
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  /** pointer position at drag start (client px) */
  originX: number;
  originY: number;
  /** current deltas from origin (client px) */
  dx: number;
  dy: number;
  start: GridRect;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function UnknownCard({ type }: { type: string }) {
  return <div class={styles.unknown}>“{type}” is not supported in this version</div>;
}

export default function GridPage({ pageId }: { pageId: string }) {
  const page = settings.value.pages.find((p) => p.id === pageId);
  const narrow = useMediaQuery('(max-width: 699px)');
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (narrow) return;
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [narrow]);

  if (!page) return null;
  const elements = page.elements;

  /* ---------- narrow screens: single column by (y, x), no editing ---------- */

  if (narrow) {
    return (
      <div class={styles.stack}>
        {elements.length === 0 && (
          <EmptyState message="This page is empty. Use a wider screen to edit its layout." />
        )}
        {stackOrder(elements).map((el) => {
          const def = elementDefs[el.type];
          return (
            <section
              key={el.id}
              class={styles.stackItem}
              style={{ minHeight: `min(${el.h * (ROW + GAP) - GAP}px, 60vh)` }}
            >
              {def ? (
                <AsyncView load={def.load} props={{ pageId, element: el, editing: false }} />
              ) : (
                <UnknownCard type={el.type} />
              )}
            </section>
          );
        })}
      </div>
    );
  }

  /* ---------- wide screens: positioned grid ---------- */

  const cellW = width > 0 ? (width - GAP * (GRID_COLS - 1)) / GRID_COLS : 0;

  const snapOf = (d: DragState): GridRect => {
    const type = elements.find((e) => e.id === d.id)?.type ?? '';
    const min = elementDefs[type]?.minSize ?? { w: 1, h: 1 };
    const dc = cellW > 0 ? Math.round(d.dx / (cellW + GAP)) : 0;
    const dr = Math.round(d.dy / (ROW + GAP));
    if (d.mode === 'move') {
      return {
        w: d.start.w,
        h: d.start.h,
        x: clamp(d.start.x + dc, 0, GRID_COLS - d.start.w),
        y: Math.max(0, d.start.y + dr),
      };
    }
    return {
      x: d.start.x,
      y: d.start.y,
      w: clamp(d.start.w + dc, min.w, GRID_COLS - d.start.x),
      h: Math.max(min.h, d.start.h + dr),
    };
  };

  const dragSnap = drag ? snapOf(drag) : null;
  const dragValid = drag !== null && dragSnap !== null && !collides(dragSnap, elements, drag.id);

  const contentRows = elements.reduce((m, e) => Math.max(m, e.y + e.h), 0);
  const rows = Math.max(
    contentRows,
    dragSnap ? dragSnap.y + dragSnap.h : 0,
    editing ? contentRows + 3 : 0,
    3,
  );

  const pxRect = (r: GridRect) => ({
    left: `${r.x * (cellW + GAP)}px`,
    top: `${r.y * (ROW + GAP)}px`,
    width: `${r.w * cellW + (r.w - 1) * GAP}px`,
    height: `${r.h * ROW + (r.h - 1) * GAP}px`,
  });

  const finishDrag = () => {
    if (drag) {
      // a press that never really moved is a tap → open the element's options
      const isTap = drag.mode === 'move' && Math.abs(drag.dx) < 6 && Math.abs(drag.dy) < 6;
      if (isTap) {
        const el = elements.find((e) => e.id === drag.id);
        if (el && elementDefs[el.type]?.optionsLoader) setOptionsFor(el.id);
      } else if (dragSnap && dragValid) {
        const { start } = drag;
        const moved =
          dragSnap.x !== start.x ||
          dragSnap.y !== start.y ||
          dragSnap.w !== start.w ||
          dragSnap.h !== start.h;
        if (moved) moveResizeElement(pageId, drag.id, dragSnap);
      }
    }
    setDrag(null); // invalid drops just clear; CSS transition animates the revert
  };

  return (
    <div class={styles.pageWrap}>
      {editing && (
        <div class={styles.toolbar}>
          <button class={styles.addBtn} onClick={() => setAdding(true)}>
            ＋ Add
          </button>
          <span class={styles.toolbarTitle}>{page.title}</span>
          <button
            class={styles.doneBtn}
            onClick={() => {
              setEditing(false);
              setDrag(null);
            }}
          >
            Done
          </button>
        </div>
      )}

      <div
        ref={wrapRef}
        class={`${styles.container}${editing ? ` ${styles.containerEditing}` : ''}`}
        style={{
          height: `${rows * (ROW + GAP) - GAP}px`,
          '--cell-w': `${cellW + GAP}px`,
        }}
      >
        {editing && drag && dragSnap && (
          <div
            class={`${styles.ghost}${dragValid ? '' : ` ${styles.ghostInvalid}`}`}
            style={pxRect(dragSnap)}
          />
        )}

        {elements.map((el) => {
          const def = elementDefs[el.type];
          const isDragged = drag !== null && drag.id === el.id;
          let style: Record<string, string> = pxRect(el);
          if (isDragged && drag) {
            if (drag.mode === 'move') {
              style = {
                ...style,
                left: `${el.x * (cellW + GAP) + drag.dx}px`,
                top: `${el.y * (ROW + GAP) + drag.dy}px`,
              };
            } else {
              style = {
                ...style,
                width: `${Math.max(el.w * cellW + (el.w - 1) * GAP + drag.dx, cellW)}px`,
                height: `${Math.max(el.h * ROW + (el.h - 1) * GAP + drag.dy, ROW)}px`,
              };
            }
          }
          return (
            <GridItem
              key={el.id}
              style={style}
              editing={editing}
              dragged={isDragged}
              onStart={(mode, cx, cy) =>
                setDrag({
                  id: el.id,
                  mode,
                  originX: cx,
                  originY: cy,
                  dx: 0,
                  dy: 0,
                  start: { x: el.x, y: el.y, w: el.w, h: el.h },
                })
              }
              onMove={(cx, cy) =>
                setDrag((d) => (d ? { ...d, dx: cx - d.originX, dy: cy - d.originY } : d))
              }
              onEnd={finishDrag}
              onDelete={() => removeElement(pageId, el.id)}
              onOptions={def?.optionsLoader ? () => setOptionsFor(el.id) : undefined}
            >
              {def ? (
                <AsyncView load={def.load} props={{ pageId, element: el, editing }} />
              ) : (
                <UnknownCard type={el.type} />
              )}
            </GridItem>
          );
        })}

        {elements.length === 0 && !editing && (
          <div class={styles.emptyHint}>
            <EmptyState message="This page is empty — tap ✎ to add elements." />
          </div>
        )}
      </div>

      {!editing && (
        <button class={styles.fab} onClick={() => setEditing(true)} aria-label="Edit layout">
          <svg viewBox="0 0 24 24">
            <path d={PENCIL} fill="currentColor" />
          </svg>
        </button>
      )}

      {adding && <AddElementModal pageId={pageId} onClose={() => setAdding(false)} />}

      {optionsFor &&
        (() => {
          const el = elements.find((e) => e.id === optionsFor);
          const loader = el ? elementDefs[el.type]?.optionsLoader : undefined;
          if (!el || !loader) return null;
          return (
            <AsyncView
              load={loader}
              props={{ pageId, element: el, onClose: () => setOptionsFor(null) }}
            />
          );
        })()}
    </div>
  );
}
