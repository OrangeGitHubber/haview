import { OptionsDialog, Section, Field, WideField } from '../../../components/OptionsDialog';
import { settings, updateElementOptions } from '../../../lib/settings';
import { useEntitiesByDomain } from '../../../lib/ha/entities';
import { friendlyName } from '../../settings/EntitySelect';
import { TextSizeRow } from '../../../elements/TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../../../lib/fontSizePresets';
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
  const fontScale = typeof o.fontScale === 'number' ? o.fontScale : DEFAULT_FONT_SCALE;
  const people = useEntitiesByDomain('person').value;
  const sensors = useEntitiesByDomain('sensor').value;
  // companion-app activity sensors ("Activity" on iOS, "Detected activity" on Android)
  const activitySensors = sensors.filter((s) => s.entity_id.includes('activity'));
  // companion-app "Geocoded Location" sensors — their state is the address
  const geocodeSensors = sensors.filter((s) => s.entity_id.includes('geocoded'));

  const set = (patch: Partial<PresenceOptions>) => updateElementOptions(pageId, element.id, patch);

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

  const setGeocode = (personId: string, sensorId: string) => {
    const cur = { ...(o.geocode ?? {}) };
    if (sensorId) cur[personId] = sensorId;
    else delete cur[personId];
    set({ geocode: cur });
  };

  return (
    <OptionsDialog
      title="Family presence settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={460}
    >
      <Section title="People">
        <Field label="Show">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${personMode === 'global' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ persons: undefined })}
              title="This display's default people selection (all, unless configured before)"
            >
              Default
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
        </Field>
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
      </Section>

      <Section title="Display">
        <Field label="Layout">
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
        </Field>
        <Field label="Last update time">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${!o.showLastSeen ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showLastSeen: false })}
            >
              Hide
            </button>
            <button
              class={`${opt.segBtn}${o.showLastSeen ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showLastSeen: true })}
            >
              Show
            </button>
          </div>
        </Field>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>

      <Section title="Driving detection">
        <p class={opt.dim}>
          Pick each person's phone activity sensor; automotive states show a car badge.
        </p>
        {activitySensors.length === 0 ? (
          <p class={opt.dim}>
            No activity sensors found (entity ids containing “activity”). Enable the Activity sensor
            in the HA companion app.
          </p>
        ) : (
          shown.map((p) => (
            <WideField key={p.entity_id} label={friendlyName(p)}>
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
            </WideField>
          ))
        )}
      </Section>

      <Section title="Street address when away">
        <Field label="Address">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${!o.showAddress ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showAddress: false })}
            >
              Hide
            </button>
            <button
              class={`${opt.segBtn}${o.showAddress ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showAddress: true })}
            >
              Show
            </button>
          </div>
        </Field>
        <p class={opt.dim}>
          Uses each person's “Geocoded Location” sensor from the HA companion app; the address shows
          on the card (and the map) when they're not in a known zone.
        </p>
        {o.showAddress && geocodeSensors.length === 0 && (
          <p class={opt.dim}>
            No geocoded-location sensors found (entity ids containing “geocoded”). Enable the
            Geocoded Location sensor in the HA companion app.
          </p>
        )}
        {o.showAddress &&
          geocodeSensors.length > 0 &&
          shown.map((p) => (
            <WideField key={`geo-${p.entity_id}`} label={`${friendlyName(p)} — location sensor`}>
              <select
                value={o.geocode?.[p.entity_id] ?? ''}
                onChange={(e) => setGeocode(p.entity_id, (e.target as HTMLSelectElement).value)}
              >
                <option value="">None</option>
                {geocodeSensors.map((s) => (
                  <option key={s.entity_id} value={s.entity_id}>
                    {friendlyName(s)}
                  </option>
                ))}
              </select>
            </WideField>
          ))}
      </Section>
    </OptionsDialog>
  );
}
