import { useState } from 'preact/hooks';
import { settings } from '../lib/settings';
import { navigate } from '../lib/router';
import { iconPath } from '../lib/icons';
import { Modal } from '../components/Modal';
import { AsyncView } from '../components/AsyncView';
import GridPage from '../grid/GridPage';
import { elementDefs, type ElementProps } from '../grid/elements';
import { stackOrder } from '../grid/layout';
import elementStyles from './elements.module.css';
import styles from './popup.module.css';

/**
 * A "collection" — a group of devices/cards that lives on its own page
 * (normally flagged `hidden` so it doesn't also clutter the nav sidebar).
 * Surfaces two ways, chosen by `display`:
 *   - 'tile'  : a tap-to-open button that opens the collection's grid in a
 *               modal (read-only; edit it via Settings → Pages → Open).
 *   - 'panel' : the collection's cards shown inline, live and read-only,
 *               auto-flowed under a header — the cards stay interactive
 *               (tap a light to toggle it); only the *layout* is read-only,
 *               edited on the collection's own page. Tap the header to open it.
 * A collection is a page, so "you can't add a card to a card" holds: cards are
 * added on the collection's page, never nested into this element.
 */
export interface PopupOptions {
  /** id of the collection page this element points at */
  targetPageId?: string;
  /** overrides the collection page's own title */
  title?: string;
  /** overrides the collection page's own icon */
  icon?: string;
  /** how the collection is shown; defaults to 'tile' (unchanged legacy behaviour) */
  display?: 'tile' | 'panel';
}

export default function PopupCard({ element }: ElementProps) {
  const o = (element.options ?? {}) as PopupOptions;
  const [open, setOpen] = useState(false);
  const target = o.targetPageId
    ? settings.value.pages.find((p) => p.id === o.targetPageId)
    : undefined;
  const title = o.title?.trim() || target?.title || 'Collection';
  const icon = o.icon || target?.icon || 'home';

  if (!target) {
    return (
      <div class={elementStyles.card}>
        <p class={styles.hint}>
          No collection selected — tap this card in page edit mode to pick one.
        </p>
      </div>
    );
  }

  // ---- inline panel: the collection's cards, live + read-only, auto-flowed ----
  if (o.display === 'panel') {
    // An empty collection is a clearly-visible, tappable placeholder (not a
    // blank header that can even vanish when titles are off) so a freshly
    // created collection is obviously there and you can tap in to add devices.
    if (target.elements.length === 0) {
      return (
        <button
          class={styles.panelEmpty}
          onClick={() => navigate(target.id)}
          title="Open collection to add devices"
        >
          <svg class={styles.panelEmptyIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d={iconPath(icon)} fill="currentColor" />
          </svg>
          <span class={styles.panelEmptyTitle}>{title}</span>
          <span class={styles.panelEmptyHint}>Empty — tap to add devices</span>
        </button>
      );
    }
    const globalTitles = settings.value.showTitles;
    return (
      <div class={styles.panel}>
        <button class={styles.panelHead} onClick={() => navigate(target.id)} title="Open collection">
          <svg class={styles.panelHeadIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d={iconPath(icon)} fill="currentColor" />
          </svg>
          <span class={styles.panelTitle}>{title}</span>
          <svg class={styles.panelOpen} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div class={styles.panelFlow}>
          {stackOrder(target.elements).map((el) => {
            // Never render a nested collection inline: a collection whose panel
            // (directly or transitively) contains itself would recurse forever
            // and freeze the app. Show a nested collection as a nav tile
            // instead — this breaks every possible cycle.
            if (el.type === 'popup') {
              const po = (el.options ?? {}) as PopupOptions;
              const sub = po.targetPageId
                ? settings.value.pages.find((p) => p.id === po.targetPageId)
                : undefined;
              return (
                <button
                  key={el.id}
                  class={styles.subCollection}
                  style={{ gridRow: 'span 2' }}
                  onClick={() => sub && navigate(sub.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={iconPath(po.icon || sub?.icon || 'home')} fill="currentColor" />
                  </svg>
                  <span>{po.title?.trim() || sub?.title || 'Collection'}</span>
                </button>
              );
            }
            const def = elementDefs[el.type];
            const elAlpha = el.options?.opacity;
            const hasAlpha = typeof elAlpha === 'number' && Number.isFinite(elAlpha);
            const effAlpha = hasAlpha
              ? Math.min(Math.max(elAlpha as number, 0), 100)
              : settings.value.cardOpacity;
            const itemStyle: Record<string, string> = {
              // taller cards get more rows; capped so one card can't dominate
              gridRow: `span ${Math.min(Math.max(Math.round(el.h / 2), 1), 4)}`,
            };
            if (hasAlpha) itemStyle['--card-alpha'] = `${effAlpha}%`;
            if (effAlpha === 0) {
              itemStyle['--shadow-card'] = 'none';
              itemStyle['--card-blur'] = 'none';
            }
            const tc = el.options?.titleColor;
            if (typeof tc === 'string' && tc) itemStyle['--title-color'] = tc;
            const showTitle =
              typeof el.options?.showTitle === 'boolean'
                ? el.options.showTitle
                : typeof target.showTitles === 'boolean'
                  ? target.showTitles
                  : globalTitles;
            return (
              <div
                key={el.id}
                class={`${styles.flowItem}${showTitle ? '' : ' hide-card-title'}`}
                style={itemStyle}
              >
                {def ? (
                  <AsyncView
                    load={def.load}
                    props={{ pageId: target.id, element: el, editing: false }}
                  />
                ) : (
                  <div class={styles.unknownMini}>“{el.type}”</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- tile: tap to open the collection full-screen (modal) ----
  return (
    <>
      <button class={`${elementStyles.card} ${styles.trigger}`} onClick={() => setOpen(true)}>
        <svg class={styles.triggerIcon} viewBox="0 0 24 24" aria-hidden="true">
          <path d={iconPath(icon)} fill="currentColor" />
        </svg>
        <span class={styles.triggerLabel}>{title}</span>
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} maxWidth={1100}>
          <header class={styles.popupHeader}>
            <svg class={styles.popupHeaderIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path d={iconPath(icon)} fill="currentColor" />
            </svg>
            <span class={styles.popupHeaderTitle}>{title}</span>
            <button class={styles.popupClose} onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </header>
          <div class={styles.popupBody}>
            <GridPage pageId={target.id} readOnly />
          </div>
        </Modal>
      )}
    </>
  );
}
