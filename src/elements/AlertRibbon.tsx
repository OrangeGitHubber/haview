import type { HassEntity } from '../lib/types';
import { useEntity } from '../lib/ha/entities';
import EntityCard from './EntityCard';
import type { ElementProps } from '../grid/elements';
import type { GridElement } from '../grid/types';
import styles from './elements.module.css';

export type AlertOp = 'on' | 'off' | 'gt' | 'lt' | 'eq' | 'ne';

export interface AlertItem {
  id: string;
  entityId: string;
  op: AlertOp;
  /** comparison value for gt/lt/eq/ne */
  value?: string;
}

export interface AlertRibbonOptions {
  title?: string;
  items?: AlertItem[];
  /** card size in px (user-controlled) */
  cardWidth?: number;
  cardHeight?: number;
  /** legacy S/M/L preset, mapped to px for older configs */
  cardSize?: 's' | 'm' | 'l';
}

const LEGACY_SIZES: Record<string, { w: number; h: number }> = {
  s: { w: 150, h: 64 },
  m: { w: 200, h: 90 },
  l: { w: 260, h: 120 },
};

export const DEFAULT_ALERT_CARD = { w: 200, h: 90 };

export function alertCardSize(o: AlertRibbonOptions): { w: number; h: number } {
  const legacy = o.cardSize ? LEGACY_SIZES[o.cardSize] : undefined;
  return {
    w: typeof o.cardWidth === 'number' ? o.cardWidth : (legacy?.w ?? DEFAULT_ALERT_CARD.w),
    h: typeof o.cardHeight === 'number' ? o.cardHeight : (legacy?.h ?? DEFAULT_ALERT_CARD.h),
  };
}

export function alertActive(entity: HassEntity, it: AlertItem): boolean {
  const s = entity.state;
  if (s === 'unavailable' || s === 'unknown') return false;
  switch (it.op) {
    case 'on':
      return s === 'on';
    case 'off':
      return s === 'off';
    case 'gt': {
      const a = Number(s);
      const b = Number(it.value);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case 'lt': {
      const a = Number(s);
      const b = Number(it.value);
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    case 'eq':
      return s.toLowerCase() === String(it.value ?? '').trim().toLowerCase();
    case 'ne':
      return s.toLowerCase() !== String(it.value ?? '').trim().toLowerCase();
  }
}

export function opLabel(it: AlertItem): string {
  switch (it.op) {
    case 'on':
      return 'is on';
    case 'off':
      return 'is off';
    case 'gt':
      return `> ${it.value ?? '?'}`;
    case 'lt':
      return `< ${it.value ?? '?'}`;
    case 'eq':
      return `= ${it.value ?? '?'}`;
    case 'ne':
      return `≠ ${it.value ?? '?'}`;
  }
}

/**
 * Shows entity cards ONLY while their "display if…" condition holds
 * (e.g. door open, temperature above a threshold). Quiet when all clear.
 */
export default function AlertRibbon({ element, editing }: ElementProps) {
  const o = (element.options ?? {}) as AlertRibbonOptions;
  const items = Array.isArray(o.items) ? o.items : [];
  const title = o.title?.trim() || 'Alerts';
  const size = alertCardSize(o);

  // useEntity is a plain signal getter (not a hook), safe in a loop
  const active = items.filter((it) => {
    const entity = useEntity(it.entityId).value;
    return entity !== undefined && alertActive(entity, it);
  });

  const syntheticFor = (entityId: string): GridElement => ({
    id: `alert-${entityId}`,
    type: 'entity',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    options: { entityId },
  });

  // when nothing is triggered, the ribbon is fully invisible in normal use
  // (no card at all); the title + placeholder only appear in page edit mode
  // so it stays findable
  if (active.length === 0) {
    if (!editing) return null;
    return (
      <div class={`${styles.card} ${styles.alertRibbon}`}>
        <div class={styles.graphHead}>
          <span class={`${styles.name} card-title`}>{title}</span>
        </div>
        <span class={styles.alertClear}>
          {items.length === 0 ? 'No alert rules — tap to configure.' : 'All clear ✓'}
        </span>
      </div>
    );
  }

  return (
    <div class={`${styles.card} ${styles.alertRibbon}`}>
      <div class={styles.graphHead}>
        <span class={`${styles.name} card-title`}>{title}</span>
      </div>
      <div class={styles.alertRow}>
        {active.map((it) => (
          <div
            key={it.id}
            class={styles.alertItem}
            style={{ width: `${size.w}px`, height: `${size.h}px` }}
          >
            <EntityCard pageId="" element={syntheticFor(it.entityId)} editing={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
