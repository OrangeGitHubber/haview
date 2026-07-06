import { useEntitiesByDomain } from '../../../lib/ha/entities';
import { settings } from '../../../lib/settings';
import { navigate } from '../../../lib/router';
import { PersonCard } from '../../people/PersonCard';
import type { ElementProps } from '../../../grid/elements';
import styles from './presence.module.css';

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
}

export default function PresenceWidget({ element }: ElementProps) {
  const o = (element.options ?? {}) as PresenceOptions;
  const people = useEntitiesByDomain('person').value;
  const ids = o.persons !== undefined ? o.persons : settings.value.presence.personIds;
  const shown = ids === null ? people : people.filter((p) => ids.includes(p.entity_id));
  const home = shown.filter((p) => p.state === 'home').length;

  return (
    <div class={styles.card}>
      <h2 class={styles.title}>
        Family
        {shown.length > 0 && (
          <span class={styles.count}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
