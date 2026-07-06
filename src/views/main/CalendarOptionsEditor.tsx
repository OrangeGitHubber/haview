import { Modal } from '../../components/Modal';
import { settings, updateElementOptions } from '../../lib/settings';
import { useEntitiesByDomain } from '../../lib/ha/entities';
import { friendlyName } from '../settings/EntitySelect';
import { calendarColor } from './useCalendarEvents';
import type { GridElement } from '../../grid/types';
import type { CalendarOptions } from './WeekCalendar';
import styles from './main.module.css';

/**
 * Per-instance settings for a calendar element (gear badge in page edit
 * mode). Live-edit: every change persists immediately, Close just exits.
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

  const set = (patch: Partial<CalendarOptions>) =>
    updateElementOptions(pageId, element.id, patch);

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
    <Modal onClose={onClose} maxWidth={420}>
      <header class={styles.optHeader}>
        <span>Calendar settings</span>
        <button class={styles.optClose} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={styles.optForm}>
        <label class={styles.optRow}>
          Title
          <input
            type="text"
            value={o.title ?? ''}
            placeholder={mode === 'agenda' ? 'Upcoming' : 'This week'}
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </label>

        <div class={styles.optRow}>
          Show
          <div class={styles.optSeg}>
            <button
              class={`${styles.segBtn}${mode === 'week' ? ` ${styles.segActive}` : ''}`}
              onClick={() => set({ mode: 'week' })}
            >
              Day board
            </button>
            <button
              class={`${styles.segBtn}${mode === 'agenda' ? ` ${styles.segActive}` : ''}`}
              onClick={() => set({ mode: 'agenda' })}
            >
              Next entries
            </button>
          </div>
        </div>

        {mode === 'week' && (
          <>
            <label class={styles.optRow}>
              Days
              <input
                class={styles.optNum}
                type="number"
                min={1}
                max={14}
                value={o.days ?? 7}
                onChange={(e) =>
                  set({ days: num((e.target as HTMLInputElement).value, 1, 14, 7) })
                }
              />
            </label>
            <div class={styles.optRow}>
              Layout
              <div class={styles.optSeg}>
                <button
                  class={`${styles.segBtn}${!o.vertical ? ` ${styles.segActive}` : ''}`}
                  onClick={() => set({ vertical: false })}
                >
                  Columns
                </button>
                <button
                  class={`${styles.segBtn}${o.vertical ? ` ${styles.segActive}` : ''}`}
                  onClick={() => set({ vertical: true })}
                >
                  Stacked
                </button>
              </div>
            </div>
          </>
        )}

        {mode === 'agenda' && (
          <label class={styles.optRow}>
            Entries
            <input
              class={styles.optNum}
              type="number"
              min={1}
              max={20}
              value={o.count ?? 5}
              onChange={(e) =>
                set({ count: num((e.target as HTMLInputElement).value, 1, 20, 5) })
              }
            />
          </label>
        )}

        <div class={styles.optRow}>
          Calendars
          <div class={styles.optSeg}>
            <button
              class={`${styles.segBtn}${calMode === 'global' ? ` ${styles.segActive}` : ''}`}
              onClick={() => set({ calendars: undefined })}
              title="Follow the selection in Settings → Calendars"
            >
              Global
            </button>
            <button
              class={`${styles.segBtn}${calMode === 'all' ? ` ${styles.segActive}` : ''}`}
              onClick={() => set({ calendars: null })}
            >
              All
            </button>
            <button
              class={`${styles.segBtn}${calMode === 'custom' ? ` ${styles.segActive}` : ''}`}
              onClick={startCustom}
            >
              Choose…
            </button>
          </div>
        </div>

        {calMode === 'custom' && (
          <ul class={styles.calChecklist}>
            {calendarEntities.length === 0 && (
              <li class={styles.optDim}>No calendar entities found.</li>
            )}
            {calendarEntities.map((e) => (
              <li key={e.entity_id}>
                <label class={styles.calCheckItem}>
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
      </div>
    </Modal>
  );
}
