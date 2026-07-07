import { signal } from '@preact/signals';
import { applyTheme, applyColorMode } from './themes';
import type { GridElement, GridRect } from '../grid/types';
import { GRID_COLS } from '../grid/types';
import { findFreeSlot } from '../grid/layout';

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
  kind: 'grid' | 'cameras';
  /** ignored for kind 'cameras' */
  elements: GridElement[];
  /** optional frosted background image URL ('/' paths resolve against the HA URL) */
  background?: string;
  /** frosted-glass strength 0–100 (blur amount); default 50 */
  backgroundGlass?: number;
}

export interface AppSettings {
  version: 2;
  title: string;
  subtitle: string;
  pages: PageDef[];
  /** Theme id from src/lib/themes.ts; unknown ids fall back to orange visually. */
  theme: string;
  /** light/dark handling: follow the OS or force one */
  colorMode: 'auto' | 'dark' | 'light';
  /** card/container background opacity in percent (30–100) */
  cardOpacity: number;
  /** dim the display during the configured window */
  nightDim: boolean;
  /** window start/end, 'HH:MM' (may wrap past midnight) */
  nightDimStart: string;
  nightDimEnd: string;
  /** dim strength in percent (10–90) */
  nightDimAmount: number;
  /** minutes of inactivity before dimming resumes after user activity */
  nightDimResume: number;
  weather: { entityId: string | null };
  presence: { personIds: string[] | null };
  calendars: { selected: string[] | null };
}

const KEY = 'oranjehuis.settings.v2';
// kept (not deleted) so a rollback to the previous image still finds its config
const V1_KEY = 'oranjehuis.settings.v1';
const LEGACY_CALENDARS_KEY = 'oranjehuis.selectedCalendars.v1';

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Sizes used when migrating v1 widgets and as add-defaults for widgets. */
const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
  calendar: { w: 12, h: 4 },
  weather: { w: 6, h: 3 },
  presence: { w: 6, h: 3 },
};

function defaultMainPage(): PageDef {
  return {
    id: 'main',
    title: 'Main',
    icon: 'home',
    kind: 'grid',
    elements: [
      { id: 'calendar', type: 'calendar', x: 0, y: 0, w: 12, h: 4 },
      { id: 'weather', type: 'weather', x: 0, y: 4, w: 6, h: 3 },
      { id: 'presence', type: 'presence', x: 6, y: 4, w: 6, h: 3 },
    ],
  };
}

function defaultCamerasPage(): PageDef {
  return { id: 'cameras', title: 'Cameras', icon: 'camera', kind: 'cameras', elements: [] };
}

function defaults(): AppSettings {
  return {
    version: 2,
    title: 'My Home',
    subtitle: 'Smart Dashboard',
    pages: [defaultMainPage(), defaultCamerasPage()],
    theme: 'orange',
    colorMode: 'auto',
    cardOpacity: 100,
    nightDim: false,
    nightDimStart: '22:00',
    nightDimEnd: '07:00',
    nightDimAmount: 40,
    nightDimResume: 2,
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
      let id = typeof pg.id === 'string' && pg.id && pg.id !== 'settings' ? pg.id : newId('p');
      while (seen.has(id)) id = newId('p');
      seen.add(id);
      out.push({
        id,
        title: typeof pg.title === 'string' && pg.title.trim() ? pg.title : 'Page',
        icon: typeof pg.icon === 'string' && pg.icon ? pg.icon : 'home',
        kind: pg.kind === 'cameras' ? 'cameras' : 'grid',
        elements: normalizeElements(pg.elements),
        ...(typeof pg.background === 'string' && pg.background
          ? { background: pg.background }
          : {}),
        ...(typeof pg.backgroundGlass === 'number' && Number.isFinite(pg.backgroundGlass)
          ? { backgroundGlass: Math.min(Math.max(Math.round(pg.backgroundGlass), 0), 100) }
          : {}),
      });
    }
  }
  if (out.length === 0) out.push(defaultMainPage(), defaultCamerasPage());
  return out;
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
  const main: PageDef = { ...defaultMainPage(), elements };
  if (elements.length === 0) main.elements = defaultMainPage().elements;
  // drop the v1 'widgets' key so it doesn't linger in v2 exports via ...rest
  const rest: Record<string, unknown> = { ...r };
  delete rest.widgets;
  return { ...rest, pages: [main, defaultCamerasPage()] };
}

/** Coerces arbitrary (imported) JSON into a valid AppSettings, preserving unknown keys. */
function normalize(raw: unknown): AppSettings {
  let r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.version === 1 || !Array.isArray(r.pages)) r = migrateV1(r);
  const base = defaults();
  return {
    ...r, // preserve unknown top-level keys from newer versions
    version: 2,
    title: typeof r.title === 'string' && r.title.trim() ? r.title : base.title,
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : base.subtitle,
    pages: normalizePages(r.pages),
    theme: typeof r.theme === 'string' && r.theme ? r.theme : base.theme,
    colorMode: r.colorMode === 'light' || r.colorMode === 'dark' ? r.colorMode : 'auto',
    cardOpacity:
      typeof r.cardOpacity === 'number' && Number.isFinite(r.cardOpacity)
        ? Math.min(Math.max(Math.round(r.cardOpacity), 30), 100)
        : base.cardOpacity,
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
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const v1 = localStorage.getItem(V1_KEY);
    if (v1) {
      const migrated = normalize(JSON.parse(v1));
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

export const settings = signal<AppSettings>(load());

function persist(next: AppSettings): void {
  settings.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — keep running with in-memory settings */
  }
}

export function updateSettings(patch: Partial<AppSettings>): void {
  persist({ ...settings.peek(), ...patch });
}

export function setSelectedCalendars(ids: string[] | null): void {
  updateSettings({ calendars: { selected: ids } });
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

export function addPage(kind: 'grid' | 'cameras' = 'grid'): PageDef {
  const page: PageDef = {
    id: newId('p'),
    title: kind === 'cameras' ? 'Cameras' : 'New page',
    icon: kind === 'cameras' ? 'camera' : 'home',
    kind,
    elements: [],
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
    return { ok: false, error: 'Not an Oranjehuis settings file (missing version).' };
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
});
