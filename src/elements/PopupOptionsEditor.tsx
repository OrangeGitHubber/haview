import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import {
  settings,
  addPage,
  updateElementOptions,
  removeElement,
  renamePage,
  setPageIcon,
} from '../lib/settings';
import { navigate } from '../lib/router';
import { iconPath } from '../lib/icons';
import { IconPickerModal } from '../views/settings/IconPickerModal';
import { CardOpacityRow } from './CardOpacityRow';
import type { PopupOptions } from './PopupCard';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

export default function PopupOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as PopupOptions;
  const pages = settings.value.pages;
  const currentPage = pages.find((p) => p.id === pageId);
  const target = o.targetPageId ? pages.find((p) => p.id === o.targetPageId) : undefined;
  // pointing at its own page is invalid (recurses/freezes in panel mode, and
  // "open" goes nowhere) — treat it as not-linked so it can be re-pointed
  const selfRef = !!target && target.id === pageId;
  const linked = target && !selfRef ? target : undefined;
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [relink, setRelink] = useState(false);
  const set = (patch: Partial<PopupOptions>) => updateElementOptions(pageId, element.id, patch);

  const createCollection = () => {
    const page = addPage({ title: newName.trim() || 'New collection', hidden: true });
    set({ targetPageId: page.id });
    setNewName('');
  };

  // never offer this element's own page as a target
  const others = pages.filter((p) => p.id !== pageId);
  const pageOptions = others.map((p) => (
    <option key={p.id} value={p.id}>
      {p.title}
      {p.hidden ? '' : ' (in sidebar)'}
    </option>
  ));

  return (
    <Modal onClose={onClose} maxWidth={430}>
      <header class={opt.header}>
        <span>Collection settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        {!linked ? (
          /* not linked (or self-referencing) — creating is the primary path */
          <>
            {selfRef && (
              <p class={opt.warn}>
                This collection was pointing at its own page, which can't work. Create a new one or
                link a different page below.
              </p>
            )}
            <p class={opt.dim}>
              A collection is a group of devices on their own page. This card stays here on{' '}
              <strong>{currentPage?.title ?? 'this page'}</strong>; the devices live on the
              collection's own page.
            </p>
            <label class={opt.row}>
              Name the new collection
              <div class={opt.seg}>
                <input
                  type="text"
                  value={newName}
                  placeholder="e.g. Bedroom"
                  style={{ flex: 1 }}
                  onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCollection();
                  }}
                />
                <button class={opt.segBtn} onClick={createCollection}>
                  Create
                </button>
              </div>
            </label>
            {others.length > 0 && (
              <label class={opt.row}>
                …or link an existing collection
                <select
                  value=""
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v) set({ targetPageId: v });
                  }}
                >
                  <option value="">Choose a page…</option>
                  {pageOptions}
                </select>
              </label>
            )}
          </>
        ) : (
          /* linked — name / how it shows / open, with re-link tucked away */
          <>
            <label class={opt.row}>
              Name
              <input
                type="text"
                value={linked.title}
                onInput={(e) => renamePage(linked.id, (e.target as HTMLInputElement).value)}
              />
            </label>

            <label class={opt.row}>
              Show as
              <select
                value={o.display ?? 'tile'}
                onChange={(e) =>
                  set({ display: (e.target as HTMLSelectElement).value as 'tile' | 'panel' })
                }
              >
                <option value="tile">Tile — tap to open</option>
                <option value="panel">Panel — devices shown inline</option>
              </select>
            </label>

            <div class={opt.row}>
              Icon
              <button class={opt.iconBtn} onClick={() => setIconPickerOpen(true)}>
                <svg viewBox="0 0 24 24">
                  <path d={iconPath(o.icon || linked.icon || 'home')} fill="currentColor" />
                </svg>
              </button>
            </div>

            <CardOpacityRow pageId={pageId} element={element} />

            <button
              class={opt.doneBtn}
              style={{ justifySelf: 'start' }}
              onClick={() => {
                onClose();
                navigate(linked.id);
              }}
            >
              Open “{linked.title}” to add devices →
            </button>

            {relink ? (
              <label class={opt.row}>
                Point at a different collection
                <select
                  value=""
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v) {
                      set({ targetPageId: v });
                      setRelink(false);
                    }
                  }}
                >
                  <option value="">Choose a page…</option>
                  {pageOptions}
                </select>
              </label>
            ) : (
              <button class={opt.linkBtn} onClick={() => setRelink(true)}>
                Point at a different collection…
              </button>
            )}
          </>
        )}

        <div class={opt.footerRow}>
          <button
            class={opt.removeBtn}
            onClick={() => {
              removeElement(pageId, element.id);
              onClose();
            }}
          >
            Remove element
          </button>
          <button class={opt.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      {iconPickerOpen && (
        <IconPickerModal
          current={o.icon || linked?.icon || 'home'}
          onPick={(name) => {
            if (linked) setPageIcon(linked.id, name);
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </Modal>
  );
}
