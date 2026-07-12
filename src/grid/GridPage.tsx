import { useEffect, useRef, useState } from 'preact/hooks';
import {
  settings,
  moveResizeElement,
  removeElement,
  renamePage,
  setPageBackground,
  setPageBackgroundGlass,
  setPageFitHeight,
} from '../lib/settings';
import { elementDefs } from './elements';
import { AsyncView } from '../components/AsyncView';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { GridItem } from './GridItem';
import { AddElementModal } from './AddElementModal';
import { useMediaQuery } from '../lib/useMediaQuery';
import { GRID_COLS, type GridRect } from './types';
import { collides, stackOrder } from './layout';
import opt from '../components/options.module.css';
import styles from './grid.module.css';

// must match --grid-row / --grid-gap in theme.css
const ROW = 28;
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

export default function GridPage({
  pageId,
  readOnly,
}: {
  pageId: string;
  /** view-only, no edit FAB — used when embedding a page inside a Popup
      element's modal, where a second fixed-position pencil FAB would
      visually overlap the outer page's own (both are position:fixed, so
      neither is actually scoped to the modal) */
  readOnly?: boolean;
}) {
  const page = settings.value.pages.find((p) => p.id === pageId);
  const narrow = useMediaQuery('(max-width: 699px)');
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [availH, setAvailH] = useState(0);

  useEffect(() => {
    if (narrow) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setWidth(r.width);
      // space from the grid's top to the bottom of the viewport (for fit mode)
      setAvailH(Math.max(window.innerHeight - r.top - 16, 120));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [narrow, editing]);

  if (!page) return null;
  const elements = page.elements;

  /* ---------- narrow screens: single column by (y, x), no editing ---------- */

  if (narrow) {
    return (
      <div class={styles.stack}>
        {elements.length === 0 && (
          <EmptyState message="This page is empty. Use a wider screen to edit its layout." />
        )}
        {stackOrder(elements)
          .filter((el) => {
            // per-element hide-on-phones; the clock is hidden by default
            const raw = el.options?.hideOnMobile;
            return typeof raw === 'boolean' ? !raw : el.type !== 'clock';
          })
          .map((el) => {
          const def = elementDefs[el.type];
          const stackStyle: Record<string, string> = {
            minHeight: `min(${el.h * (ROW + GAP) - GAP}px, 60vh)`,
          };
          const elAlpha = el.options?.opacity;
          const effAlpha =
            typeof elAlpha === 'number' && Number.isFinite(elAlpha)
              ? Math.min(Math.max(elAlpha, 0), 100)
              : settings.value.cardOpacity;
          if (typeof elAlpha === 'number' && Number.isFinite(elAlpha)) {
            stackStyle['--card-alpha'] = `${effAlpha}%`;
          }
          if (effAlpha === 0) stackStyle['--shadow-card'] = 'none';
          const stackTitle =
            typeof el.options?.showTitle === 'boolean'
              ? el.options.showTitle
              : typeof page.showTitles === 'boolean'
                ? page.showTitles
                : settings.value.showTitles;
          const stackTitleColor = el.options?.titleColor;
          if (typeof stackTitleColor === 'string' && stackTitleColor) {
            stackStyle['--title-color'] = stackTitleColor;
          }
          return (
            <section
              key={el.id}
              class={`${styles.stackItem}${stackTitle ? '' : ' hide-card-title'}`}
              style={stackStyle}
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

  const contentRows = elements.reduce((m, e) => Math.max(m, e.y + e.h), 0);

  // "Fit to screen height": scale the row height so the layout fills the
  // viewport top-to-bottom on any display. This now applies while EDITING too
  // — it used to fall back to fixed 28px rows in edit mode, which collapsed a
  // wall-display page into the top corner and made it painful to edit. Now you
  // edit at the same scale you view.
  const fit = !!page.fitHeight;

  // Rows the layout is scaled around. Excludes the live drag extent so rowH
  // (hence every widget's on-screen size) stays STABLE while dragging instead
  // of rescaling under the cursor. The +3 edit headroom is only added for
  // non-fit pages (which scroll anyway); a fit page fills the viewport exactly
  // and rescales to keep everything in view as content is added.
  const baseRows = Math.max(contentRows, editing && !fit ? contentRows + 3 : 0, 3);
  const rowH =
    fit && availH > 0 ? Math.max((availH - GAP * (baseRows - 1)) / baseRows, 10) : ROW;

  const snapOf = (d: DragState): GridRect => {
    const type = elements.find((e) => e.id === d.id)?.type ?? '';
    const min = elementDefs[type]?.minSize ?? { w: 1, h: 1 };
    const dc = cellW > 0 ? Math.round(d.dx / (cellW + GAP)) : 0;
    // divide by the ACTUAL row pitch so a drag tracks the pointer at whatever
    // scale fit has chosen (rowH === ROW when fit is off, so non-fit pages are
    // unchanged)
    const dr = Math.round(d.dy / (rowH + GAP));
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

  // container may still grow past the fitted area if a widget is dragged below
  // it (the page scrolls while editing); rowH above stays fixed regardless
  const rows = Math.max(baseRows, dragSnap ? dragSnap.y + dragSnap.h : 0);

  const pxRect = (r: GridRect) => ({
    left: `${r.x * (cellW + GAP)}px`,
    top: `${r.y * (rowH + GAP)}px`,
    width: `${r.w * cellW + (r.w - 1) * GAP}px`,
    height: `${r.h * rowH + (r.h - 1) * GAP}px`,
  });

  const finishDrag = () => {
    if (drag) {
      // a press that barely moved is a tap → open the element's options.
      // 14px slop so finger taps on a touchscreen still count (a mouse click
      // is ~0px; a finger tap jitters several px).
      const isTap = drag.mode === 'move' && Math.abs(drag.dx) < 14 && Math.abs(drag.dy) < 14;
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
          <button class={styles.addBtn} onClick={() => setBgOpen(true)}>
            Background…
          </button>
          <button
            class={`${styles.addBtn}${page.fitHeight ? ` ${styles.addBtnOn}` : ''}`}
            onClick={() => setPageFitHeight(pageId, !page.fitHeight)}
            title="Scale this page to fill the screen height on any display"
          >
            Fit height {page.fitHeight ? '✓' : ''}
          </button>
          <input
            class={styles.toolbarTitle}
            type="text"
            value={page.title}
            aria-label="Page name"
            onInput={(e) => renamePage(pageId, (e.target as HTMLInputElement).value)}
          />
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
          height: `${rows * (rowH + GAP) - GAP}px`,
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
          // per-element card opacity overrides the global setting
          const elAlpha = el.options?.opacity;
          const effAlpha =
            typeof elAlpha === 'number' && Number.isFinite(elAlpha)
              ? Math.min(Math.max(elAlpha, 0), 100)
              : settings.value.cardOpacity;
          if (typeof elAlpha === 'number' && Number.isFinite(elAlpha)) {
            style = { ...style, '--card-alpha': `${effAlpha}%` };
          }
          // fully transparent cards drop their shadow (border fades via CSS)
          if (effAlpha === 0) style = { ...style, '--shadow-card': 'none' };
          const showTitle =
            typeof el.options?.showTitle === 'boolean'
              ? el.options.showTitle
              : typeof page.showTitles === 'boolean'
                ? page.showTitles
                : settings.value.showTitles;
          const titleColor = el.options?.titleColor;
          if (typeof titleColor === 'string' && titleColor) {
            style = { ...style, '--title-color': titleColor };
          }
          if (isDragged && drag) {
            if (drag.mode === 'move') {
              style = {
                ...style,
                left: `${el.x * (cellW + GAP) + drag.dx}px`,
                top: `${el.y * (rowH + GAP) + drag.dy}px`,
              };
            } else {
              style = {
                ...style,
                width: `${Math.max(el.w * cellW + (el.w - 1) * GAP + drag.dx, cellW)}px`,
                height: `${Math.max(el.h * rowH + (el.h - 1) * GAP + drag.dy, rowH)}px`,
              };
            }
          }
          return (
            <GridItem
              key={el.id}
              style={style}
              editing={editing}
              hideTitle={!showTitle}
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

      {!editing && !readOnly && (
        <button class={styles.fab} onClick={() => setEditing(true)} aria-label="Edit layout">
          <svg viewBox="0 0 24 24">
            <path d={PENCIL} fill="currentColor" />
          </svg>
        </button>
      )}

      {adding && (
        <AddElementModal
          pageId={pageId}
          onClose={() => setAdding(false)}
          onPlaced={(id) => setOptionsFor(id)}
        />
      )}

      {bgOpen && (
        <Modal onClose={() => setBgOpen(false)} maxWidth={440}>
          <header class={opt.header}>
            <span>Page background</span>
            <button class={opt.close} onClick={() => setBgOpen(false)} aria-label="Close">
              ✕
            </button>
          </header>
          <div class={opt.form}>
            <label class={opt.row}>
              Image URL
              <input
                type="text"
                value={page.background ?? ''}
                placeholder="https://… or /local/wall.jpg (served by HA)"
                onChange={(e) => {
                  // HA serves config/www at /local/ — auto-correct the common mistake
                  const v = (e.target as HTMLInputElement).value
                    .trim()
                    .replace(/^\/config\/www\//, '/local/');
                  setPageBackground(pageId, v || undefined);
                }}
              />
            </label>
            <p class={opt.dim}>
              The image is shown frosted (blurred and dimmed) behind everything on this page.
            </p>
            <p class={opt.dim}>
              <strong>Using an image stored in Home Assistant:</strong> copy the file into the
              “www” folder inside your HA config directory (create the folder and restart HA if
              it's new), then enter <code>/local/your-image.jpg</code> here — HA serves the www
              folder under /local/. Typing /config/www/… is corrected automatically.
            </p>
            <p class={opt.dim}>
              <strong>Using an image from the internet:</strong> paste the full https:// URL.
            </p>
            <label class={opt.row}>
              Glassiness · {page.backgroundGlass ?? 50}%
              <input
                type="range"
                min={0}
                max={100}
                value={page.backgroundGlass ?? 50}
                onInput={(e) =>
                  setPageBackgroundGlass(pageId, Number((e.target as HTMLInputElement).value))
                }
              />
            </label>
            <div class={opt.footerRow}>
              <button
                class={opt.removeBtn}
                onClick={() => {
                  setPageBackground(pageId, undefined);
                  setBgOpen(false);
                }}
              >
                Remove background
              </button>
              <button class={opt.doneBtn} onClick={() => setBgOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

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
