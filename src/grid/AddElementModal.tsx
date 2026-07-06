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
import { settings, addElement, newId } from '../lib/settings';
import { elementDefs } from './elements';
import { findFreeSlot } from './layout';
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

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

  const rows = (list: EntityEntry[], withDeviceHeadings: boolean) => (
    <ul class={styles.entityList}>
      {list.map((en, i) => {
        const dev = deviceOf(en);
        const dn = dev ? deviceName(dev) : '';
        const prev = i > 0 ? list[i - 1] : undefined;
        const prevDev = prev ? deviceOf(prev) : undefined;
        const showDevice = withDeviceHeadings && dn !== '' && (!prevDev || deviceName(prevDev) !== dn);
        return (
          <li key={en.entity_id}>
            {showDevice && <div class={styles.deviceHeading}>{dn}</div>}
            <label class={styles.entityRow}>
              <input
                type="checkbox"
                checked={checked.has(en.entity_id)}
                onChange={() => toggleChecked(en.entity_id)}
              />
              <span class={styles.entityName}>{entryName(en)}</span>
              <span class={styles.entityId}>{en.entity_id}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  const skeletons = (
    <>
      <div class={styles.skeletonRow} />
      <div class={styles.skeletonRow} />
      <div class={styles.skeletonRow} />
    </>
  );

  const allPickable: EntityEntry[] = loaded ? [...entitiesByArea.value.values()].flat() : [];

  /* ---------- per-tab content ---------- */

  let body = null;
  if (tab === 'devices') {
    const groups: { areaId: string; name: string; list: EntityEntry[] }[] = [];
    for (const [areaId, list] of entitiesByArea.value) {
      const filtered = q
        ? list.filter(
            (en) =>
              entryName(en).toLowerCase().includes(q) || en.entity_id.toLowerCase().includes(q),
          )
        : list;
      if (filtered.length > 0) {
        groups.push({ areaId, name: areaLabel(areaId), list: filtered });
      }
    }
    body = (
      <>
        <input
          class={styles.searchInput}
          type="search"
          placeholder="Search devices and entities…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        {!loaded && skeletons}
        {loaded && groups.length === 0 && <p class={styles.noResults}>No devices match.</p>}
        {groups.map((g) => {
          const open = q !== '' || expanded.has(g.areaId);
          return (
            <div key={g.areaId} class={styles.areaGroup}>
              <button
                class={styles.areaHeader}
                onClick={() => {
                  const next = new Set(expanded);
                  if (next.has(g.areaId)) next.delete(g.areaId);
                  else next.add(g.areaId);
                  setExpanded(next);
                }}
              >
                <span>{g.name}</span>
                <span class={styles.areaCount}>
                  {g.list.length} {open ? '▾' : '▸'}
                </span>
              </button>
              {open && rows(g.list, true)}
            </div>
          );
        })}
      </>
    );
  } else if (tab === 'areas') {
    if (!loaded) body = skeletons;
    else if (areaSel === null) {
      body = (
        <div class={styles.areaBtnList}>
          {[...entitiesByArea.value.entries()].map(([id, list]) => (
            <button key={id} class={styles.areaBtn} onClick={() => setAreaSel(id)}>
              <span>{areaLabel(id)}</span>
              <span class={styles.areaCount}>{list.length} ›</span>
            </button>
          ))}
        </div>
      );
    } else {
      body = (
        <>
          <button class={styles.backBtn} onClick={() => setAreaSel(null)}>
            ‹ All areas
          </button>
          <div class={styles.areaGroup}>
            <div class={styles.areaHeader}>{areaLabel(areaSel)}</div>
            {rows(entitiesByArea.value.get(areaSel) ?? [], true)}
          </div>
        </>
      );
    }
  } else if (tab === 'labels') {
    if (!loaded) body = skeletons;
    else if (labels.value.length === 0) {
      body = <p class={styles.noResults}>No labels defined in Home Assistant.</p>;
    } else if (labelSel === null) {
      body = (
        <div class={styles.areaBtnList}>
          {labels.value.map((l) => {
            const count = allPickable.filter((en) => effectiveLabels(en).includes(l.label_id)).length;
            return (
              <button key={l.label_id} class={styles.areaBtn} onClick={() => setLabelSel(l.label_id)}>
                <span>{l.name}</span>
                <span class={styles.areaCount}>{count} ›</span>
              </button>
            );
          })}
        </div>
      );
    } else {
      const label = labels.value.find((l) => l.label_id === labelSel);
      body = (
        <>
          <button class={styles.backBtn} onClick={() => setLabelSel(null)}>
            ‹ All labels
          </button>
          <div class={styles.areaGroup}>
            <div class={styles.areaHeader}>{label?.name ?? labelSel}</div>
            {rows(
              allPickable.filter((en) => effectiveLabels(en).includes(labelSel)),
              true,
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
                  const id = placeElement(pageId, d.type);
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
      onClick={() => setTab(id)}
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
