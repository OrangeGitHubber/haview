import { useState } from 'preact/hooks';
import { useEntity } from '../lib/ha/entities';
import { CameraTile } from '../views/cameras/CameraTile';
import { StreamModal } from '../views/cameras/StreamModal';
import type { ElementProps } from '../grid/elements';
import styles from './elements.module.css';

export default function CameraCard({ element }: ElementProps) {
  const rawId = element.options?.entityId;
  const entityId = typeof rawId === 'string' ? rawId : '';
  const entity = useEntity(entityId).value;
  const [open, setOpen] = useState(false);

  if (!entityId || !entity) {
    return (
      <div class={`${styles.card} ${styles.cardDead}`}>
        <span class={styles.state}>{entityId ? 'Unavailable' : 'No camera selected'}</span>
        {entityId && <span class={styles.name}>{entityId}</span>}
      </div>
    );
  }

  return (
    <>
      <CameraTile entity={entity} staggerMs={0} onOpen={() => setOpen(true)} />
      {open && <StreamModal entity={entity} onClose={() => setOpen(false)} />}
    </>
  );
}
