import { useEntitiesByDomain } from '../../../lib/ha/entities';
import { settings } from '../../../lib/settings';
import { navigate } from '../../../lib/router';
import { PersonCard } from '../../people/PersonCard';
import { useElementSize } from '../../../lib/useElementSize';
import { fontScaleOf } from '../../../lib/fontSizePresets';
import type { ElementProps } from '../../../grid/elements';
import styles from './presence.module.css';

/** Discrete size preset for the title/count header — see weatherBucket()
    in WeatherWidget.tsx for the full rationale (same discrete-preset
    philosophy instead of a continuous cqi formula). This widget's content
    is much simpler (one header line, no stacked sections), so the risk
    here is lower, but the same width-only-ignores-height blind spot still
    applied to the old formula. */
export type PresenceBucket = 'xs' | 'sm' | 'md' | 'lg';

export function presenceBucket(width: number, height: number): PresenceBucket {
  const widthRank = width < 300 ? 0 : width < 500 ? 1 : width < 800 ? 2 : 3;
  const heightRank = height < 120 ? 0 : height < 220 ? 1 : height < 360 ? 2 : 3;
  const rank = Math.min(widthRank, heightRank);
  return (['xs', 'sm', 'md', 'lg'] as const)[rank];
}

/** verified with a live harness at each bucket's own worst-case width/height
    (down to an extreme 180x60) — user-configurable via element.options,
    same reasoning as weather's DEFAULT_WEATHER_FONT_SIZES. */
export const DEFAULT_PRESENCE_TITLE_FONT_SIZES: Record<PresenceBucket, number> = {
  xs: 15,
  sm: 19,
  md: 24,
  lg: 30,
};
export const DEFAULT_PRESENCE_COUNT_FONT_SIZES: Record<PresenceBucket, number> = {
  xs: 12,
  sm: 15,
  md: 19,
  lg: 24,
};

/**
 * Per-instance options (element.options):
 *   horizontal  pack cards in a wrapping row instead of a stacked list
 *   persons     undefined = follow Settings → People, null = all,
 *               string[] = exactly these person entity ids
 *   activity    personId → activity sensor entity id (companion app's
 *               "Activity" / "Detected activity" sensor); when that sensor
 *               reports an automotive state the card shows Driving
 */
export interface PresenceOptions {
  horizontal?: boolean;
  persons?: string[] | null;
  activity?: Record<string, string>;
  /** personId → geocoded-location sensor; state is the street address */
  geocode?: Record<string, string>;
  /** show the address line when a person is away (not in a known zone) */
  showAddress?: boolean;
  /** show when each person's device last checked in */
  showLastSeen?: boolean;
  /** text-size multiplier (percent, 50–200; 100 = default) applied to the
      auto-fitted title/count sizes */
  fontScale?: number;
}

export default function PresenceWidget({ element }: ElementProps) {
  const o = (element.options ?? {}) as PresenceOptions;
  const people = useEntitiesByDomain('person').value;
  const ids = o.persons !== undefined ? o.persons : settings.value.presence.personIds;
  const shown = ids === null ? people : people.filter((p) => ids.includes(p.entity_id));
  const home = shown.filter((p) => p.state === 'home').length;
  const { ref, size } = useElementSize<HTMLDivElement>();
  const bucket = presenceBucket(size.width, size.height);
  const scale = fontScaleOf(o.fontScale);
  const titlePx = Math.round(DEFAULT_PRESENCE_TITLE_FONT_SIZES[bucket] * scale);
  const countPx = Math.round(DEFAULT_PRESENCE_COUNT_FONT_SIZES[bucket] * scale);

  return (
    <div
      class={styles.card}
      ref={ref}
      data-bucket={bucket}
      style={{ '--card-scale': String(scale) } as Record<string, string>}
    >
      <h2
        class={`${styles.title} card-title`}
        style={{ fontSize: `calc(${titlePx}px * var(--ui-scale, 1))` }}
      >
        Family
        {shown.length > 0 && (
          <span
            class={styles.count}
            style={{ fontSize: `calc(${countPx}px * var(--ui-scale, 1))` }}
          >
            {home}/{shown.length} home
          </span>
        )}
      </h2>
      {shown.length === 0 ? (
        <div class={styles.hint}>
          <p>
            {people.length === 0
              ? 'No person entities found in Home Assistant.'
              : 'No people selected for this display.'}
          </p>
          {people.length > 0 && <button onClick={() => navigate('settings')}>Open Settings</button>}
        </div>
      ) : (
        <div class={o.horizontal ? styles.listH : styles.list}>
          {shown.map((p) => (
            <PersonCard
              key={p.entity_id}
              entity={p}
              activityEntityId={o.activity?.[p.entity_id]}
              geocodedEntityId={o.geocode?.[p.entity_id]}
              showAddress={o.showAddress === true}
              showLastSeen={o.showLastSeen === true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
