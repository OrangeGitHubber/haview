import { useEntity } from '../../../lib/ha/entities';
import { settings } from '../../../lib/settings';
import { useForecast } from './useForecast';
import { conditionIcon, conditionLabel } from './weatherIcons';
import { useElementSize } from '../../../lib/useElementSize';
import { fontScaleOf } from '../../../lib/fontSizePresets';
import type { ForecastItem } from '../../../lib/ha/forecast';
import type { ElementProps } from '../../../grid/elements';
import styles from './weather.module.css';

const SUPPORTS_DAILY = 1;
const SUPPORTS_HOURLY = 2;

/**
 * Discrete size preset instead of a continuous formula: the card stacks up
 * to four sections (title, current conditions, 7-day row, hourly row), so
 * width-only or one-shot-calibrated cqi/cqb math kept drifting out of sync
 * with what the real content actually needs at a given size (see git log —
 * two rounds of retuning a single ratio, still wrong). A handful of
 * hand-verified fixed layouts is far easier to get right: each bucket only
 * has to be correct at its own tested size, not for every possible pixel
 * combination at once. Whichever axis (width or height) is more
 * constrained picks the bucket, same reasoning as before, just discrete now
 * instead of continuous.
 */
export type WeatherBucket = 'xs' | 'sm' | 'md' | 'lg';

// thresholds verified with a live harness against real content (see git log)
// — the first pass (480/230) was a from-hand estimate that turned out far
// too conservative: a 6-grid-row-tall card (228px) was landing in xs and
// permanently dropping the hourly row, when the actual minimum height for
// it to fit at sm's font is ~180px. Width was similarly overestimated —
// hourly/daily rows redistribute across whatever width they get (no
// wrapping) rather than needing a wide box, so the true constraint is just
// .current's icon+temp+details row wrapping to two lines below ~280px.
export function weatherBucket(width: number, height: number): WeatherBucket {
  const widthRank = width < 320 ? 0 : width < 720 ? 1 : width < 960 ? 2 : 3;
  const heightRank = height < 185 ? 0 : height < 320 ? 1 : height < 420 ? 2 : 3;
  const rank = Math.min(widthRank, heightRank);
  return (['xs', 'sm', 'md', 'lg'] as const)[rank];
}

/** the largest px value that still fits each bucket's own worst-case
    (smallest) size, verified with a live harness — see weatherBucket()'s
    thresholds above. The user scales these together via the Text size knob
    (element.options.fontScale); the calibrated defaults stay the 100% base so
    a widget resized smaller can't clip. */
export const DEFAULT_WEATHER_FONT_SIZES: Record<WeatherBucket, number> = {
  xs: 12,
  sm: 11,
  md: 15,
  lg: 20,
};

function fmt(n: number | undefined, digits = 0): string {
  return n === undefined || n === null || isNaN(n) ? '–' : n.toFixed(digits);
}

function hourLabel(item: ForecastItem): string {
  const d = new Date(item.datetime);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric' });
}

function dayLabel(item: ForecastItem, index: number): string {
  if (index === 0) return 'Today';
  const d = new Date(item.datetime);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'short' });
}

export default function WeatherWidget({ element }: ElementProps) {
  // per-instance entity, falling back to the legacy global setting
  const own = element.options?.entityId;
  const entityId =
    typeof own === 'string' && own ? own : settings.value.weather.entityId;
  const rawDays = element.options?.forecastDays;
  const forecastDays =
    typeof rawDays === 'number' && Number.isFinite(rawDays)
      ? Math.min(Math.max(Math.round(rawDays), 1), 7)
      : 5;
  const entitySig = useEntity(entityId ?? '__none__');
  const entity = entityId ? entitySig.value : undefined;

  const features = (entity?.attributes.supported_features as number | undefined) ?? 0;
  const available = !!entity && entity.state !== 'unavailable';
  const { forecast: daily } = useForecast(
    entityId,
    'daily',
    available && (features & SUPPORTS_DAILY) !== 0,
  );
  const { forecast: hourly } = useForecast(
    entityId,
    'hourly',
    available && (features & SUPPORTS_HOURLY) !== 0,
  );
  const { ref, size } = useElementSize<HTMLDivElement>();
  const bucket = weatherBucket(size.width, size.height);

  const fontPx = Math.round(DEFAULT_WEATHER_FONT_SIZES[bucket] * fontScaleOf(element.options?.fontScale));
  const cardStyle = { fontSize: `calc(${fontPx}px * var(--ui-scale, 1))` };

  // xs is tight enough that even the smallest readable text can't fit all
  // three sections (see the calibration notes in weather.module.css) — drop
  // the hourly row rather than clip it mid-row. User-configurable in case a
  // custom (larger) xs font size actually does have room for it.
  const rawDropHourly = element.options?.dropHourlyAtXs;
  const dropHourlyAtXs = typeof rawDropHourly === 'boolean' ? rawDropHourly : true;
  const showHourly = bucket !== 'xs' || !dropHourlyAtXs;

  if (!entityId) {
    return (
      <div class={styles.card} ref={ref} data-bucket={bucket} style={cardStyle}>
        <h2 class={`${styles.title} card-title`}>Weather</h2>
        <div class={styles.hint}>
          <p>No weather entity selected — tap this card in page edit mode to pick one.</p>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div class={styles.card} ref={ref} data-bucket={bucket} style={cardStyle}>
        <h2 class={`${styles.title} card-title`}>Weather</h2>
        <p class={styles.hintText}>
          Entity <code>{entityId}</code> was not found in Home Assistant.
        </p>
      </div>
    );
  }

  const a = entity.attributes;
  const unit = (a.temperature_unit as string | undefined) ?? '°';
  const windUnit = (a.wind_speed_unit as string | undefined) ?? '';

  return (
    <div class={styles.card} ref={ref} data-bucket={bucket} style={cardStyle}>
      <h2 class={`${styles.title} card-title`}>Weather</h2>

      <div class={styles.current}>
        <div class={styles.currentIcon}>{conditionIcon(entity.state, 54)}</div>
        <div class={styles.currentMain}>
          <span class={styles.temp}>
            {fmt(a.temperature as number | undefined)}
            <span class={styles.tempUnit}>{unit}</span>
          </span>
          <span class={styles.condition}>
            {a.apparent_temperature !== undefined &&
              `Feels like ${fmt(a.apparent_temperature as number)}${unit} · `}
            {conditionLabel(entity.state)}
          </span>
        </div>
        <dl class={styles.details}>
          {a.humidity !== undefined && (
            <div>
              <dt>Humidity</dt>
              <dd>{fmt(a.humidity as number)}%</dd>
            </div>
          )}
          {a.wind_speed !== undefined && (
            <div>
              <dt>Wind</dt>
              <dd>
                {fmt(a.wind_speed as number)} {windUnit}
              </dd>
            </div>
          )}
          {a.pressure !== undefined && (
            <div>
              <dt>Pressure</dt>
              <dd>
                {fmt(a.pressure as number)} {(a.pressure_unit as string | undefined) ?? ''}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {daily.length > 0 && (
        <div class={styles.dailyRow}>
          {daily.slice(0, forecastDays).map((d, i) => (
            <div key={d.datetime} class={styles.dailyItem}>
              <span class={styles.dailyDay}>{dayLabel(d, i)}</span>
              {conditionIcon(d.condition, 26)}
              <span class={styles.dailyTemp}>
                {fmt(d.temperature)}°<span class={styles.dailyLow}> {fmt(d.templow)}°</span>
              </span>
              {d.precipitation_probability !== undefined && d.precipitation_probability > 0 ? (
                <span class={styles.precip}>💧{fmt(d.precipitation_probability)}%</span>
              ) : (
                <span class={styles.precip}>{' '}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showHourly && hourly.length > 0 && (
        <div class={styles.hourlyScroll}>
          <div class={styles.hourlyRow}>
            {hourly.slice(0, 12).map((h) => (
              <div key={h.datetime} class={styles.hourlyItem}>
                <span class={styles.hourlyHour}>{hourLabel(h)}</span>
                {conditionIcon(h.condition, 20)}
                <span class={styles.hourlyTemp}>{fmt(h.temperature)}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
