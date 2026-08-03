import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { settings, updateSettings } from '../../lib/settings';
import { themes } from '../../lib/themes';
import { serverConfig, setupRequested } from '../../lib/config';
import { PagesEditor } from './PagesEditor';
import { ProfilesEditor } from './ProfilesEditor';
import { ExportImport } from './ExportImport';
import styles from './settings.module.css';

type CatId = 'appearance' | 'general' | 'night' | 'pages' | 'profiles' | 'connection' | 'backup';

// left-nav category icons (24×24 Material path data)
const ICON: Record<CatId, string> = {
  appearance:
    'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  general:
    'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  night:
    'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
  pages: 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z',
  profiles:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  connection:
    'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  backup:
    'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.99 5.99 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z',
};

const CATEGORIES: { id: CatId; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'general', label: 'General' },
  { id: 'night', label: 'Night & screensaver' },
  { id: 'pages', label: 'Pages' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'connection', label: 'Connection' },
  { id: 'backup', label: 'Backup' },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class={`${styles.sw}${checked ? ` ${styles.swOn}` : ''}`}
      onClick={() => onChange(!checked)}
    />
  );
}

/** one setting: label (+ optional hint) on the left, its control on the right */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ComponentChildren;
}) {
  return (
    <div class={styles.row}>
      <div class={styles.rowLabel}>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div class={styles.rowControl}>{children}</div>
    </div>
  );
}

export default function SettingsView() {
  const [cat, setCat] = useState<CatId>('appearance');
  const s = settings.value;
  const cfg = serverConfig.value;

  // night dimming and the screensaver are mutually exclusive (a screensaver
  // fully covers the dashboard, so a dim layer under it would do nothing)
  const nightMode: 'off' | 'dim' | 'saver' = s.screensaver ? 'saver' : s.nightDim ? 'dim' : 'off';
  const setNightMode = (m: 'off' | 'dim' | 'saver') =>
    updateSettings({ nightDim: m === 'dim', screensaver: m === 'saver' });

  const current = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];

  return (
    <div class={styles.shell}>
      <nav class={styles.nav} aria-label="Settings sections">
        <div class={styles.navTitle}>Settings</div>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            class={`${styles.navItem}${c.id === cat ? ` ${styles.navActive}` : ''}`}
            onClick={() => setCat(c.id)}
            aria-current={c.id === cat ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICON[c.id]} fill="currentColor" />
            </svg>
            {c.label}
          </button>
        ))}
      </nav>

      <div class={styles.panel}>
        <h1 class={`view-title ${styles.panelTitle}`}>{current.label}</h1>

        {cat === 'appearance' && (
          <div class={styles.rows}>
            <Row label="Mode">
              <div class={styles.modeRow}>
                {(['auto', 'dark', 'light'] as const).map((m) => (
                  <button
                    key={m}
                    class={`${styles.modeBtn}${s.colorMode === m ? ` ${styles.modeActive}` : ''}`}
                    onClick={() => updateSettings({ colorMode: m })}
                  >
                    {m === 'auto' ? 'Auto' : m === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Accent color">
              <div class={styles.swatchRow}>
                {themes.map((t) => {
                  const active = !s.accentColor && s.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      class={`${styles.swatchChip}${active ? ` ${styles.swatchActive}` : ''}`}
                      style={{ background: t.swatch }}
                      onClick={() => updateSettings({ theme: t.id, accentColor: '' })}
                      aria-label={`Accent: ${t.name}`}
                      aria-pressed={active}
                      title={t.name}
                    />
                  );
                })}
                <label
                  class={`${styles.swatchChip} ${styles.swatchCustom}${
                    s.accentColor ? ` ${styles.swatchActive}` : ''
                  }`}
                  style={s.accentColor ? { background: s.accentColor } : undefined}
                  title="Custom color"
                >
                  {!s.accentColor && (
                    <span class={styles.swatchPlus} aria-hidden="true">
                      +
                    </span>
                  )}
                  <input
                    type="color"
                    value={s.accentColor || '#f28c28'}
                    onInput={(e) =>
                      updateSettings({ accentColor: (e.target as HTMLInputElement).value })
                    }
                    aria-label="Custom accent color"
                  />
                </label>
              </div>
            </Row>
            <Row label="Card titles" hint="Each card can override this">
              <Toggle
                label="Show card titles"
                checked={s.showTitles}
                onChange={(v) => updateSettings({ showTitles: v })}
              />
            </Row>
            <Row label="Title color">
              <div class={styles.inline}>
                <input
                  type="color"
                  class={styles.colorInput}
                  value={s.titleColor || '#f28c28'}
                  onChange={(e) => updateSettings({ titleColor: (e.target as HTMLInputElement).value })}
                  aria-label="Title color"
                />
                <button
                  class={`${styles.modeBtn}${!s.titleColor ? ` ${styles.modeActive}` : ''}`}
                  onClick={() => updateSettings({ titleColor: '' })}
                >
                  Accent
                </button>
              </div>
            </Row>
            <Row label="Card opacity" hint={`${s.cardOpacity}%`}>
              <input
                type="range"
                class={styles.slider}
                min={0}
                max={100}
                value={s.cardOpacity}
                onInput={(e) =>
                  updateSettings({ cardOpacity: Number((e.target as HTMLInputElement).value) })
                }
              />
            </Row>
            <Row label="Card style" hint="Glass frosts cards over the background (uses the GPU)">
              <div class={styles.modeRow}>
                {(
                  [
                    ['solid', 'Solid'],
                    ['glass', 'Glass'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    class={`${styles.modeBtn}${s.cardStyle === v ? ` ${styles.modeActive}` : ''}`}
                    onClick={() => updateSettings({ cardStyle: v })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Row>
            {s.cardStyle === 'glass' && (
              <Row
                label="Glass frost"
                hint={`${s.glassBlur}% · clear glass → milky frost (ease off on a Raspberry Pi)`}
              >
                <input
                  type="range"
                  class={styles.slider}
                  min={0}
                  max={100}
                  step={5}
                  value={s.glassBlur}
                  onInput={(e) =>
                    updateSettings({ glassBlur: Number((e.target as HTMLInputElement).value) })
                  }
                />
              </Row>
            )}
            <Row label="Display scale" hint={`${s.uiScale}% · text size on this screen`}>
              <input
                type="range"
                class={styles.slider}
                min={70}
                max={200}
                step={5}
                value={s.uiScale}
                onInput={(e) =>
                  updateSettings({ uiScale: Number((e.target as HTMLInputElement).value) })
                }
              />
            </Row>
          </div>
        )}

        {cat === 'general' && (
          <div class={styles.rows}>
            <label class={styles.stackField}>
              Dashboard title
              <input
                type="text"
                value={s.title}
                onInput={(e) => updateSettings({ title: (e.target as HTMLInputElement).value })}
              />
            </label>
            <label class={styles.stackField}>
              Subtitle
              <input
                type="text"
                value={s.subtitle}
                onInput={(e) => updateSettings({ subtitle: (e.target as HTMLInputElement).value })}
              />
            </label>
            <Row label="Refresh button" hint="Lower-left corner of the dashboard">
              <Toggle
                label="Show refresh button"
                checked={s.showRefresh}
                onChange={(v) => updateSettings({ showRefresh: v })}
              />
            </Row>
            <Row label="Update banner" hint="Prompt to refresh when a new version deploys">
              <Toggle
                label="Show update banner"
                checked={s.checkUpdates}
                onChange={(v) => updateSettings({ checkUpdates: v })}
              />
            </Row>
          </div>
        )}

        {cat === 'night' && (
          <div class={styles.rows}>
            <Row label="When idle at night">
              <div class={styles.modeRow}>
                {(
                  [
                    ['off', 'Off'],
                    ['dim', 'Dim'],
                    ['saver', 'Screensaver'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    class={`${styles.modeBtn}${nightMode === m ? ` ${styles.modeActive}` : ''}`}
                    onClick={() => setNightMode(m)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Row>
            <p class={styles.dim}>
              <strong>Dim</strong> darkens the dashboard but keeps it visible; the{' '}
              <strong>screensaver</strong> fully covers it with a slow moving pattern to protect an
              always-on screen from burn-in. One or the other — not both.
            </p>
            {nightMode !== 'off' && (
              <>
                <div class={styles.fieldRow}>
                  <label class={styles.stackField}>
                    From
                    <input
                      type="time"
                      value={s.nightDimStart}
                      onChange={(e) =>
                        updateSettings({ nightDimStart: (e.target as HTMLInputElement).value })
                      }
                    />
                  </label>
                  <label class={styles.stackField}>
                    Until
                    <input
                      type="time"
                      value={s.nightDimEnd}
                      onChange={(e) =>
                        updateSettings({ nightDimEnd: (e.target as HTMLInputElement).value })
                      }
                    />
                  </label>
                  <label class={styles.stackField}>
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
                {nightMode === 'dim' && (
                  <div class={styles.fieldRow}>
                    <label class={styles.stackField}>
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
                {nightMode === 'saver' && (
                  <>
                    <div class={styles.fieldRow}>
                      <label class={styles.stackField}>
                        Brightness %
                        <input
                          type="number"
                          min={5}
                          max={80}
                          value={s.screensaverBrightness}
                          onChange={(e) => {
                            const n = Math.round(Number((e.target as HTMLInputElement).value));
                            updateSettings({
                              screensaverBrightness: Number.isFinite(n)
                                ? Math.min(Math.max(n, 5), 80)
                                : 35,
                            });
                          }}
                        />
                      </label>
                      <label class={styles.stackField}>
                        Speed (1–10)
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={s.screensaverSpeed}
                          onChange={(e) => {
                            const n = Math.round(Number((e.target as HTMLInputElement).value));
                            updateSettings({
                              screensaverSpeed: Number.isFinite(n) ? Math.min(Math.max(n, 1), 10) : 3,
                            });
                          }}
                        />
                      </label>
                    </div>
                    <Row label="Intensity" hint="Use Low on a Raspberry Pi / weak GPU">
                      <div class={styles.modeRow}>
                        {(
                          [
                            ['low', 'Low'],
                            ['medium', 'Medium'],
                            ['high', 'High'],
                          ] as const
                        ).map(([v, label]) => (
                          <button
                            key={v}
                            class={`${styles.modeBtn}${
                              s.screensaverIntensity === v ? ` ${styles.modeActive}` : ''
                            }`}
                            onClick={() => updateSettings({ screensaverIntensity: v })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </Row>
                  </>
                )}
                <p class={styles.dim}>
                  Runs during the window above and clears on any touch, mouse or keyboard activity,
                  returning after the inactivity timeout.
                </p>
              </>
            )}
            <Row label="Debug overlay" hint="Log input events (troubleshooting)">
              <Toggle
                label="Show input-activity debug overlay"
                checked={s.idleDebug}
                onChange={(v) => updateSettings({ idleDebug: v })}
              />
            </Row>
            {s.idleDebug && (
              <p class={styles.dim}>
                Shows a small on-screen log of the input events that lift night dimming. If the
                display won't stay dimmed, leave this on and note which event appears the instant the
                dim clears. Turn it off when done.
              </p>
            )}
          </div>
        )}

        {cat === 'pages' && (
          <div class={styles.rows}>
            <p class={styles.dim}>
              Add and arrange the pages in the navigation. Edit a page's layout with the ✎ button on
              the page itself.
            </p>
            <PagesEditor />
          </div>
        )}

        {cat === 'profiles' && (
          <div class={styles.rows}>
            <ProfilesEditor />
          </div>
        )}

        {cat === 'connection' && (
          <div class={styles.rows}>
            <p class={styles.dim}>
              Connected to <code>{cfg?.hassUrl ?? 'not configured'}</code>
            </p>
            <button
              class={styles.primaryBtn}
              style={{ justifySelf: 'start' }}
              onClick={() => (setupRequested.value = true)}
            >
              Change connection…
            </button>
          </div>
        )}

        {cat === 'backup' && (
          <div class={styles.rows}>
            <ExportImport />
          </div>
        )}
      </div>
    </div>
  );
}
