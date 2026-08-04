import { useEffect, useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import {
  ensureRegistries,
  registriesLoaded,
  areas,
  labels,
  entitiesByArea,
  effectiveLabels,
  deviceOf,
  deviceName,
  type EntityEntry,
} from '../lib/ha/registries';
import { settings, addElement, addPage, newId } from '../lib/settings';
import { elementDefs } from './elements';
import { findFreeSlot } from './layout';
import { MdiIcon } from '../components/MdiIcon';
import { domainIconNames } from '../lib/entityIcons';
import styles from './grid.module.css';

function entryName(en: EntityEntry): string {
  return en.name ?? en.original_name ?? en.entity_id;
}

function placeElement(
  pageId: string,
  type: string,
  options?: Record<string, unknown>,
): string | null {
  const def = elementDefs[type];
  const page = settings.peek().pages.find((p) => p.id === pageId);
  if (!def || !page) return null;
  const slot = findFreeSlot(page.elements, def.defaultSize.w, def.defaultSize.h);
  const id = newId('e');
  addElement(pageId, {
    id,
    type,
    ...slot,
    ...def.defaultSize,
    ...(options ? { options } : {}),
  });
  return id;
}

type Tab = 'devices' | 'areas' | 'labels' | 'widgets';

export function AddElementModal({
  pageId,
  onClose,
  onPlaced,
}: {
  pageId: string;
  onClose: () => void;
  /** called with the new element id when a just-added element should open its options */
  onPlaced?: (elementId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('devices');
  const [query, setQuery] = useState('');
  const [areaSel, setAreaSel] = useState<string | null>(null);
  const [labelSel, setLabelSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [expandedDevices, setExpandedDevices] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    ensureRegistries();
  }, []);

  const loaded = registriesLoaded.value;
  const q = query.trim().toLowerCase();

  const toggleChecked = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const areaNames = new Map(areas.value.map((a) => [a.area_id, a.name]));
  const areaLabel = (id: string) => (id ? (areaNames.get(id) ?? id) : 'No area');

  const submit = () => {
    const placed: string[] = [];
    for (const entityId of checked) {
      const id = placeElement(pageId, 'entity', { entityId });
      if (id) placed.push(id);
    }
    onClose();
    // a single added card goes straight to its settings, like widgets do
    if (placed.length === 1 && onPlaced) onPlaced(placed[0]);
  };

  const entityRow = (en: EntityEntry) => (
    <label class={styles.entityRow}>
      <input
        type="checkbox"
        checked={checked.has(en.entity_id)}
        onChange={() => toggleChecked(en.entity_id)}
      />
      <MdiIcon names={domainIconNames(en.entity_id, en.icon)} class={styles.rowIcon} />
      <span class={styles.entityName}>{entryName(en)}</span>
      <span class={styles.entityId}>{en.entity_id}</span>
    </label>
  );

  /**
   * Devices first: each named device is a collapsed row; tapping it reveals
   * its entities. Entities without a (named) device show directly.
   */
  const rows = (list: EntityEntry[]) => {
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
    return (
      <ul class={styles.entityList}>
        {devices.map(([devId, g]) => {
          const open = q !== '' || expandedDevices.has(devId);
          const sel = g.ents.filter((e) => checked.has(e.entity_id)).length;
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
                  {sel > 0 ? `${sel} ✓ · ` : ''}
                  {g.ents.length} {open ? '▾' : '▸'}
                </span>
              </button>
              {open && (
                <ul class={styles.entitySub}>
                  {g.ents.map((en) => (
                    <li key={en.entity_id}>{entityRow(en)}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {orphans.map((en) => (
          <li key={en.entity_id}>{entityRow(en)}</li>
        ))}
      </ul>
    );
  };

  const skeletons = (
    <>
      <div class={styles.skeletonRow} />
      <div class={styles.skeletonRow} />
      <div class={styles.skeletonRow} />
    </>
  );

  const allPickable: EntityEntry[] = loaded ? [...entitiesByArea.value.values()].flat() : [];

  const matches = (en: EntityEntry): boolean => {
    if (!q) return true;
    if (entryName(en).toLowerCase().includes(q) || en.entity_id.toLowerCase().includes(q)) {
      return true;
    }
    const dev = deviceOf(en);
    return dev ? deviceName(dev).toLowerCase().includes(q) : false;
  };

  const searchBar = (placeholder: string) => (
    <input
      class={styles.searchInput}
      type="search"
      placeholder={placeholder}
      value={query}
      onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
    />
  );

  /* ---------- per-tab content ---------- */

  let body = null;
  if (tab === 'devices') {
    // one flat, alphabetical device list — no area grouping
    const list = allPickable.filter(matches);
    body = (
      <>
        {searchBar('Search devices and entities…')}
        {!loaded && skeletons}
        {loaded && list.length === 0 && <p class={styles.noResults}>No devices match.</p>}
        {loaded && list.length > 0 && rows(list)}
      </>
    );
  } else if (tab === 'areas') {
    if (!loaded) body = skeletons;
    else if (areaSel === null) {
      const areaList = [...entitiesByArea.value.entries()].filter(
        ([id]) => !q || areaLabel(id).toLowerCase().includes(q),
      );
      body = (
        <>
          {searchBar('Search areas…')}
          {areaList.length === 0 && <p class={styles.noResults}>No areas match.</p>}
          <div class={styles.areaBtnList}>
            {areaList.map(([id, list]) => (
              <button
                key={id}
                class={styles.areaBtn}
                onClick={() => {
                  setAreaSel(id);
                  setQuery('');
                }}
              >
                <span>{areaLabel(id)}</span>
                <span class={styles.areaCount}>{list.length} ›</span>
              </button>
            ))}
          </div>
        </>
      );
    } else {
      body = (
        <>
          <button class={styles.backBtn} onClick={() => setAreaSel(null)}>
            ‹ All areas
          </button>
          {searchBar(`Search in ${areaLabel(areaSel)}…`)}
          <div class={styles.areaGroup}>
            <div class={styles.areaHeader}>{areaLabel(areaSel)}</div>
            {rows((entitiesByArea.value.get(areaSel) ?? []).filter(matches))}
          </div>
        </>
      );
    }
  } else if (tab === 'labels') {
    if (!loaded) body = skeletons;
    else if (labels.value.length === 0) {
      body = <p class={styles.noResults}>No labels defined in Home Assistant.</p>;
    } else if (labelSel === null) {
      const labelList = labels.value.filter((l) => !q || l.name.toLowerCase().includes(q));
      body = (
        <>
          {searchBar('Search labels…')}
          {labelList.length === 0 && <p class={styles.noResults}>No labels match.</p>}
          <div class={styles.areaBtnList}>
            {labelList.map((l) => {
              const count = allPickable.filter((en) => effectiveLabels(en).includes(l.label_id)).length;
              return (
                <button
                  key={l.label_id}
                  class={styles.areaBtn}
                  onClick={() => {
                    setLabelSel(l.label_id);
                    setQuery('');
                  }}
                >
                  <span>{l.name}</span>
                  <span class={styles.areaCount}>{count} ›</span>
                </button>
              );
            })}
          </div>
        </>
      );
    } else {
      const label = labels.value.find((l) => l.label_id === labelSel);
      body = (
        <>
          <button class={styles.backBtn} onClick={() => setLabelSel(null)}>
            ‹ All labels
          </button>
          {searchBar(`Search in ${label?.name ?? 'label'}…`)}
          <div class={styles.areaGroup}>
            <div class={styles.areaHeader}>{label?.name ?? labelSel}</div>
            {rows(
              allPickable.filter((en) => effectiveLabels(en).includes(labelSel)).filter(matches),
            )}
          </div>
        </>
      );
    }
  } else {
    body = (
      <>
        {Object.values(elementDefs)
          .filter((d) => d.type !== 'entity')
          .map((d) => (
            <div key={d.type} class={styles.widgetAddRow}>
              <span>{d.title}</span>
              <button
                onClick={() => {
                  // a Collection gets its own fresh empty page automatically —
                  // no page-picking step, so it can't be mis-linked
                  const options =
                    d.type === 'popup'
                      ? {
                          targetPageId: addPage({ title: 'New collection', hidden: true }).id,
                          display: 'panel',
                        }
                      : undefined;
                  const id = placeElement(pageId, d.type, options);
                  onClose();
                  // jump straight into the new element's settings
                  if (id && d.optionsLoader && onPlaced) onPlaced(id);
                }}
              >
                Add
              </button>
            </div>
          ))}
      </>
    );
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      class={`${styles.tab}${tab === id ? ` ${styles.tabActive}` : ''}`}
      onClick={() => {
        setTab(id);
        setQuery('');
      }}
    >
      {label}
    </button>
  );

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <div class={styles.tabRow}>
        {tabBtn('devices', 'Devices')}
        {tabBtn('areas', 'Areas')}
        {tabBtn('labels', 'Labels')}
        {tabBtn('widgets', 'Widgets')}
      </div>
      <div class={styles.pickerBody}>{body}</div>
      {tab !== 'widgets' && (
        <div class={styles.pickerFooter}>
          <button class={styles.addManyBtn} disabled={checked.size === 0} onClick={submit}>
            Add {checked.size || ''} device{checked.size === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </Modal>
  );
}
