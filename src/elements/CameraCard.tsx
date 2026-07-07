import { useState } from 'preact/hooks';
import type { HassEntity } from '../lib/types';
import { useEntity } from '../lib/ha/entities';
import { CameraTile } from '../views/cameras/CameraTile';
import { StreamModal } from '../views/cameras/StreamModal';
import type { ElementProps } from '../grid/elements';
import styles from '../views/cameras/cameras.module.css';

export interface CamerasOptions {
  title?: string;
  /** camera entity_ids shown in this container */
  cameras?: string[];
  /** fixed column count; 0/undefined = auto-fit to width */
  columns?: number;
}

/** cameras list, with back-compat for the old single-camera element */
export function cameraIds(o: CamerasOptions): string[] {
  if (Array.isArray(o.cameras) && o.cameras.length > 0) return o.cameras;
  const legacy = (o as { entityId?: unknown }).entityId;
  return typeof legacy === 'string' && legacy ? [legacy] : [];
}

function Tile({
  id,
  stagger,
  onOpen,
}: {
  id: string;
  stagger: number;
  onOpen: (e: HassEntity) => void;
}) {
  const entity = useEntity(id).value;
  if (!entity) return <div class={styles.camUnavail}>{id}</div>;
  return <CameraTile entity={entity} staggerMs={stagger} onOpen={() => onOpen(entity)} />;
}

/** A container card holding one or more live camera tiles (like presence). */
export default function CameraCard({ element }: ElementProps) {
  const o = (element.options ?? {}) as CamerasOptions;
  const ids = cameraIds(o);
  const [open, setOpen] = useState<HassEntity | null>(null);
  const colStyle =
    typeof o.columns === 'number' && o.columns > 0
      ? { gridTemplateColumns: `repeat(${o.columns}, minmax(0, 1fr))` }
      : undefined;

  return (
    <div class={styles.container}>
      <h2 class={`${styles.containerTitle} card-title`}>{o.title?.trim() || 'Cameras'}</h2>
      {ids.length === 0 ? (
        <span class={styles.camHint}>No cameras yet — tap this card in page edit mode.</span>
      ) : (
        <div class={styles.camGrid} style={colStyle}>
          {ids.map((id, i) => (
            <Tile key={id} id={id} stagger={Math.round((i * 10_000) / ids.length)} onOpen={setOpen} />
          ))}
        </div>
      )}
      {open && <StreamModal entity={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
