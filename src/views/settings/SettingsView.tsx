import { settings, updateSettings, setTheme } from '../../lib/settings';
import { themes } from '../../lib/themes';
import { serverConfig, setupRequested } from '../../lib/config';
import { PagesEditor } from './PagesEditor';
import { ExportImport } from './ExportImport';
import styles from './settings.module.css';

export default function SettingsView() {
  const s = settings.value;
  const cfg = serverConfig.value;

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
        <h2>Theme</h2>
        <p class={styles.dim}>Appearance</p>
        <div class={styles.modeRow}>
          {(['auto', 'dark', 'light'] as const).map((m) => (
            <button
              key={m}
              class={`${styles.modeBtn}${s.colorMode === m ? ` ${styles.modeActive}` : ''}`}
              onClick={() => updateSettings({ colorMode: m })}
            >
              {m === 'auto' ? 'Auto (device)' : m === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
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
            checked={s.showTitles}
            onChange={(e) =>
              updateSettings({ showTitles: (e.target as HTMLInputElement).checked })
            }
          />
          Show card titles (each card can override this)
        </label>
        <div class={styles.field}>
          Title color
          <div class={styles.modeRow}>
            <input
              type="color"
              value={s.titleColor || '#f28c28'}
              onChange={(e) =>
                updateSettings({ titleColor: (e.target as HTMLInputElement).value })
              }
              aria-label="Title color"
            />
            <button
              class={`${styles.modeBtn}${!s.titleColor ? ` ${styles.modeActive}` : ''}`}
              onClick={() => updateSettings({ titleColor: '' })}
            >
              Theme accent
            </button>
          </div>
        </div>
        <label class={styles.field}>
          Card opacity · {s.cardOpacity}%
          <input
            type="range"
            min={0}
            max={100}
            value={s.cardOpacity}
            onInput={(e) =>
              updateSettings({ cardOpacity: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
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
            <label class={styles.field}>
              Resume after (min)
              <input
                type="number"
                min={1}
                max={60}
                value={s.nightDimResume}
                onChange={(e) => {
                  const n = Math.round(Number((e.target as HTMLInputElement).value));
                  updateSettings({
                    nightDimResume: Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 2,
                  });
                }}
              />
            </label>
          </div>
        )}
        {s.nightDim && (
          <p class={styles.dim}>
            Any touch, mouse or keyboard activity lifts the dimming; it returns after the
            inactivity timeout.
          </p>
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
