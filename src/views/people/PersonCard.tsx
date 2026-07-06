import { useEffect, useState } from 'preact/hooks';
import type { HassEntity } from 'home-assistant-js-websocket';
import { getSignedUrl } from '../../lib/ha/signedPath';
import { loadConfig } from '../../lib/config';
import { useEntity } from '../../lib/ha/entities';
import { minuteTick, relativeSince } from '../../lib/clock';
import styles from './people.module.css';

const CAR_ICON =
  'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z';

/** Companion-app activity states that mean "in a car". */
const DRIVING_STATES = new Set(['automotive', 'in_vehicle', 'driving', 'auto']);

function usePersonAvatar(entity: HassEntity): string | null {
  const picture = entity.attributes.entity_picture as string | undefined;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!picture) return;
    if (picture.startsWith('/api/')) {
      // authenticated path — needs a signed URL
      getSignedUrl(picture, 30 * 60)
        .then((u) => alive && setUrl(u))
        .catch(() => {});
    } else if (picture.startsWith('/')) {
      const cfg = loadConfig();
      if (cfg) setUrl(cfg.hassUrl + picture);
    } else {
      setUrl(picture);
    }
    return () => {
      alive = false;
    };
  }, [picture]);

  return url;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function PersonCard({
  entity,
  activityEntityId,
}: {
  entity: HassEntity;
  activityEntityId?: string;
}) {
  const name = (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
  const avatar = usePersonAvatar(entity);
  const now = minuteTick.value;
  const activity = activityEntityId ? useEntity(activityEntityId).value : undefined;
  const driving = activity !== undefined && DRIVING_STATES.has(activity.state.toLowerCase());

  const state = entity.state;
  const isHome = state === 'home';
  const isAway = state === 'not_home';
  // any other state is the name of the zone the person is in
  const label = isHome ? 'Home' : isAway ? 'Away' : state;
  const chipClass = isHome ? styles.chipHome : isAway ? styles.chipAway : styles.chipZone;

  return (
    <div class={styles.card}>
      {avatar ? (
        <img class={styles.avatar} src={avatar} alt={name} />
      ) : (
        <div class={styles.avatarFallback}>{initials(name)}</div>
      )}
      <div class={styles.info}>
        <span class={styles.name}>{name}</span>
        <span class={styles.since}>{relativeSince(entity.last_changed, now)}</span>
      </div>
      {driving ? (
        <span class={`${styles.chip} ${styles.chipDriving}`} title={`Driving · ${label}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={CAR_ICON} fill="currentColor" />
          </svg>
          Driving
        </span>
      ) : (
        <span class={`${styles.chip} ${chipClass}`}>{label}</span>
      )}
    </div>
  );
}
