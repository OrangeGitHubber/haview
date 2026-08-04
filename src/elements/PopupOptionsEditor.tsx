import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { settings, addPage, updateElementOptions, removeElement } from '../lib/settings';
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
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [linkExisting, setLinkExisting] = useState(false);
  const set = (patch: Partial<PopupOptions>) => updateElementOptions(pageId, element.id, patch);

  const createCollection = () => {
    const name = newName.trim();
    if (!name) return;
    const page = addPage({ title: name, hidden: true });
    set({ targetPageId: page.id });
    setNewName('');
  };

  // exclude this element's own page — a collection can't point at itself
  // (that would recurse and freeze in panel mode)
  const others = pages.filter((p) => p.id !== pageId);

  return (
    <Modal onClose={onClose} maxWidth={430}>
      <header class={opt.header}>
        <span>Collection settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        {!target ? (
          /* not linked yet — creating a new collection is the primary path */
          <>
            <p class={opt.dim}>
              A collection is a group of devices on their own page. This card stays here on{' '}
              <strong>{currentPage?.title ?? 'this page'}</strong> and shows that collection; its
              devices live on the collection's own page.
            </p>
            <label class={opt.row}>
              Name the new collection
              <div class={opt.seg}>
                <input
                  type="text"
                  value={newName}
                  placeholder="e.g. Outside"
                  style={{ flex: 1 }}
                  onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCollection();
                  }}
                />
                <button class={opt.segBtn} onClick={createCollection} disabled={!newName.trim()}>
                  Create
                </button>
              </div>
            </label>
            {others.length > 0 &&
              (linkExisting ? (
                <label class={opt.row}>
                  Link an existing page instead
                  <select
                    value=""
                    onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      if (v) set({ targetPageId: v });
                    }}
                  >
                    <option value="">Choose a page…</option>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {p.hidden ? '' : ' (also in sidebar)'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <button class={opt.linkBtn} onClick={() => setLinkExisting(true)}>
                  …or link an existing page
                </button>
              ))}
          </>
        ) : (
          /* linked — show what it points at and how it displays */
          <>
            <p class={opt.dim}>
              Showing <strong>{target.title}</strong> —{' '}
              <button
                class={opt.linkBtn}
                style={{ display: 'inline' }}
                onClick={() => navigate(target.id)}
              >
                open to add or edit its devices →
              </button>
            </p>

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

            <label class={opt.row}>
              Title
              <input
                type="text"
                value={o.title ?? ''}
                placeholder={target.title}
                onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
              />
            </label>

            <div class={opt.row}>
              Icon
              <button class={opt.iconBtn} onClick={() => setIconPickerOpen(true)}>
                <svg viewBox="0 0 24 24">
                  <path d={iconPath(o.icon || target.icon || 'home')} fill="currentColor" />
                </svg>
              </button>
            </div>

            <CardOpacityRow pageId={pageId} element={element} />

            <button class={opt.linkBtn} onClick={() => set({ targetPageId: undefined })}>
              Point this at a different collection…
            </button>
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
          current={o.icon || target?.icon || 'home'}
          onPick={(name) => set({ icon: name })}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </Modal>
  );
}
