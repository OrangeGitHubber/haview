import type { HassEntity } from 'home-assistant-js-websocket';
import { useSnapshot } from './useSnapshot';
import styles from './cameras.module.css';

export function CameraTile({
  entity,
  staggerMs,
  onOpen,
}: {
  entity: HassEntity;
  staggerMs: number;
  onOpen: () => void;
}) {
  const unavailable = entity.state === 'unavailable';
  const { src, stale } = useSnapshot(
    entity.entity_id,
    staggerMs,
    entity.attributes.entity_picture as string | undefined,
  );
  const name = (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;

  return (
    <button
      class={`${styles.tile}${unavailable ? ` ${styles.unavailable}` : ''}`}
      onClick={onOpen}
      disabled={unavailable}
      aria-label={`Open live stream: ${name}`}
    >
      {src ? (
        <img src={src} alt={name} loading="lazy" />
      ) : (
        <div class={styles.placeholder}>
          {unavailable
            ? 'Unavailable'
            : stale
              ? 'No snapshot — tap for live view'
              : 'Loading…'}
        </div>
      )}
      <span class={styles.name}>{name}</span>
      {stale && !unavailable && (
        <span class={styles.stale} title="Snapshot may be outdated">
          ⏱ stale
        </span>
      )}
    </button>
  );
}
