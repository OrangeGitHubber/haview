import { signal, computed, type ReadonlySignal } from '@preact/signals';
import { getConnection } from './connection';

/**
 * HA registries (areas, devices, entity registry, labels) for the entity
 * picker. home-assistant-js-websocket ships no registry helpers, so this is
 * hand-rolled on sendMessagePromise + *_registry_updated events. Loaded
 * lazily via ensureRegistries() — only the Add-element picker needs it, so
 * wall-display startup stays free of these four list calls.
 */

export interface AreaEntry {
  area_id: string;
  name: string;
  floor_id: string | null;
}

export interface DeviceEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  area_id: string | null;
  labels: string[];
}

export interface EntityEntry {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  labels: string[];
  name: string | null;
  original_name: string | null;
  /** user-set icon override ('mdi:…'), when configured in HA */
  icon?: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  entity_category: 'config' | 'diagnostic' | null;
}

export interface LabelEntry {
  label_id: string;
  name: string;
  color: string | null;
}

export const areas = signal<AreaEntry[]>([]);
export const devices = signal<DeviceEntry[]>([]);
export const entityEntries = signal<EntityEntry[]>([]);
export const labels = signal<LabelEntry[]>([]);
export const registriesLoaded = signal(false);

/**
 * Include HA's `config` and `diagnostic` entities in the pickers.
 *
 * Off by default because a typical install has hundreds of them (battery
 * levels, signal strength, uptime, firmware, per-integration toggles) and they
 * drown the useful entities. But plenty of them ARE the thing you want on a
 * wall board — UniFi firewall rules, for instance, are `switch.*` entities
 * categorised as `config`.
 *
 * Device-local (a picker preference, not dashboard config), so it lives in
 * localStorage rather than the versioned settings object.
 */
const ADVANCED_KEY = 'oranjehuis.showAdvancedEntities';

function readAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1';
  } catch {
    return false;
  }
}

export const showAdvancedEntities = signal<boolean>(readAdvanced());

export function setShowAdvancedEntities(on: boolean): void {
  showAdvancedEntities.value = on;
  try {
    localStorage.setItem(ADVANCED_KEY, on ? '1' : '0');
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

/** How many entities the advanced toggle would add (for the toggle's hint). */
export const advancedEntityCount: ReadonlySignal<number> = computed(
  () =>
    entityEntries.value.filter((e) => e.disabled_by === null && e.entity_category !== null).length,
);

let started = false;
let refetchTimer: ReturnType<typeof setTimeout> | undefined;

async function fetchAll(): Promise<void> {
  const conn = await getConnection();
  const [a, d, e, l] = await Promise.all([
    conn.sendMessagePromise<AreaEntry[]>({ type: 'config/area_registry/list' }),
    conn.sendMessagePromise<DeviceEntry[]>({ type: 'config/device_registry/list' }),
    conn.sendMessagePromise<EntityEntry[]>({ type: 'config/entity_registry/list' }),
    // labels arrived in HA 2024.4; older installs reject the command
    conn
      .sendMessagePromise<LabelEntry[]>({ type: 'config/label_registry/list' })
      .catch(() => [] as LabelEntry[]),
  ]);
  areas.value = [...a].sort((x, y) => x.name.localeCompare(y.name));
  devices.value = d;
  entityEntries.value = e;
  labels.value = [...l].sort((x, y) => x.name.localeCompare(y.name));
  registriesLoaded.value = true;
}

function scheduleRefetch(): void {
  clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    fetchAll().catch(() => {
      /* transient; next registry event retries */
    });
  }, 500);
}

export function ensureRegistries(): void {
  if (started) return;
  started = true;
  (async () => {
    const conn = await getConnection();
    await fetchAll();
    const events = [
      'area_registry_updated',
      'device_registry_updated',
      'entity_registry_updated',
      'label_registry_updated',
    ];
    for (const ev of events) {
      // fire-and-forget; the connection resubscribes these after reconnect
      conn.subscribeEvents(scheduleRefetch, ev).catch(() => {});
    }
  })().catch(() => {
    started = false; // unconfigured/auth-failed; retried on next picker open
  });
}

const deviceById: ReadonlySignal<Map<string, DeviceEntry>> = computed(() => {
  const map = new Map<string, DeviceEntry>();
  for (const d of devices.value) map.set(d.id, d);
  return map;
});

export function deviceName(d: DeviceEntry): string {
  return d.name_by_user ?? d.name ?? '';
}

/** Area the entity effectively belongs to: its own, else its device's. */
export function effectiveAreaId(entry: EntityEntry): string | null {
  if (entry.area_id) return entry.area_id;
  const dev = entry.device_id ? deviceById.value.get(entry.device_id) : undefined;
  return dev?.area_id ?? null;
}

/** Entity labels plus its device's labels. */
export function effectiveLabels(entry: EntityEntry): string[] {
  const dev = entry.device_id ? deviceById.value.get(entry.device_id) : undefined;
  if (!dev || dev.labels.length === 0) return entry.labels;
  return [...new Set([...entry.labels, ...dev.labels])];
}

export function deviceOf(entry: EntityEntry): DeviceEntry | undefined {
  return entry.device_id ? deviceById.value.get(entry.device_id) : undefined;
}

/**
 * Pickable entities grouped by area id ('' = no area, last). Always excludes
 * disabled entities; excludes config/diagnostic ones unless the advanced
 * toggle is on (see showAdvancedEntities).
 *
 * Note `hidden_by` is deliberately NOT filtered: hiding an entity in HA hides
 * it from HA's own dashboards, but people hide things there and still want
 * them on this board, and filtering it here would silently remove entities
 * that are pickable today.
 */
export const entitiesByArea: ReadonlySignal<Map<string, EntityEntry[]>> = computed(() => {
  const advanced = showAdvancedEntities.value;
  const groups = new Map<string, EntityEntry[]>();
  for (const area of areas.value) groups.set(area.area_id, []);
  const noArea: EntityEntry[] = [];
  for (const entry of entityEntries.value) {
    if (entry.disabled_by !== null) continue;
    if (!advanced && entry.entity_category !== null) continue;
    const areaId = effectiveAreaId(entry);
    const bucket = areaId !== null ? groups.get(areaId) : undefined;
    if (bucket) bucket.push(entry);
    else noArea.push(entry);
  }
  for (const [id, list] of groups) {
    if (list.length === 0) groups.delete(id);
    else list.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  }
  noArea.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  if (noArea.length) groups.set('', noArea);
  return groups;
});
