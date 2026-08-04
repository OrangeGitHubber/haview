import { settings, updateElementOptions, moveElementToPage } from '../lib/settings';
import type { GridElement } from '../grid/types';
import opt from '../components/options.module.css';

/**
 * Shared per-element title controls: visibility (System/Show/Hide) and
 * title color (theme/top-level default or an own color).
 */
export function CardTitleRow({ pageId, element }: { pageId: string; element: GridElement }) {
  const rawShow = element.options?.showTitle;
  const show = typeof rawShow === 'boolean' ? rawShow : null;
  const rawColor = element.options?.titleColor;
  const color = typeof rawColor === 'string' && rawColor ? rawColor : null;
  const set = (patch: Record<string, unknown>) =>
    updateElementOptions(pageId, element.id, patch);

  return (
    <div class={opt.row}>
      Title
      <div class={opt.seg}>
        <button
          class={`${opt.segBtn}${show === null ? ` ${opt.segActive}` : ''}`}
          onClick={() => set({ showTitle: undefined })}
          title="Follow Settings → Theme → Show card titles"
        >
          System
        </button>
        <button
          class={`${opt.segBtn}${show === true ? ` ${opt.segActive}` : ''}`}
          onClick={() => set({ showTitle: true })}
        >
          Show
        </button>
        <button
          class={`${opt.segBtn}${show === false ? ` ${opt.segActive}` : ''}`}
          onClick={() => set({ showTitle: false })}
        >
          Hide
        </button>
      </div>
      <div class={opt.seg}>
        <input
          type="color"
          value={color ?? '#f28c28'}
          onChange={(e) => set({ titleColor: (e.target as HTMLInputElement).value })}
          aria-label="Title color"
        />
        <button
          class={`${opt.segBtn}${color === null ? ` ${opt.segActive}` : ''}`}
          onClick={() => set({ titleColor: undefined })}
        >
          Default color
        </button>
      </div>
    </div>
  );
}

/**
 * Shared per-element card-opacity control for options editors. Undefined
 * option = follow Settings → Theme → Card opacity.
 */
export function CardOpacityRow({ pageId, element }: { pageId: string; element: GridElement }) {
  const raw = element.options?.opacity;
  const own = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

  return (
    <>
      <div class={opt.row}>
        Card opacity {own !== null ? `· ${own}%` : '· system setting'}
        <div class={opt.seg}>
          <button
            class={`${opt.segBtn}${own === null ? ` ${opt.segActive}` : ''}`}
            onClick={() => updateElementOptions(pageId, element.id, { opacity: undefined })}
          >
            System
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={own ?? settings.peek().cardOpacity}
            onInput={(e) =>
              updateElementOptions(pageId, element.id, {
                opacity: Number((e.target as HTMLInputElement).value),
              })
            }
            style={{ flex: '1', minWidth: '120px' }}
          />
        </div>
      </div>
      <MoveToPageRow pageId={pageId} element={element} />
    </>
  );
}

/**
 * Shared "move this card to another page / collection" control. Moving removes
 * the element from this page, which leaves the options modal with no element to
 * show, so it auto-closes (GridPage: `if (!el || !loader) return null`) — no
 * onClose wiring needed. This is how a card changes which collection it's in.
 */
export function MoveToPageRow({ pageId, element }: { pageId: string; element: GridElement }) {
  const others = settings.value.pages.filter((p) => p.id !== pageId);
  if (others.length === 0) return null;
  return (
    <label class={opt.row}>
      Move to page / collection
      <select
        value=""
        onChange={(e) => {
          const to = (e.target as HTMLSelectElement).value;
          if (to) moveElementToPage(pageId, element.id, to);
        }}
      >
        <option value="">Keep on this page…</option>
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.hidden ? ' · collection' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
