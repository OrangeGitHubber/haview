import { useEffect, useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import {
  ensureRegistries,
  registriesLoaded,
  entityEntries,
  type EntityEntry,
} from '../lib/ha/registries';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

const MAX_RESULTS = 50;

function entryName(en: EntityEntry): string {
  return en.name ?? en.original_name ?? en.entity_id;
}

/** Change which entity this card shows, or remove the card. */
export default function EntityOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const [query, setQuery] = useState('');
  const rawId = element.options?.entityId;
  const current = typeof rawId === 'string' ? rawId : '';

  useEffect(() => {
    ensureRegistries();
  }, []);

  const loaded = registriesLoaded.value;
  const q = query.trim().toLowerCase();
  const matches = q
    ? entityEntries.value
        .filter(
          (en) =>
            en.disabled_by === null &&
            (entryName(en).toLowerCase().includes(q) || en.entity_id.toLowerCase().includes(q)),
        )
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <header class={opt.header}>
        <span>Entity card settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <p class={opt.dim}>
          Currently showing <code>{current || 'nothing'}</code>
        </p>
        <label class={opt.row}>
          Change entity
          <input
            type="search"
            placeholder="Search by name or entity id…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </label>
        {!loaded && q && <p class={opt.dim}>Loading entities…</p>}
        {loaded && q && matches.length === 0 && <p class={opt.dim}>No entities match.</p>}
        {matches.length > 0 && (
          <ul class={opt.checklist}>
            {matches.map((en) => (
              <li key={en.entity_id}>
                <label class={opt.checkItem}>
                  <input
                    type="radio"
                    name="entity"
                    checked={en.entity_id === current}
                    onChange={() =>
                      updateElementOptions(pageId, element.id, { entityId: en.entity_id })
                    }
                  />
                  <span class={opt.checkName}>{entryName(en)}</span>
                  <span class={opt.checkId}>{en.entity_id}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <button
          class={opt.removeBtn}
          onClick={() => {
            removeElement(pageId, element.id);
            onClose();
          }}
        >
          Remove element
        </button>
      </div>
    </Modal>
  );
}
