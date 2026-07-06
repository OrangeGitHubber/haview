import { useState } from 'preact/hooks';
import type { HassEntity } from '../lib/types';
import { useEntity } from '../lib/ha/entities';
import { callSvc } from '../lib/ha/service';
import { hasExtraControls } from './lightCaps';
import { EntityDetailsModal } from './EntityDetailsModal';
import type { ElementProps } from '../grid/elements';
import styles from './elements.module.css';

/** Card glyphs (24x24 Material paths). */
const GLYPHS: Record<string, string> = {
  light:
    'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
  switch:
    'M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.41L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z',
  scene:
    'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  script: 'M8 5v14l11-7z',
  media_player:
    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  climate:
    'M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2V5z',
};
GLYPHS.input_boolean = GLYPHS.switch;
GLYPHS.button = GLYPHS.switch;

const CHEVRON = 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z';

const TOGGLE_DOMAINS = new Set(['light', 'switch', 'input_boolean']);
const ACTIVATE: Record<string, [string, string]> = {
  scene: ['scene', 'turn_on'],
  script: ['script', 'turn_on'],
  button: ['button', 'press'],
};

export function friendlyName(entity: HassEntity): string {
  const n = entity.attributes.friendly_name;
  return typeof n === 'string' && n ? n : entity.entity_id;
}

function stateText(entity: HassEntity): string {
  const { state } = entity;
  if (state === 'unavailable') return 'Unavailable';
  if (state === 'unknown') return '—';
  const unit = entity.attributes.unit_of_measurement;
  if (typeof unit === 'string' && unit) return `${state} ${unit}`;
  if (state === 'on') return 'On';
  if (state === 'off') return 'Off';
  return state.replace(/_/g, ' ');
}

export default function EntityCard({ element }: ElementProps) {
  const rawId = element.options?.entityId;
  const entityId = typeof rawId === 'string' ? rawId : '';
  const entity = useEntity(entityId).value;
  const [details, setDetails] = useState(false);
  const [flash, setFlash] = useState(false);

  if (!entityId || !entity) {
    return (
      <div class={`${styles.card} ${styles.cardDead}`}>
        <span class={styles.state}>{entityId ? 'Unavailable' : 'No entity selected'}</span>
        {entityId && <span class={styles.name}>{entityId}</span>}
      </div>
    );
  }

  const domain = entityId.split('.')[0];
  const unavailable = entity.state === 'unavailable';
  const isOn = entity.state === 'on';
  const name = friendlyName(entity);
  const glyph = GLYPHS[domain];

  const hasDetails =
    domain === 'climate' ||
    domain === 'media_player' ||
    (domain === 'light' && hasExtraControls(entity));

  let onTap: (() => void) | null = null;
  if (!unavailable) {
    if (TOGGLE_DOMAINS.has(domain)) {
      onTap = () => callSvc('homeassistant', 'toggle', undefined, { entity_id: entityId });
    } else if (ACTIVATE[domain]) {
      const [d, s] = ACTIVATE[domain];
      onTap = () => {
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
        callSvc(d, s, undefined, { entity_id: entityId });
      };
    } else if (hasDetails) {
      onTap = () => setDetails(true);
    }
  }

  const cls = [
    styles.card,
    onTap ? styles.tappable : '',
    isOn && TOGGLE_DOMAINS.has(domain) ? styles.active : '',
    unavailable ? styles.cardDead : '',
    flash ? styles.flash : '',
  ]
    .filter(Boolean)
    .join(' ');

  // climate: show current temp big, target small
  let mainText = stateText(entity);
  let subText: string | null = null;
  if (domain === 'climate') {
    const cur = entity.attributes.current_temperature;
    const target = entity.attributes.temperature;
    if (typeof cur === 'number') mainText = `${cur}°`;
    subText =
      (typeof target === 'number' ? `→ ${target}° · ` : '') + entity.state.replace(/_/g, ' ');
  } else if (domain === 'media_player') {
    const title = entity.attributes.media_title;
    if (typeof title === 'string' && title) {
      mainText = title;
      subText = stateText(entity);
    }
  } else if (domain === 'light' && isOn) {
    const b = entity.attributes.brightness;
    if (typeof b === 'number') mainText = `On · ${Math.round((b / 255) * 100)}%`;
  }

  // tint the bulb with the light's actual color (HA also derives rgb_color
  // for color-temp lights, so warm/cold white shows too)
  let glyphStyle: Record<string, string> | undefined;
  if (domain === 'light' && isOn) {
    const rgb = entity.attributes.rgb_color;
    if (Array.isArray(rgb) && rgb.length >= 3) {
      glyphStyle = { color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` };
    }
  }

  return (
    <>
    <div
      class={cls}
      onClick={onTap ?? undefined}
      role={onTap ? 'button' : undefined}
      aria-label={name}
    >
      <div class={styles.cardTop}>
        {glyph && (
          <svg class={styles.glyph} style={glyphStyle} viewBox="0 0 24 24" aria-hidden="true">
            <path d={glyph} fill="currentColor" />
          </svg>
        )}
        {domain === 'binary_sensor' && (
          <span class={`${styles.dot}${isOn ? ` ${styles.dotOn}` : ''}`} />
        )}
        <span class={styles.state}>{mainText}</span>
        {hasDetails && domain !== 'climate' && domain !== 'media_player' && (
          <button
            class={styles.chevron}
            onClick={(e) => {
              e.stopPropagation();
              setDetails(true);
            }}
            aria-label={`More controls: ${name}`}
          >
            <svg viewBox="0 0 24 24">
              <path d={CHEVRON} fill="currentColor" />
            </svg>
          </button>
        )}
        {domain === 'media_player' && !unavailable && (
          <button
            class={styles.chevron}
            onClick={(e) => {
              e.stopPropagation();
              callSvc('media_player', 'media_play_pause', undefined, { entity_id: entityId });
            }}
            aria-label={`Play/pause: ${name}`}
          >
            <svg viewBox="0 0 24 24">
              <path
                d={
                  entity.state === 'playing'
                    ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
                    : 'M8 5v14l11-7z'
                }
                fill="currentColor"
              />
            </svg>
          </button>
        )}
      </div>
      {subText && <span class={styles.sub}>{subText}</span>}
      <span class={styles.name}>{name}</span>
    </div>
    {/* outside the card div: its clicks must not bubble into onTap */}
    {details && <EntityDetailsModal entityId={entityId} onClose={() => setDetails(false)} />}
    </>
  );
}
