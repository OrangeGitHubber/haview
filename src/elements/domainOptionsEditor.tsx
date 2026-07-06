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
    const entities = useEntitiesByDomain(domain).value;
    const rawId = element.options?.entityId;
    const current = typeof rawId === 'string' ? rawId : '';

    return (
      <Modal onClose={onClose} maxWidth={420}>
        <header class={opt.header}>
          <span>{label}</span>
          <button class={opt.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div class={opt.form}>
          {entities.length === 0 && <p class={opt.dim}>No {domain} entities found.</p>}
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
  };
}
