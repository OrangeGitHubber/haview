import { useEffect, useState } from 'preact/hooks';
import type { HassEntity } from 'home-assistant-js-websocket';
import { getSignedUrl } from '../../lib/ha/signedPath';
import { haBase } from '../../lib/config';
import { useEntity } from '../../lib/ha/entities';
import { PersonMapModal } from './PersonMapModal';
import styles from './people.module.css';

const CAR_ICON =
  'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z';
const HOME_ICON = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';

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
      getSignedUrl(picture, 30 * 60)
        .then((u) => alive && setUrl(u))
        .catch(() => {});
    } else if (picture.startsWith('/')) {
      setUrl(haBase() + picture);
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

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function PersonCard({
  entity,
  activityEntityId,
  geocodedEntityId,
  showAddress,
}: {
  entity: HassEntity;
  activityEntityId?: string;
  geocodedEntityId?: string;
  showAddress?: boolean;
}) {
  const name = (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
  const avatar = usePersonAvatar(entity);
  const [mapOpen, setMapOpen] = useState(false);

  const activity = activityEntityId ? useEntity(activityEntityId).value : undefined;
  const driving = activity !== undefined && DRIVING_STATES.has(activity.state.toLowerCase());
  const geocoded = geocodedEntityId ? useEntity(geocodedEntityId).value : undefined;
  const address =
    geocoded && geocoded.state !== 'unavailable' && geocoded.state !== 'unknown'
      ? geocoded.state
      : null;

  // battery comes from the companion app's battery sensor for the person's
  // active tracker (best-effort, hidden if not found)
  const source = typeof entity.attributes.source === 'string' ? entity.attributes.source : '';
  const base = source.includes('.') ? source.split('.')[1] : '';
  const sourceEntity = useEntity(source || '__none__').value;
  const battA = useEntity(base ? `sensor.${base}_battery_level` : '__none__').value;
  const battB = useEntity(base ? `sensor.${base}_battery` : '__none__').value;
  const battery =
    num(sourceEntity?.attributes.battery_level) ??
    (battA ? num(battA.state) : null) ??
    (battB ? num(battB.state) : null);
  const batteryPct = battery !== null ? Math.max(0, Math.min(100, Math.round(battery))) : null;
  const batteryClass =
    batteryPct === null
      ? ''
      : batteryPct <= 15
        ? styles.battLow
        : batteryPct <= 30
          ? styles.battMid
          : styles.battOk;

  const state = entity.state;
  const isHome = state === 'home';
  const isAway = state === 'not_home';
  const label = isHome ? 'Home' : isAway ? 'Away' : state;
  const chipClass = isHome ? styles.chipHome : isAway ? styles.chipAway : styles.chipZone;
  // only show a street address (when away + enabled); no app/integration name
  const secondary = isAway && showAddress && address ? address : null;

  return (
    <>
      <div
        class={styles.card}
        onClick={() => setMapOpen(true)}
        role="button"
        aria-label={`Show ${name} on the map`}
      >
        <div class={styles.cardMain}>
          {avatar ? (
            <img class={styles.avatar} src={avatar} alt={name} />
          ) : (
            <div class={styles.avatarFallback}>{initials(name)}</div>
          )}
          <div class={styles.info}>
            <span class={styles.name}>{name}</span>
            {driving ? (
              <span class={`${styles.chip} ${styles.chipDriving}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={CAR_ICON} fill="currentColor" />
                </svg>
                Driving
              </span>
            ) : (
              <span class={`${styles.chip} ${chipClass}`}>
                {isHome && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={HOME_ICON} fill="currentColor" />
                  </svg>
                )}
                {label}
              </span>
            )}
            {secondary && <span class={styles.device}>{secondary}</span>}
          </div>
        </div>
        {batteryPct !== null && (
          <div class={styles.battery}>
            <div class={styles.battTrack}>
              <div
                class={`${styles.battFill} ${batteryClass}`}
                style={{ width: `${batteryPct}%` }}
              />
            </div>
            <span class={styles.battPct}>{batteryPct}%</span>
          </div>
        )}
      </div>
      {mapOpen && (
        <PersonMapModal entity={entity} address={address} onClose={() => setMapOpen(false)} />
      )}
    </>
  );
}
