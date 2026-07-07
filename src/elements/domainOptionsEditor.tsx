import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import { useEntitiesByDomain } from '../lib/ha/entities';
import { friendlyName } from '../views/settings/EntitySelect';
import type { GridElement } from '../grid/types';
import opt from '../components/options.module.css';

export interface EditorProps {
  pageId: string;
  element: GridElement;
  onClose: () => void;
}

/** Options editor for elements that just pick one entity of a fixed domain. */
export function makeDomainOptionsEditor(domain: string, label: string) {
  return function DomainOptionsEditor({ pageId, element, onClose }: EditorProps) {
    const all = useEntitiesByDomain(domain).value;
    const [query, setQuery] = useState('');
    const rawId = element.options?.entityId;
    const current = typeof rawId === 'string' ? rawId : '';
    const q = query.trim().toLowerCase();
    const entities = q
      ? all.filter(
          (e) =>
            friendlyName(e).toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q),
        )
      : all;

    return (
      <Modal onClose={onClose} maxWidth={420}>
        <header class={opt.header}>
          <span>{label}</span>
          <button class={opt.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div class={opt.form}>
          {all.length > 5 && (
            <label class={opt.row}>
              <input
                type="search"
                placeholder="Search by name…"
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              />
            </label>
          )}
          {all.length === 0 && <p class={opt.dim}>No {domain} entities found.</p>}
          {all.length > 0 && entities.length === 0 && <p class={opt.dim}>Nothing matches.</p>}
          <ul class={opt.checklist}>
            {entities.map((e) => (
              <li key={e.entity_id}>
                <label class={opt.checkItem}>
                  <input
                    type="radio"
                    name="entity"
                    checked={e.entity_id === current}
                    onChange={() =>
                      updateElementOptions(pageId, element.id, { entityId: e.entity_id })
                    }
                  />
                  <span class={opt.checkName}>{friendlyName(e)}</span>
                  <span class={opt.checkId}>{e.entity_id}</span>
                </label>
              </li>
            ))}
          </ul>
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
      </Modal>
    );
  };
}
