import { useState } from 'preact/hooks';
import { EntityPicker } from '../grid/EntityPicker';
import { useEntity } from '../lib/ha/entities';
import { friendlyName } from '../views/settings/EntitySelect';
import type { EntityEntry } from '../lib/ha/registries';
import opt from '../components/options.module.css';

/**
 * Which entity a card shows, as a summary line plus a "Change…" button that
 * reveals the picker on demand.
 *
 * The full device browser used to be embedded inline and permanently open,
 * which meant the rarest control in the dialog (you pick the entity once, when
 * the card is created) took up most of its height and pushed everything else
 * below the fold.
 */
export function EntityChooser({
  current,
  onPick,
  filter,
  emptyLabel = 'No entity selected',
}: {
  current: string;
  onPick: (entityId: string) => void;
  filter?: (en: EntityEntry) => boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(!current);
  const entity = useEntity(current).value;
  const name = current ? (entity ? friendlyName(entity) : current) : emptyLabel;

  return (
    <>
      <div class={opt.summary}>
        <span class={opt.summaryText}>
          <span class={opt.summaryName}>{name}</span>
          {/* an entity HA doesn't know falls back to its own id as the name —
              don't print the same string twice */}
          {current && name !== current && <span class={opt.summaryId}>{current}</span>}
        </span>
        <button class={opt.segBtn} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Done' : current ? 'Change…' : 'Choose…'}
        </button>
      </div>
      {open && (
        <EntityPicker
          current={current || undefined}
          filter={filter}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
