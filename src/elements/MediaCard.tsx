import { useEffect, useState } from 'preact/hooks';
import type { HassEntity } from '../lib/types';
import { useEntity } from '../lib/ha/entities';
import { callSvc } from '../lib/ha/service';
import { getSignedUrl } from '../lib/ha/signedPath';
import { loadConfig } from '../lib/config';
import type { ElementProps } from '../grid/elements';
import styles from './elements.module.css';

const NOTE =
  'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z';
const PREV = 'M6 6h2v12H6zm3.5 6 8.5 6V6z';
const NEXT = 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z';
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

/** Album art / screenshot; media entity_picture URLs carry their own token. */
function useArtwork(entity: HassEntity | undefined): string | null {
  const picture = entity?.attributes.entity_picture as string | undefined;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!picture) return;
    const cfg = loadConfig();
    if (picture.includes('token=') && picture.startsWith('/') && cfg) {
      setUrl(cfg.hassUrl + picture);
    } else if (picture.startsWith('/api/')) {
      getSignedUrl(picture, 300)
        .then((u) => alive && setUrl(u))
        .catch(() => {});
    } else if (picture.startsWith('/') && cfg) {
      setUrl(cfg.hassUrl + picture);
    } else {
      setUrl(picture);
    }
    return () => {
      alive = false;
    };
  }, [picture]);

  return url;
}

export default function MediaCard({ element }: ElementProps) {
  const rawId = element.options?.entityId;
  const entityId = typeof rawId === 'string' ? rawId : '';
  const entity = useEntity(entityId).value;
  const art = useArtwork(entity);

  if (!entityId || !entity) {
    return (
      <div class={`${styles.card} ${styles.cardDead}`}>
        <span class={styles.state}>{entityId ? 'Unavailable' : 'No media player selected'}</span>
        {entityId && <span class={styles.name}>{entityId}</span>}
      </div>
    );
  }

  const name = (entity.attributes.friendly_name as string | undefined) ?? entityId;
  const title = typeof entity.attributes.media_title === 'string' ? entity.attributes.media_title : null;
  const artist =
    typeof entity.attributes.media_artist === 'string'
      ? entity.attributes.media_artist
      : typeof entity.attributes.app_name === 'string'
        ? entity.attributes.app_name
        : null;
  const vol =
    typeof entity.attributes.volume_level === 'number'
      ? Math.round(entity.attributes.volume_level * 100)
      : null;
  const playing = entity.state === 'playing';
  const idle = entity.state === 'off' || entity.state === 'standby' || entity.state === 'unavailable';

  const svc = (service: string, data?: Record<string, unknown>) =>
    callSvc('media_player', service, data, { entity_id: entityId });

  return (
    <div class={`${styles.card} ${styles.mediaCard}${idle ? ` ${styles.cardDead}` : ''}`}>
      <div class={styles.mediaTop}>
        {art ? (
          <img class={styles.mediaArt} src={art} alt="" />
        ) : (
          <div class={styles.mediaArtFallback}>
            <svg viewBox="0 0 24 24">
              <path d={NOTE} fill="currentColor" />
            </svg>
          </div>
        )}
        <div class={styles.mediaText}>
          <span class={styles.mediaTitle}>{title ?? entity.state.replace(/_/g, ' ')}</span>
          {artist && <span class={styles.mediaArtist}>{artist}</span>}
          <span class={styles.name}>{name}</span>
        </div>
      </div>
      <div class={styles.mediaControls}>
        <button class={styles.mBtn} onClick={() => svc('media_previous_track')} aria-label="Previous">
          <svg viewBox="0 0 24 24">
            <path d={PREV} fill="currentColor" />
          </svg>
        </button>
        <button
          class={`${styles.mBtn} ${styles.mBtnMain}`}
          onClick={() => svc('media_play_pause')}
          aria-label="Play/pause"
        >
          <svg viewBox="0 0 24 24">
            <path d={playing ? PAUSE : PLAY} fill="currentColor" />
          </svg>
        </button>
        <button class={styles.mBtn} onClick={() => svc('media_next_track')} aria-label="Next">
          <svg viewBox="0 0 24 24">
            <path d={NEXT} fill="currentColor" />
          </svg>
        </button>
        {vol !== null && (
          <input
            class={styles.mediaVol}
            type="range"
            min={0}
            max={100}
            value={vol}
            aria-label="Volume"
            onChange={(e) =>
              svc('volume_set', { volume_level: Number((e.target as HTMLInputElement).value) / 100 })
            }
          />
        )}
      </div>
    </div>
  );
}
