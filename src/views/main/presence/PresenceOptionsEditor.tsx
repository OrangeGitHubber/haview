import { Modal } from '../../../components/Modal';
import { settings, updateElementOptions, removeElement } from '../../../lib/settings';
import { useEntitiesByDomain } from '../../../lib/ha/entities';
import { friendlyName } from '../../settings/EntitySelect';
import type { GridElement } from '../../../grid/types';
import type { PresenceOptions } from './PresenceWidget';
import opt from '../../../components/options.module.css';

export default function PresenceOptionsEditor({
  pageId,
  element,
  onClose,
}: {
  pageId: string;
  element: GridElement;
  onClose: () => void;
}) {
  const o = (element.options ?? {}) as PresenceOptions;
  const people = useEntitiesByDomain('person').value;
  // companion-app activity sensors ("Activity" on iOS, "Detected activity" on Android)
  const activitySensors = useEntitiesByDomain('sensor').value.filter((s) =>
    s.entity_id.includes('activity'),
  );

  const set = (patch: Partial<PresenceOptions>) =>
    updateElementOptions(pageId, element.id, patch);

  const personMode: 'global' | 'all' | 'custom' =
    o.persons === undefined ? 'global' : o.persons === null ? 'all' : 'custom';

  const shownIds =
    (o.persons !== undefined ? o.persons : settings.peek().presence.personIds) ??
    people.map((p) => p.entity_id);
  const shown = people.filter((p) => shownIds.includes(p.entity_id));

  const togglePerson = (id: string) => {
    const cur = Array.isArray(o.persons) ? o.persons : [];
    set({ persons: cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id] });
  };

  const setActivity = (personId: string, sensorId: string) => {
    const cur = { ...(o.activity ?? {}) };
    if (sensorId) cur[personId] = sensorId;
    else delete cur[personId];
    set({ activity: cur });
  };

  return (
    <Modal onClose={onClose} maxWidth={440}>
      <header class={opt.header}>
        <span>Family presence settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <div class={opt.row}>
          Layout
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${!o.horizontal ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ horizontal: false })}
            >
              Stacked
            </button>
            <button
              class={`${opt.segBtn}${o.horizontal ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ horizontal: true })}
            >
              Horizontal
            </button>
          </div>
        </div>

        <div class={opt.row}>
          People
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${personMode === 'global' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ persons: undefined })}
              title="Follow the selection in Settings → People"
            >
              Global
            </button>
            <button
              class={`${opt.segBtn}${personMode === 'all' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ persons: null })}
            >
              All
            </button>
            <button
              class={`${opt.segBtn}${personMode === 'custom' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ persons: shown.map((p) => p.entity_id) })}
            >
              Choose…
            </button>
          </div>
        </div>

        {personMode === 'custom' && (
          <ul class={opt.checklist}>
            {people.map((p) => (
              <li key={p.entity_id}>
                <label class={opt.checkItem}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(o.persons) && o.persons.includes(p.entity_id)}
                    onChange={() => togglePerson(p.entity_id)}
                  />
                  {friendlyName(p)}
                </label>
              </li>
            ))}
          </ul>
        )}

        <div class={opt.row}>
          Driving detection
          <span class={opt.dim}>
            Pick each person's phone activity sensor; automotive states show a car badge.
          </span>
        </div>
        {shown.map((p) => (
          <label key={p.entity_id} class={opt.row}>
            {friendlyName(p)}
            <select
              value={o.activity?.[p.entity_id] ?? ''}
              onChange={(e) => setActivity(p.entity_id, (e.target as HTMLSelectElement).value)}
            >
              <option value="">None</option>
              {activitySensors.map((s) => (
                <option key={s.entity_id} value={s.entity_id}>
                  {friendlyName(s)}
                </option>
              ))}
            </select>
          </label>
        ))}
        {activitySensors.length === 0 && (
          <p class={opt.dim}>
            No activity sensors found (entity ids containing “activity”). Enable the Activity
            sensor in the HA companion app.
          </p>
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
