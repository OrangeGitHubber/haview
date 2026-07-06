import { settings, updateSettings, setSelectedCalendars, setTheme } from '../../lib/settings';
import { themes } from '../../lib/themes';
import { loadConfig, setupRequested } from '../../lib/config';
import { useEntitiesByDomain } from '../../lib/ha/entities';
import { EntitySelect, EntityMultiSelect } from './EntitySelect';
import { PagesEditor } from './PagesEditor';
import { ExportImport } from './ExportImport';
import styles from './settings.module.css';

export default function SettingsView() {
  const s = settings.value;
  const weatherEntities = useEntitiesByDomain('weather').value;
  const persons = useEntitiesByDomain('person').value;
  const calendars = useEntitiesByDomain('calendar').value;
  const cfg = loadConfig();

  return (
    <div class={styles.page}>
      <h1 class="view-title">Settings</h1>

      <section class={styles.section}>
        <h2>General</h2>
        <label class={styles.field}>
          Dashboard title
          <input
            type="text"
            value={s.title}
            onInput={(e) => updateSettings({ title: (e.target as HTMLInputElement).value })}
          />
        </label>
        <label class={styles.field}>
          Subtitle
          <input
            type="text"
            value={s.subtitle}
            onInput={(e) => updateSettings({ subtitle: (e.target as HTMLInputElement).value })}
          />
        </label>
      </section>

      <section class={styles.section}>
        <h2>Pages</h2>
        <p class={styles.dim}>
          Add and arrange the pages in the navigation. Edit a page's layout with the ✎ button on
          the page itself.
        </p>
        <PagesEditor />
      </section>

      <section class={styles.section}>
        <h2>Weather</h2>
        <p class={styles.dim}>Which weather entity powers the Weather widget.</p>
        <EntitySelect
          entities={weatherEntities}
          value={s.weather.entityId}
          onChange={(id) => updateSettings({ weather: { entityId: id } })}
          noneLabel="None selected"
        />
      </section>

      <section class={styles.section}>
        <h2>People</h2>
        <p class={styles.dim}>Who appears in the Family presence widget.</p>
        <EntityMultiSelect
          entities={persons}
          selected={s.presence.personIds}
          onChange={(ids) => updateSettings({ presence: { personIds: ids } })}
        />
      </section>

      <section class={styles.section}>
        <h2>Calendars</h2>
        <p class={styles.dim}>Which calendars feed the week board on this display.</p>
        <EntityMultiSelect
          entities={calendars}
          selected={s.calendars.selected}
          onChange={setSelectedCalendars}
        />
      </section>

      <section class={styles.section}>
        <h2>Theme</h2>
        <p class={styles.dim}>Accent color for this display.</p>
        <div class={styles.themeRow}>
          {themes.map((t) => (
            <button
              key={t.id}
              class={`${styles.themeSwatch}${s.theme === t.id ? ` ${styles.themeActive}` : ''}`}
              onClick={() => setTheme(t.id)}
              aria-label={`Theme: ${t.name}`}
              aria-pressed={s.theme === t.id}
            >
              <span class={styles.themeDot} style={{ background: t.swatch }} />
              {t.name}
            </button>
          ))}
        </div>
        <label class={styles.checkItem}>
          <input
            type="checkbox"
            checked={s.nightDim}
            onChange={(e) => updateSettings({ nightDim: (e.target as HTMLInputElement).checked })}
          />
          Dim the display at night
        </label>
        {s.nightDim && (
          <div class={styles.fieldRow}>
            <label class={styles.field}>
              From
              <input
                type="time"
                value={s.nightDimStart}
                onChange={(e) =>
                  updateSettings({ nightDimStart: (e.target as HTMLInputElement).value })
                }
              />
            </label>
            <label class={styles.field}>
              Until
              <input
                type="time"
                value={s.nightDimEnd}
                onChange={(e) =>
                  updateSettings({ nightDimEnd: (e.target as HTMLInputElement).value })
                }
              />
            </label>
            <label class={styles.field}>
              Dim %
              <input
                type="number"
                min={10}
                max={90}
                value={s.nightDimAmount}
                onChange={(e) => {
                  const n = Math.round(Number((e.target as HTMLInputElement).value));
                  updateSettings({
                    nightDimAmount: Number.isFinite(n) ? Math.min(Math.max(n, 10), 90) : 40,
                  });
                }}
              />
            </label>
          </div>
        )}
      </section>

      <section class={styles.section}>
        <h2>Export / Import</h2>
        <ExportImport />
      </section>

      <section class={styles.section}>
        <h2>Connection</h2>
        <p class={styles.dim}>
          Connected to <code>{cfg?.hassUrl ?? 'not configured'}</code>
        </p>
        <button class={styles.primaryBtn} onClick={() => (setupRequested.value = true)}>
          Change connection…
        </button>
      </section>
    </div>
  );
}
