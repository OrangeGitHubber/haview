import { signal } from '@preact/signals';
import { applyTheme, applyColorMode } from './themes';
import type { GridElement, GridRect } from '../grid/types';
import { GRID_COLS } from '../grid/types';
import { findFreeSlot } from '../grid/layout';
import {
  listProfiles,
  loadProfile,
  saveProfile,
  deleteProfile,
  currentProfileName,
  setCurrentProfileName,
} from './profiles';

/**
 * All dashboard configuration in one versioned, exportable object.
 * Stored per device (localStorage) so the Docker image stays generic;
 * Export/Import in Settings copies a setup between devices/households.
 * The HA URL + token are deliberately NOT part of this (see config.ts).
 */

export interface PageDef {
  /** hash route: #/<id>; never 'settings' (reserved) */
  id: string;
  title: string;
  /** icon NAME from src/lib/icons.ts */
  icon: string;
  kind: 'grid';
  /** per-page card-title default (element option > this > system setting) */
  showTitles?: boolean;
  /** scale rows to fill the viewport height (fit to any screen, no scroll) */
  fitHeight?: boolean;
  /** ignored for kind 'cameras' */
  elements: GridElement[];
  /** optional frosted background image URL ('/' paths resolve against the HA URL) */
  background?: string;
  /** frosted-glass strength 0–100 (blur amount); default 50 */
  backgroundGlass?: number;
  /** true = reachable by id (e.g. a Popup element's target) but not listed in
      the nav sidebar — used for "room" pages meant to be opened from a
      floor page's popup tile rather than navigated to directly */
  hidden?: boolean;
}

export interface AppSettings {
  version: 3;
  title: string;
  subtitle: string;
  pages: PageDef[];
  /** Theme id from src/lib/themes.ts; unknown ids fall back to orange visually. */
  theme: string;
  /** custom accent color (any CSS hex) overriding the theme preset's accent;
      '' = use the selected theme */
  accentColor: string;
  /** light/dark handling: follow the OS or force one */
  colorMode: 'auto' | 'dark' | 'light';
  /** card/container background opacity in percent (30–100) */
  cardOpacity: number;
  /** card surface style: 'solid' flat panels, or 'glass' frosted translucent
      cards that blur the background. backdrop-blur is GPU work, so it defaults
      to 'solid' and is opt-in (fine on the wall TV, heavy on a Raspberry Pi) */
  cardStyle: 'solid' | 'glass';
  /** glass frost strength 0–100 (backdrop-blur amount); only used for 'glass' */
  glassBlur: number;
  /** default for card titles (per-card option overrides) */
  showTitles: boolean;
  /** CSS color overriding the theme accent for card titles; '' = theme */
  titleColor: string;
  /** width of the left navigation sidebar in px (wide screens) */
  navWidth: number;
  /** manual text/UI scale multiplier in percent (70–200); 100 = auto default */
  uiScale: number;
  /** show the lower-left refresh button */
  showRefresh: boolean;
  /** poll for new deploys and show a "please refresh" banner */
  checkUpdates: boolean;
  /** dim the display during the configured window */
  nightDim: boolean;
  /** window start/end, 'HH:MM' (may wrap past midnight) */
  nightDimStart: string;
  nightDimEnd: string;
  /** dim strength in percent (10–90) */
  nightDimAmount: number;
  /** minutes of inactivity before dimming resumes after user activity */
  nightDimResume: number;
  /** full-screen swirling screensaver during the night window (burn-in
      protection for always-on wall displays); shares the night window +
      idle trigger with nightDim but toggles independently */
  screensaver: boolean;
  /** screensaver brightness in percent (5–80): how visible the swirl is */
  screensaverBrightness: number;
  /** screensaver motion speed (1–10; higher = faster) */
  screensaverSpeed: number;
  /** screensaver visual richness vs. GPU cost. 'low' = one lightly-blurred
      layer (smooth on a Raspberry Pi / weak GPU); 'high' = extra blurred,
      blended orbiting layers (needs a capable GPU). */
  screensaverIntensity: 'low' | 'medium' | 'high';
  /** troubleshooting: overlay the last input events (type/coords/delta) so a
      display that won't stay dimmed can be diagnosed without devtools */
  idleDebug: boolean;
  weather: { entityId: string | null };
  presence: { personIds: string[] | null };
  calendars: { selected: string[] | null };
}

// v3 doubled the grid resolution (12→24 cols, 56→28px rows); older keys are
// kept so a rollback to a previous image still finds its config.
const KEY = 'haview.settings.v3';
// older/renamed cache keys, read once for migration then rewritten under KEY
const OLD_V3_KEY = 'oranjehuis.settings.v3';
const V2_KEY = 'oranjehuis.settings.v2';
const V1_KEY = 'oranjehuis.settings.v1';
const LEGACY_CALENDARS_KEY = 'oranjehuis.selectedCalendars.v1';

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** v1-widget sizes in the OLD 12-col grid; the v2→v3 pass doubles them. */
const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
  calendar: { w: 12, h: 4 },
  weather: { w: 6, h: 3 },
  presence: { w: 6, h: 3 },
};

/** Default Main elements in OLD 12-col units (doubled by migration). */
function legacyMainElements(): GridElement[] {
  return [
    { id: 'calendar', type: 'calendar', x: 0, y: 0, w: 12, h: 4 },
    { id: 'weather', type: 'weather', x: 0, y: 4, w: 6, h: 3 },
    { id: 'presence', type: 'presence', x: 6, y: 4, w: 6, h: 3 },
  ];
}

/** Default Main page in the NEW 24-col grid (fresh installs). */
function defaultMainPage(): PageDef {
  return {
    id: 'main',
    title: 'Main',
    icon: 'home',
    kind: 'grid',
    elements: [
      { id: 'calendar', type: 'calendar', x: 0, y: 0, w: 24, h: 8 },
      { id: 'weather', type: 'weather', x: 0, y: 8, w: 12, h: 6 },
      { id: 'presence', type: 'presence', x: 12, y: 8, w: 12, h: 6 },
    ],
  };
}

function defaults(): AppSettings {
  return {
    version: 3,
    title: 'My Home',
    subtitle: 'Smart Dashboard',
    pages: [defaultMainPage()],
    theme: 'orange',
    accentColor: '',
    colorMode: 'auto',
    cardOpacity: 100,
    cardStyle: 'solid',
    glassBlur: 60,
    showTitles: true,
    titleColor: '',
    navWidth: 92,
    uiScale: 100,
    showRefresh: true,
    checkUpdates: true,
    nightDim: false,
    nightDimStart: '22:00',
    nightDimEnd: '07:00',
    nightDimAmount: 40,
    nightDimResume: 2,
    screensaver: false,
    screensaverBrightness: 35,
    screensaverSpeed: 3,
    screensaverIntensity: 'medium',
    idleDebug: false,
    weather: { entityId: null },
    presence: { personIds: null },
    calendars: { selected: null },
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isTimeString(v: unknown): v is string {
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);
}

function toInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

function normalizeElements(raw: unknown): GridElement[] {
  const out: GridElement[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const el = e as Record<string, unknown>;
    if (typeof el.type !== 'string') continue;
    const x = toInt(el.x);
    const y = toInt(el.y);
    const w = toInt(el.w);
    const h = toInt(el.h);
    if (x === null || y === null || w === null || h === null) continue;
    let id = typeof el.id === 'string' && el.id ? el.id : newId('e');
    while (seen.has(id)) id = newId('e');
    seen.add(id);
    const cw = Math.min(Math.max(w, 1), GRID_COLS);
    out.push({
      id,
      // unknown types are kept — forward compatibility with newer builds
      type: el.type,
      x: Math.min(Math.max(x, 0), GRID_COLS - cw),
      y: Math.max(y, 0),
      w: cw,
      h: Math.max(h, 1),
      ...(el.options && typeof el.options === 'object'
        ? { options: el.options as Record<string, unknown> }
        : {}),
    });
  }
  return out;
}

function normalizePages(raw: unknown): PageDef[] {
  const out: PageDef[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const p of raw) {
      if (!p || typeof p !== 'object') continue;
      const pg = p as Record<string, unknown>;
      // the built-in Cameras page was removed — drop any lingering ones
      if (pg.kind === 'cameras') continue;
      let id = typeof pg.id === 'string' && pg.id && pg.id !== 'settings' ? pg.id : newId('p');
      while (seen.has(id)) id = newId('p');
      seen.add(id);
      out.push({
        id,
        title: typeof pg.title === 'string' && pg.title.trim() ? pg.title : 'Page',
        icon: typeof pg.icon === 'string' && pg.icon ? pg.icon : 'home',
        kind: 'grid',
        elements: normalizeElements(pg.elements),
        ...(typeof pg.background === 'string' && pg.background
          ? { background: pg.background }
          : {}),
        ...(typeof pg.backgroundGlass === 'number' && Number.isFinite(pg.backgroundGlass)
          ? { backgroundGlass: Math.min(Math.max(Math.round(pg.backgroundGlass), 0), 100) }
          : {}),
        ...(typeof pg.showTitles === 'boolean' ? { showTitles: pg.showTitles } : {}),
        ...(typeof pg.fitHeight === 'boolean' ? { fitHeight: pg.fitHeight } : {}),
        ...(typeof pg.hidden === 'boolean' ? { hidden: pg.hidden } : {}),
      });
    }
  }
  // note: empty-case default injection happens in normalize(), after the
  // optional v2→v3 coordinate doubling, so 24-col defaults aren't doubled
  return out;
}

/** v2→v3: double every element's grid coordinates (12→24 cols, 56→28 rows). */
function doubleElements(p: PageDef): PageDef {
  return {
    ...p,
    elements: p.elements.map((e) => {
      const w = Math.min(e.w * 2, GRID_COLS);
      return {
        ...e,
        w,
        h: e.h * 2,
        x: Math.min(Math.max(e.x * 2, 0), GRID_COLS - w),
        y: Math.max(e.y * 2, 0),
      };
    }),
  };
}

/** Converts a v1 settings object (widgets list) into the v2 pages shape. */
function migrateV1(r: Record<string, unknown>): Record<string, unknown> {
  const elements: GridElement[] = [];
  const rawWidgets = Array.isArray(r.widgets) ? r.widgets : [];
  for (const w of rawWidgets) {
    if (!w || typeof w !== 'object') continue;
    const wi = w as Record<string, unknown>;
    const size = typeof wi.type === 'string' ? WIDGET_SIZES[wi.type] : undefined;
    // unknown v1 widget types were never renderable — drop them
    if (!size || !wi.enabled) continue;
    const slot = findFreeSlot(elements, size.w, size.h);
    elements.push({
      id: typeof wi.id === 'string' ? wi.id : newId('e'),
      type: wi.type as string,
      ...slot,
      ...size,
      ...(wi.options && typeof wi.options === 'object'
        ? { options: wi.options as Record<string, unknown> }
        : {}),
    });
  }
  // 12-col output; the v2→v3 pass in normalize() doubles it to 24-col
  const main: PageDef = {
    id: 'main',
    title: 'Main',
    icon: 'home',
    kind: 'grid',
    elements: elements.length > 0 ? elements : legacyMainElements(),
  };
  // drop the v1 'widgets' key so it doesn't linger in exports via ...rest
  const rest: Record<string, unknown> = { ...r };
  delete rest.widgets;
  return { ...rest, pages: [main] };
}

/** Coerces arbitrary (imported) JSON into a valid AppSettings, preserving unknown keys. */
function normalize(raw: unknown): AppSettings {
  let r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.version === 1 || !Array.isArray(r.pages)) r = migrateV1(r);
  const storedVersion = typeof r.version === 'number' ? r.version : 1;
  const base = defaults();
  // grid coordinates are in 12-col units up to v2; double them for v3
  let pages = normalizePages(r.pages);
  if (storedVersion < 3) pages = pages.map(doubleElements);
  if (pages.length === 0) pages = [defaultMainPage()];
  return {
    ...r, // preserve unknown top-level keys from newer versions
    version: 3,
    title: typeof r.title === 'string' && r.title.trim() ? r.title : base.title,
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : base.subtitle,
    pages,
    theme: typeof r.theme === 'string' && r.theme ? r.theme : base.theme,
    accentColor: typeof r.accentColor === 'string' ? r.accentColor : '',
    colorMode: r.colorMode === 'light' || r.colorMode === 'dark' ? r.colorMode : 'auto',
    cardOpacity:
      typeof r.cardOpacity === 'number' && Number.isFinite(r.cardOpacity)
        ? Math.min(Math.max(Math.round(r.cardOpacity), 0), 100)
        : base.cardOpacity,
    cardStyle: r.cardStyle === 'glass' ? 'glass' : 'solid',
    glassBlur:
      typeof r.glassBlur === 'number' && Number.isFinite(r.glassBlur)
        ? Math.min(Math.max(Math.round(r.glassBlur), 0), 100)
        : base.glassBlur,
    showTitles: r.showTitles !== false,
    titleColor: typeof r.titleColor === 'string' ? r.titleColor : '',
    navWidth:
      typeof r.navWidth === 'number' && Number.isFinite(r.navWidth)
        ? Math.min(Math.max(Math.round(r.navWidth), 60), 320)
        : base.navWidth,
    uiScale:
      typeof r.uiScale === 'number' && Number.isFinite(r.uiScale)
        ? Math.min(Math.max(Math.round(r.uiScale), 70), 200)
        : base.uiScale,
    showRefresh: r.showRefresh !== false,
    checkUpdates: r.checkUpdates !== false,
    nightDim: r.nightDim === true,
    nightDimStart: isTimeString(r.nightDimStart) ? r.nightDimStart : base.nightDimStart,
    nightDimEnd: isTimeString(r.nightDimEnd) ? r.nightDimEnd : base.nightDimEnd,
    nightDimAmount:
      typeof r.nightDimAmount === 'number' && Number.isFinite(r.nightDimAmount)
        ? Math.min(Math.max(Math.round(r.nightDimAmount), 10), 90)
        : base.nightDimAmount,
    nightDimResume:
      typeof r.nightDimResume === 'number' && Number.isFinite(r.nightDimResume)
        ? Math.min(Math.max(Math.round(r.nightDimResume), 1), 60)
        : base.nightDimResume,
    screensaver: r.screensaver === true,
    screensaverBrightness:
      typeof r.screensaverBrightness === 'number' && Number.isFinite(r.screensaverBrightness)
        ? Math.min(Math.max(Math.round(r.screensaverBrightness), 5), 80)
        : base.screensaverBrightness,
    screensaverSpeed:
      typeof r.screensaverSpeed === 'number' && Number.isFinite(r.screensaverSpeed)
        ? Math.min(Math.max(Math.round(r.screensaverSpeed), 1), 10)
        : base.screensaverSpeed,
    screensaverIntensity:
      r.screensaverIntensity === 'low' ||
      r.screensaverIntensity === 'medium' ||
      r.screensaverIntensity === 'high'
        ? r.screensaverIntensity
        : base.screensaverIntensity,
    idleDebug: r.idleDebug === true,
    weather: {
      entityId:
        r.weather && typeof (r.weather as { entityId?: unknown }).entityId === 'string'
          ? ((r.weather as { entityId: string }).entityId)
          : null,
    },
    presence: {
      personIds: isStringArray((r.presence as { personIds?: unknown } | undefined)?.personIds)
        ? ((r.presence as { personIds: string[] }).personIds)
        : null,
    },
    calendars: {
      selected: isStringArray((r.calendars as { selected?: unknown } | undefined)?.selected)
        ? ((r.calendars as { selected: string[] }).selected)
        : null,
    },
  };
}

function load(): AppSettings {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return normalize(JSON.parse(cur));
    // migrate from an older/renamed key and persist so it runs only once
    const older =
      localStorage.getItem(OLD_V3_KEY) ??
      localStorage.getItem(V2_KEY) ??
      localStorage.getItem(V1_KEY);
    if (older) {
      const migrated = normalize(JSON.parse(older));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    const s = defaults();
    const legacy = localStorage.getItem(LEGACY_CALENDARS_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy);
      if (isStringArray(ids)) s.calendars.selected = ids;
      localStorage.removeItem(LEGACY_CALENDARS_KEY);
      localStorage.setItem(KEY, JSON.stringify(s));
    }
    return s;
  } catch {
    return defaults();
  }
}

// initial value is the local cache; the selected server profile replaces it
// on boot via initProfiles() (falls back to this cache when offline)
export const settings = signal<AppSettings>(load());

let suppressServerPush = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleProfileSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveProfile(currentProfileName(), settings.peek());
  }, 800);
}

function persist(next: AppSettings): void {
  settings.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next)); // offline cache
  } catch {
    /* storage full/blocked — keep running with in-memory settings */
  }
  if (!suppressServerPush) scheduleProfileSave();
}

/** Replace settings from a server profile without echoing it straight back. */
function applyServerProfile(raw: unknown): void {
  suppressServerPush = true;
  persist(normalize(raw));
  suppressServerPush = false;
}

/* ---------- profiles (shared, server-backed) ---------- */

/** Boot: load the device's selected profile, seeding a Default if none exist. */
export async function initProfiles(): Promise<void> {
  const list = await listProfiles();
  const userProfiles = list.filter((p) => !p.template);
  if (userProfiles.length === 0) {
    // nothing on the server yet — seed Default from this device's cache
    setCurrentProfileName('Default');
    await saveProfile('Default', settings.peek());
    return;
  }
  let name = currentProfileName();
  if (!userProfiles.some((p) => p.name === name)) name = userProfiles[0].name;
  setCurrentProfileName(name);
  const raw = await loadProfile(name);
  if (raw) applyServerProfile(raw);
}

export async function switchProfile(name: string): Promise<void> {
  setCurrentProfileName(name);
  const raw = await loadProfile(name);
  if (raw) applyServerProfile(raw);
}

/** Save the current layout as a new profile and make it active. */
export async function saveCurrentAs(name: string): Promise<void> {
  const safe = name.trim();
  if (!safe) return;
  setCurrentProfileName(safe);
  await saveProfile(safe, settings.peek());
}

/** Clone a template into a new named profile and make it active. */
export async function cloneProfile(sourceName: string, newName: string): Promise<void> {
  const safe = newName.trim();
  const raw = await loadProfile(sourceName);
  if (!safe || !raw) return;
  setCurrentProfileName(safe);
  applyServerProfile(raw);
  await saveProfile(safe, settings.peek());
}

export async function removeProfile(name: string): Promise<void> {
  await deleteProfile(name);
}

export function updateSettings(patch: Partial<AppSettings>): void {
  persist({ ...settings.peek(), ...patch });
}

export function setSelectedCalendars(ids: string[] | null): void {
  updateSettings({ calendars: { selected: ids } });
}

export function setNavWidth(px: number): void {
  updateSettings({ navWidth: Math.min(Math.max(Math.round(px), 60), 320) });
}

export function setTheme(id: string): void {
  updateSettings({ theme: id });
}

/* ---------- pages ---------- */

function patchPage(pageId: string, patch: Partial<PageDef>): void {
  updateSettings({
    pages: settings.peek().pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
  });
}

export function addPage(opts?: { title?: string; hidden?: boolean }): PageDef {
  const page: PageDef = {
    id: newId('p'),
    title: opts?.title?.trim() || 'New page',
    icon: 'home',
    kind: 'grid',
    elements: [],
    ...(opts?.hidden ? { hidden: true } : {}),
  };
  updateSettings({ pages: [...settings.peek().pages, page] });
  return page;
}

/** Refuses to remove the last page. Caller handles navigating away. */
export function removePage(pageId: string): void {
  const pages = settings.peek().pages;
  if (pages.length <= 1) return;
  updateSettings({ pages: pages.filter((p) => p.id !== pageId) });
}

export function renamePage(pageId: string, title: string): void {
  patchPage(pageId, { title });
}

export function setPageIcon(pageId: string, icon: string): void {
  patchPage(pageId, { icon });
}

/** true = hide from the nav sidebar (still reachable by id, e.g. via a
    Popup element or a direct navigate() call). */
export function setPageHidden(pageId: string, hidden: boolean): void {
  patchPage(pageId, { hidden });
}

export function setPageBackground(pageId: string, url: string | undefined): void {
  const pages = settings.peek().pages.map((p) => {
    if (p.id !== pageId) return p;
    const next = { ...p };
    if (url) next.background = url;
    else delete next.background;
    return next;
  });
  updateSettings({ pages });
}

export function setPageBackgroundGlass(pageId: string, glass: number): void {
  patchPage(pageId, { backgroundGlass: Math.min(Math.max(Math.round(glass), 0), 100) });
}

/** undefined = follow the system-wide "show card titles" setting */
export function setPageShowTitles(pageId: string, show: boolean | undefined): void {
  patchPage(pageId, { showTitles: show });
}

export function setPageFitHeight(pageId: string, fit: boolean): void {
  patchPage(pageId, { fitHeight: fit });
}

export function movePage(pageId: string, dir: -1 | 1): void {
  const pages = [...settings.peek().pages];
  const i = pages.findIndex((p) => p.id === pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  updateSettings({ pages });
}

/* ---------- elements ---------- */

export function addElement(pageId: string, el: GridElement): void {
  const page = settings.peek().pages.find((p) => p.id === pageId);
  if (!page) return;
  patchPage(pageId, { elements: [...page.elements, el] });
}

export function removeElement(pageId: string, elementId: string): void {
  const page = settings.peek().pages.find((p) => p.id === pageId);
  if (!page) return;
  patchPage(pageId, { elements: page.elements.filter((e) => e.id !== elementId) });
}

/** Shallow-merges into element.options (JSON drops keys set to undefined). */
export function updateElementOptions(
  pageId: string,
  elementId: string,
  patch: Record<string, unknown>,
): void {
  const page = settings.peek().pages.find((p) => p.id === pageId);
  if (!page) return;
  patchPage(pageId, {
    elements: page.elements.map((e) =>
      e.id === elementId ? { ...e, options: { ...e.options, ...patch } } : e,
    ),
  });
}

export function moveResizeElement(pageId: string, elementId: string, rect: GridRect): void {
  const page = settings.peek().pages.find((p) => p.id === pageId);
  if (!page) return;
  patchPage(pageId, {
    elements: page.elements.map((e) => (e.id === elementId ? { ...e, ...rect } : e)),
  });
}

/* ---------- export / import ---------- */

export function exportSettings(): string {
  return JSON.stringify(settings.peek(), null, 2);
}

export function importSettings(json: string): { ok: true } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Expected a settings object.' };
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number') {
    return { ok: false, error: 'Not a HAView settings file (missing version).' };
  }
  persist(normalize(raw));
  return { ok: true };
}

// keep the browser tab named after the household
settings.subscribe((s) => {
  document.title = s.subtitle ? `${s.title} — ${s.subtitle}` : s.title;
});

settings.subscribe((s) => {
  applyTheme(s.theme);
  applyColorMode(s.colorMode);
  document.documentElement.style.setProperty('--card-alpha', `${s.cardOpacity}%`);
  document.documentElement.style.setProperty('--nav-width', `${s.navWidth}px`);
  document.documentElement.style.setProperty('--ui-scale', String(s.uiScale / 100));
  // card style (solid/glass) + frost strength; glass cards read --card-blur
  document.documentElement.dataset.cardStyle = s.cardStyle;
  document.documentElement.style.setProperty(
    '--glass-blur',
    `${Math.round((s.glassBlur / 100) * 28)}px`,
  );
  if (s.titleColor) document.documentElement.style.setProperty('--title-color', s.titleColor);
  else document.documentElement.style.removeProperty('--title-color');
  // a custom accent overrides the theme preset's --accent (and derives a
  // matching translucent --accent-dim); cleared → fall back to the theme
  if (s.accentColor) {
    document.documentElement.style.setProperty('--accent', s.accentColor);
    document.documentElement.style.setProperty(
      '--accent-dim',
      `color-mix(in srgb, ${s.accentColor} 16%, transparent)`,
    );
  } else {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-dim');
  }
});
