import { OptionsDialog, Section, Field, WideField } from '../../components/OptionsDialog';
import { settings, updateElementOptions } from '../../lib/settings';
import { useEntitiesByDomain } from '../../lib/ha/entities';
import { friendlyName } from '../settings/EntitySelect';
import { pageIcons } from '../../lib/icons';
import { TextSizeRow } from '../../elements/TextSizeRow';
import { calendarColor } from './useCalendarEvents';
import { DEFAULT_FONT_SCALE } from '../../lib/fontSizePresets';
import type { GridElement } from '../../grid/types';
import type { CalendarOptions } from './WeekCalendar';
import opt from '../../components/options.module.css';
import styles from './main.module.css';

/**
 * Per-instance settings for a calendar element (gear badge / tap in page
 * edit mode). Live-edit: every change persists immediately, Close exits.
 */
export default function CalendarOptionsEditor({
  pageId,
  element,
  onClose,
}: {
  pageId: string;
  element: GridElement;
  onClose: () => void;
}) {
  const o = (element.options ?? {}) as CalendarOptions;
  const calendarEntities = useEntitiesByDomain('calendar').value;
  const mode = o.mode === 'agenda' ? 'agenda' : 'week';
  const fontScale = typeof o.fontScale === 'number' ? o.fontScale : DEFAULT_FONT_SCALE;

  const set = (patch: Partial<CalendarOptions>) => updateElementOptions(pageId, element.id, patch);

  const calMode: 'global' | 'all' | 'custom' =
    o.calendars === undefined ? 'global' : o.calendars === null ? 'all' : 'custom';

  const startCustom = () => {
    // prefill with what this instance currently shows
    const effective = o.calendars !== undefined ? o.calendars : settings.peek().calendars.selected;
    set({
      calendars: effective === null ? calendarEntities.map((e) => e.entity_id) : effective,
    });
  };

  const toggleCalendar = (id: string) => {
    const cur = Array.isArray(o.calendars) ? o.calendars : [];
    set({
      calendars: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    });
  };

  const num = (v: string, lo: number, hi: number, fallback: number): number => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback;
  };

  return (
    <OptionsDialog
      title="Calendar settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={460}
    >
      <Section title="Calendars">
        <Field label="Show">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${calMode === 'global' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ calendars: undefined })}
              title="This display's default calendar selection (all, unless configured before)"
            >
              Default
            </button>
            <button
              class={`${opt.segBtn}${calMode === 'all' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ calendars: null })}
            >
              All
            </button>
            <button
              class={`${opt.segBtn}${calMode === 'custom' ? ` ${opt.segActive}` : ''}`}
              onClick={startCustom}
            >
              Choose…
            </button>
          </div>
        </Field>
        {calMode === 'custom' && (
          <ul class={opt.checklist}>
            {calendarEntities.length === 0 && <li class={opt.dim}>No calendar entities found.</li>}
            {calendarEntities.map((e) => (
              <li key={e.entity_id}>
                <label class={opt.checkItem}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(o.calendars) && o.calendars.includes(e.entity_id)}
                    onChange={() => toggleCalendar(e.entity_id)}
                  />
                  <span
                    class={styles.eventDot}
                    style={{ background: calendarColor(e.entity_id) }}
                  />
                  {friendlyName(e)}
                </label>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Layout">
        <Field label="Show">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${mode === 'week' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ mode: 'week' })}
            >
              Day board
            </button>
            <button
              class={`${opt.segBtn}${mode === 'agenda' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ mode: 'agenda' })}
            >
              Next entries
            </button>
          </div>
        </Field>

        {mode === 'week' && (
          <>
            <Field label="Days">
              <input
                class={opt.num}
                type="number"
                min={1}
                max={14}
                value={o.days ?? 7}
                aria-label="Days"
                onChange={(e) => set({ days: num((e.target as HTMLInputElement).value, 1, 14, 7) })}
              />
            </Field>
            <Field label="Direction">
              <div class={opt.seg}>
                <button
                  class={`${opt.segBtn}${!o.vertical ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ vertical: false })}
                >
                  Columns
                </button>
                <button
                  class={`${opt.segBtn}${o.vertical ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ vertical: true })}
                >
                  Stacked
                </button>
              </div>
            </Field>
          </>
        )}

        {mode === 'agenda' && (
          <>
            <Field label="Entries">
              <input
                class={opt.num}
                type="number"
                min={1}
                max={20}
                value={o.count ?? 5}
                aria-label="Entries"
                onChange={(e) => set({ count: num((e.target as HTMLInputElement).value, 1, 20, 5) })}
              />
            </Field>
            <Field label="Card background">
              <div class={opt.seg}>
                <button
                  class={`${opt.segBtn}${!o.agendaCard ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ agendaCard: false })}
                >
                  None
                </button>
                <button
                  class={`${opt.segBtn}${o.agendaCard ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ agendaCard: true })}
                >
                  Surface
                </button>
              </div>
            </Field>
            <Field label="Entry spacing">
              <div class={opt.seg}>
                <button
                  class={`${opt.segBtn}${!o.agendaFill ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ agendaFill: false })}
                >
                  Compact
                </button>
                <button
                  class={`${opt.segBtn}${o.agendaFill ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ agendaFill: true })}
                >
                  Fill height
                </button>
              </div>
            </Field>
            <p class={opt.dim}>
              “Fill height” spreads entries over the whole card, which can look gappy on a tall
              widget with few entries.
            </p>
          </>
        )}
      </Section>

      <Section title="Display">
        <WideField label="Card title">
          <input
            type="text"
            value={o.title ?? ''}
            placeholder={mode === 'agenda' ? 'Upcoming' : 'This week'}
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </WideField>
        <Field label="“Updated Xm ago” hint">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${o.showUpdated !== false ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showUpdated: undefined })}
            >
              Show
            </button>
            <button
              class={`${opt.segBtn}${o.showUpdated === false ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ showUpdated: false })}
            >
              Hide
            </button>
          </div>
        </Field>
        <Field label="Calendar colour marker">
          <div class={opt.seg}>
            {(
              [
                ['hide', 'Hide'],
                ['dot', 'Dots'],
                ['bar', 'Bar'],
              ] as const
            ).map(([val, label]) => {
              const cur = o.marker ?? (o.showDots === false ? 'hide' : 'dot');
              return (
                <button
                  key={val}
                  class={`${opt.segBtn}${cur === val ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ marker: val, showDots: undefined })}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <div class={opt.fieldWide}>
          Icon
          <div class={opt.iconRow}>
            <button
              class={`${opt.iconBtn}${!o.icon ? ` ${opt.iconBtnActive}` : ''}`}
              onClick={() => set({ icon: undefined })}
            >
              None
            </button>
            {Object.entries(pageIcons).map(([name, path]) => (
              <button
                key={name}
                class={`${opt.iconBtn}${o.icon === name ? ` ${opt.iconBtnActive}` : ''}`}
                onClick={() => set({ icon: name })}
                aria-label={`Icon: ${name}`}
              >
                <svg viewBox="0 0 24 24">
                  <path d={path} fill="currentColor" />
                </svg>
              </button>
            ))}
          </div>
        </div>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>
    </OptionsDialog>
  );
}
