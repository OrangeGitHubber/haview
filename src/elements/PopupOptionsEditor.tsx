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
  const target = o.targetPageId ? pages.find((p) => p.id === o.targetPageId) : undefined;
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [justCreated, setJustCreated] = useState<{ id: string; title: string } | null>(null);
  const set = (patch: Partial<PopupOptions>) => updateElementOptions(pageId, element.id, patch);

  const createRoom = () => {
    const name = newRoomName.trim();
    if (!name) return;
    const page = addPage({ title: name, hidden: true });
    set({ targetPageId: page.id });
    setJustCreated({ id: page.id, title: page.title });
    setNewRoomName('');
  };

  return (
    <Modal onClose={onClose} maxWidth={420}>
      <header class={opt.header}>
        <span>Collection settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <label class={opt.row}>
          Collection page
          <select
            value={o.targetPageId ?? ''}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              set({ targetPageId: v || undefined });
              setJustCreated(null);
            }}
          >
            <option value="">Choose a page…</option>
            {/* exclude this element's own page — a collection can't point at
                itself (that would recurse and freeze in panel mode) */}
            {pages
              .filter((p) => p.id !== pageId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.hidden ? '' : ' (also shown in sidebar)'}
                </option>
              ))}
          </select>
        </label>

        <div class={opt.row}>
          Or create a new collection
          <div class={opt.seg}>
            <input
              type="text"
              value={newRoomName}
              placeholder="e.g. Outside"
              style={{ flex: 1 }}
              onInput={(e) => setNewRoomName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createRoom();
              }}
            />
            <button class={opt.segBtn} onClick={createRoom} disabled={!newRoomName.trim()}>
              Create
            </button>
          </div>
          <span class={opt.dim}>
            Creates a new collection page, hidden from the sidebar, and links it here. It starts
            empty — add devices to it the same way as any page.
          </span>
        </div>

        {justCreated && (
          <p class={opt.dim}>
            Created “{justCreated.title}” — it's empty for now.{' '}
            <button
              class={opt.segBtn}
              style={{ display: 'inline' }}
              onClick={() => navigate(justCreated.id)}
            >
              Open it to add devices →
            </button>
          </p>
        )}

        {target && (
          <p class={opt.dim}>
            Linked to <strong>{target.title}</strong>.{' '}
            <button
              class={opt.segBtn}
              style={{ display: 'inline' }}
              onClick={() => navigate(target.id)}
            >
              Open it to edit devices →
            </button>
          </p>
        )}

        <label class={opt.row}>
          Show as
          <select
            value={o.display ?? 'tile'}
            onChange={(e) =>
              set({ display: (e.target as HTMLSelectElement).value as 'tile' | 'panel' })
            }
          >
            <option value="tile">Tile — tap to open</option>
            <option value="panel">Panel — cards shown inline</option>
          </select>
        </label>

        <label class={opt.row}>
          Title
          <input
            type="text"
            value={o.title ?? ''}
            placeholder={target?.title ?? 'Collection'}
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </label>

        <div class={opt.row}>
          Icon
          <button class={opt.iconBtn} onClick={() => setIconPickerOpen(true)}>
            <svg viewBox="0 0 24 24">
              <path d={iconPath(o.icon || target?.icon || 'home')} fill="currentColor" />
            </svg>
          </button>
        </div>

        <CardOpacityRow pageId={pageId} element={element} />

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
