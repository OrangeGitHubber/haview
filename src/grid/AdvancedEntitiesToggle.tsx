import {
  showAdvancedEntities,
  setShowAdvancedEntities,
  advancedEntityCount,
  type EntityEntry,
} from '../lib/ha/registries';
import styles from './grid.module.css';

/**
 * Reveals HA's `config` and `diagnostic` entities in the pickers. They're
 * hidden by default because a typical install has hundreds, but some of them
 * are exactly what belongs on a wall board — UniFi firewall rules are
 * `switch.*` entities categorised as `config`.
 */
export function AdvancedEntitiesToggle() {
  const on = showAdvancedEntities.value;
  const extra = advancedEntityCount.value;
  return (
    <label class={styles.advToggle}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setShowAdvancedEntities((e.target as HTMLInputElement).checked)}
      />
      <span>
        Show config &amp; diagnostic entities
        {extra > 0 && <span class={styles.advCount}> +{extra}</span>}
      </span>
    </label>
  );
}

/** Small "config"/"diag" chip so an advanced entity is recognisable in a list. */
export function CategoryBadge({ entry }: { entry: EntityEntry }) {
  if (!entry.entity_category) return null;
  return (
    <span class={styles.catBadge}>
      {entry.entity_category === 'diagnostic' ? 'diag' : 'config'}
    </span>
  );
}
