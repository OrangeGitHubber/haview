import { useEffect, useState } from 'preact/hooks';
import {
  ensureRegistries,
  registriesLoaded,
  entitiesByArea,
  deviceOf,
  deviceName,
  type EntityEntry,
} from '../lib/ha/registries';
import { MdiIcon } from '../components/MdiIcon';
import { domainIconNames } from '../lib/entityIcons';
import { AdvancedEntitiesToggle, CategoryBadge } from './AdvancedEntitiesToggle';
import styles from './grid.module.css';

function entryName(en: EntityEntry): string {
  return en.name ?? en.original_name ?? en.entity_id;
}

/**
 * Single-pick device browser with the same look as the Add dialog's Devices
 * tab: search bar on top, devices as collapsed rows, tap a device to reveal
 * its entities, tap an entity to pick it. The list pane has a FIXED height
 * so the surrounding dialog never resizes while searching.
 */
export function EntityPicker({
  onPick,
  filter,
  current,
}: {
  onPick: (entityId: string) => void;
  /** optional restriction, e.g. only sensors */
  filter?: (en: EntityEntry) => boolean;
  /** the entity already selected — marked in the list and revealed on open */
  current?: string;
}) {
  const [query, setQuery] = useState('');
  const [expandedDevices, setExpandedDevices] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    ensureRegistries();
  }, []);

  const loaded = registriesLoaded.value;

  // reveal the device holding the already-selected entity, so opening the
  // picker doesn't mean hunting for what the card currently shows
  useEffect(() => {
    if (!loaded || !current) return;
    const en = [...entitiesByArea.peek().values()].flat().find((e) => e.entity_id === current);
    const dev = en ? deviceOf(en) : undefined;
    if (dev) setExpandedDevices((prev) => new Set(prev).add(dev.id));
  }, [loaded, current]);
  const q = query.trim().toLowerCase();

  const matches = (en: EntityEntry): boolean => {
    if (filter && !filter(en)) return false;
    if (!q) return true;
    if (entryName(en).toLowerCase().includes(q) || en.entity_id.toLowerCase().includes(q)) {
      return true;
    }
    const dev = deviceOf(en);
    return dev ? deviceName(dev).toLowerCase().includes(q) : false;
  };

  const list = (loaded ? [...entitiesByArea.value.values()].flat() : []).filter(matches);

  const byDevice = new Map<string, { name: string; ents: EntityEntry[] }>();
  const orphans: EntityEntry[] = [];
  for (const en of list) {
    const dev = deviceOf(en);
    const dn = dev ? deviceName(dev) : '';
    if (dev && dn) {
      const g = byDevice.get(dev.id) ?? { name: dn, ents: [] };
      g.ents.push(en);
      byDevice.set(dev.id, g);
    } else {
      orphans.push(en);
    }
  }
  const devices = [...byDevice.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  const pickRow = (en: EntityEntry) => {
    const active = !!current && en.entity_id === current;
    return (
      <button
        class={`${styles.pickRow}${active ? ` ${styles.pickRowActive}` : ''}`}
        aria-current={active ? 'true' : undefined}
        onClick={() => onPick(en.entity_id)}
      >
        <MdiIcon names={domainIconNames(en.entity_id, en.icon)} class={styles.rowIcon} />
        <span class={styles.entityName}>{entryName(en)}</span>
        <CategoryBadge entry={en} />
        <span class={styles.entityId}>{en.entity_id}</span>
      </button>
    );
  };

  return (
    <div class={styles.pickerPane}>
      <input
        class={styles.searchInput}
        type="search"
        placeholder="Search devices and entities…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      <div class={styles.pickerScroll}>
        {!loaded && (
          <>
            <div class={styles.skeletonRow} />
            <div class={styles.skeletonRow} />
            <div class={styles.skeletonRow} />
          </>
        )}
        {loaded && list.length === 0 && (
          <p class={styles.noResults}>
            {q ? 'No devices match.' : 'Nothing pickable — try showing config entities below.'}
          </p>
        )}
        <ul class={styles.entityList}>
          {devices.map(([devId, g]) => {
            const open = q !== '' || expandedDevices.has(devId);
            return (
              <li key={devId}>
                <button
                  class={styles.deviceRow}
                  onClick={() => {
                    const next = new Set(expandedDevices);
                    if (next.has(devId)) next.delete(devId);
                    else next.add(devId);
                    setExpandedDevices(next);
                  }}
                >
                  <span class={styles.entityName}>{g.name}</span>
                  <span class={styles.areaCount}>
                    {g.ents.length} {open ? '▾' : '▸'}
                  </span>
                </button>
                {open && (
                  <ul class={styles.entitySub}>
                    {g.ents.map((en) => (
                      <li key={en.entity_id}>{pickRow(en)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {orphans.map((en) => (
            <li key={en.entity_id}>{pickRow(en)}</li>
          ))}
        </ul>
      </div>
      <AdvancedEntitiesToggle />
    </div>
  );
}
