import { useState } from 'preact/hooks';
import { useCalendarEvents, calendarColor } from './useCalendarEvents';
import { settings } from '../../lib/settings';
import { pageIcons } from '../../lib/icons';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useElementSize } from '../../lib/useElementSize';
import { fontScaleOf } from '../../lib/fontSizePresets';
import { ClampedList } from '../../components/ClampedList';
import type { CalendarEvent } from '../../lib/types';
import type { ElementProps } from '../../grid/elements';
import styles from './main.module.css';

/** Discrete size preset for day columns and agenda entries — see
    weatherBucket() in WeatherWidget.tsx for the full rationale. Unlike
    weather, day/agenda text was always sized off width alone (the old
    cqi-only formulas never had a cqb term — ClampedList already handles the
    height-fitting problem by clipping/paging, so font-size never needed to
    react to height here), so this only takes one dimension. That also means
    the same bucket function works for both the horizontal week-grid (each
    column ~158px+) and the stacked/vertical layout (each day spans the full
    widget width) — it's just measuring real pixels now instead of a cqi
    ratio, so a wide stacked day naturally lands in a bigger bucket without
    needing a separate "gentler" ratio the way the old formula did. */
export type DayBucket = 'xs' | 'sm' | 'md' | 'lg';

export function dayBucket(width: number): DayBucket {
  if (width < 180) return 'xs';
  if (width < 260) return 'sm';
  if (width < 360) return 'md';
  return 'lg';
}

/** verified with a live harness at each bucket's own worst-case width (a
    159px day column with the longest weekday name, "Wednesday") — the user
    scales these with the Text size knob (element.options.fontScale), same
    reasoning as weather's DEFAULT_WEATHER_FONT_SIZES. */
export const DEFAULT_DAY_FONT_SIZES: Record<DayBucket, number> = {
  xs: 15,
  sm: 19,
  md: 24,
  lg: 30,
};
/** smaller than DEFAULT_DAY_FONT_SIZES at the same bucket name — an agenda
    entry is a single wide row, not a narrow stacked column, so it can
    afford more text per em without wrapping as aggressively. */
export const DEFAULT_AGENDA_FONT_SIZES: Record<DayBucket, number> = {
  xs: 14,
  sm: 17,
  md: 19,
  lg: 23,
};

/**
 * Calendar element. Each placed instance has its own options
 * (element.options), edited via the gear badge in page edit mode:
 *   title      header text (default depends on mode)
 *   mode       'week' (day board) | 'agenda' (next N entries)
 *   days       week mode: number of day columns (default 7)
 *   vertical   week mode: stack days vertically instead of columns
 *   count      agenda mode: how many upcoming entries (default 5)
 *   calendars  undefined = follow the global Settings selection,
 *              null = all calendars, string[] = exactly these
 */
export interface CalendarOptions {
  title?: string;
  /** icon name from src/lib/icons.ts, shown before the title */
  icon?: string;
  mode?: 'week' | 'agenda';
  days?: number;
  vertical?: boolean;
  count?: number;
  calendars?: string[] | null;
  /** show the "updated Xm ago" hint (default true) */
  showUpdated?: boolean;
  /** legacy: false hid the color dot (superseded by marker) */
  showDots?: boolean;
  /** per-entry calendar-color marker: hidden, a dot, or a left bar */
  marker?: 'hide' | 'dot' | 'bar';
  /** agenda mode: draw a surrounding card surface (uses card opacity).
      Off by default so the entries use the full space. */
  agendaCard?: boolean;
  /** agenda mode: stretch entries to fill the card height with even gaps
      between them. Off by default (entries cluster together with a
      consistent gap) — "fill" looks stretched/gappy on a tall widget with
      few entries, but some may still prefer it for short lists. */
  agendaFill?: boolean;
  /** text-size multiplier (percent, 50–200; 100 = default) applied to the
      auto-fitted day-column / agenda-entry sizes */
  fontScale?: number;
}

export type EntryMarker = 'hide' | 'dot' | 'bar';

// fontScale is read separately in WeekCalendar (applied as a multiplier to
// the bucket defaults), not resolved to a single value here like the rest
export function calendarOptionsOf(
  element: ElementProps['element'],
): Required<Omit<CalendarOptions, 'fontScale'>> {
  const o = (element.options ?? {}) as CalendarOptions;
  const mode = o.mode === 'agenda' ? 'agenda' : 'week';
  return {
    mode,
    icon: typeof o.icon === 'string' ? o.icon : '',
    title:
      typeof o.title === 'string' && o.title.trim()
        ? o.title
        : mode === 'agenda'
          ? 'Upcoming'
          : 'This week',
    days: typeof o.days === 'number' ? Math.min(Math.max(Math.round(o.days), 1), 14) : 7,
    vertical: o.vertical === true,
    count: typeof o.count === 'number' ? Math.min(Math.max(Math.round(o.count), 1), 20) : 5,
    calendars: o.calendars !== undefined ? o.calendars : settings.value.calendars.selected,
    showUpdated: o.showUpdated !== false,
    showDots: o.showDots !== false,
    // marker wins; else derive from the legacy showDots flag
    marker: (o.marker ?? (o.showDots === false ? 'hide' : 'dot')) as EntryMarker,
    agendaCard: o.agendaCard === true,
    agendaFill: o.agendaFill === true,
  };
}

/** Fetch window for agenda mode — far enough out for sparse calendars
    (public holidays), still one cheap REST query per calendar. */
const AGENDA_WINDOW_DAYS = 365;

interface Day {
  start: Date;
  end: Date;
  isToday: boolean;
  weekday: string;
  dateLabel: string;
  events: CalendarEvent[];
}

function buildDays(events: CalendarEvent[], count: number): Day[] {
  const days: Day[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const start = new Date(today.getTime());
    start.setDate(start.getDate() + i);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);
    const dayEvents = events
      .filter((ev) => ev.start < end && ev.end > start)
      .sort((a, b) =>
        a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.start.getTime() - b.start.getTime(),
      );
    days.push({
      start,
      end,
      isToday: i === 0,
      weekday:
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : start.toLocaleDateString(undefined, { weekday: 'long' }),
      dateLabel: start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      events: dayEvents,
    });
  }
  return days;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeLabel(ev: CalendarEvent, day: Day): string {
  if (ev.allDay) return 'All day';
  const from = ev.start < day.start ? '…' : fmtTime(ev.start); // continues from a previous day
  const to = ev.end > day.end ? '…' : fmtTime(ev.end); // continues into the next day
  return `${from} – ${to}`;
}

function agendaDateLabel(ev: CalendarEvent): string {
  const label = ev.start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (ev.allDay) return label;
  return `${label} · ${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
}

function agoLabel(lastFetched: number): string {
  const m = Math.floor((Date.now() - lastFetched) / 60_000);
  return m <= 0 ? 'just now' : `${m}m ago`;
}

export function WeekCalendar({ element }: ElementProps) {
  const opt = calendarOptionsOf(element);
  const scale = fontScaleOf((element.options as CalendarOptions | undefined)?.fontScale);
  const windowDays = opt.mode === 'agenda' ? AGENDA_WINDOW_DAYS : opt.days;
  const { events, loading, error, lastFetched, refresh } = useCalendarEvents(
    windowDays,
    opt.calendars,
  );
  // phones: stack the day board vertically and collapse all but today
  const narrow = useMediaQuery('(max-width: 699px)');

  return (
    <section
      class={`${styles.week}${
        opt.mode === 'agenda' && opt.agendaCard ? ` ${styles.weekAgendaCard}` : ''
      }`}
    >
      <header class={styles.weekHeader}>
        <h2 class={`${styles.weekTitle} card-title`}>
          {opt.icon && pageIcons[opt.icon] && (
            <svg class={styles.weekIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path d={pageIcons[opt.icon]} fill="currentColor" />
            </svg>
          )}
          {opt.title}
        </h2>
        <div class={styles.weekTools}>
          {error && lastFetched !== null && <span class={styles.offline}>offline</span>}
          {opt.showUpdated && lastFetched !== null && (
            <span class={styles.updated}>updated {agoLabel(lastFetched)}</span>
          )}
        </div>
      </header>

      {error && events.length === 0 && !loading ? (
        <div class={styles.weekError}>
          {error.isLikelyCors
            ? `Could not reach Home Assistant through the dashboard server. Check Settings → Connection and that HA is reachable from the container.`
            : `Could not load calendars (${error.message}).`}{' '}
          <button onClick={refresh}>Retry</button>
        </div>
      ) : opt.mode === 'agenda' ? (
        <AgendaList
          events={events}
          count={opt.count}
          loading={loading}
          marker={opt.marker}
          fill={opt.agendaFill}
          scale={scale}
        />
      ) : (
        <WeekBoard
          events={events}
          days={opt.days}
          vertical={opt.vertical}
          loading={loading}
          marker={opt.marker}
          narrow={narrow}
          scale={scale}
        />
      )}
    </section>
  );
}

function eventProps(marker: EntryMarker, id: string) {
  if (marker === 'bar') {
    return {
      class: `${styles.event} ${styles.eventBarred}`,
      style: { borderLeftColor: calendarColor(id) },
    };
  }
  return { class: styles.event, style: undefined };
}

function WeekBoard({
  events,
  days,
  vertical,
  loading,
  marker,
  narrow,
  scale,
}: {
  events: CalendarEvent[];
  days: number;
  vertical: boolean;
  loading: boolean;
  marker: EntryMarker;
  narrow: boolean;
  scale: number;
}) {
  const board = buildDays(events, days);
  const stacked = vertical || narrow;
  const collapsible = narrow; // on phones, every day (incl. today) collapses
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const toggle = (t: number) => setExpandedDay((prev) => (prev === t ? null : t));

  // one measurement for the whole grid — every day column shares the same
  // width (equal 1fr columns in grid mode, full width in stacked mode), so
  // there's no need to measure each day separately
  const { ref: gridRef, size: gridSize } = useElementSize<HTMLDivElement>();
  const GRID_GAP = 8;
  const perDayWidth = stacked
    ? gridSize.width
    : days > 0
      ? (gridSize.width - GRID_GAP * (days - 1)) / days
      : gridSize.width;
  const bucket = dayBucket(perDayWidth);
  const fontPx = Math.round(DEFAULT_DAY_FONT_SIZES[bucket] * scale);
  const dayStyle = { fontSize: `calc(${fontPx}px * var(--ui-scale, 1))` };

  const dayEventItems = (day: Day) =>
    day.events.map((ev, i) => (
      <div key={i} title={ev.calendarName} {...eventProps(marker, ev.calendarId)}>
        {marker === 'dot' && (
          <span class={styles.eventDot} style={{ background: calendarColor(ev.calendarId) }} />
        )}
        <div class={styles.eventText}>
          <span class={styles.eventTime}>{timeLabel(ev, day)}</span>
          <span class={styles.eventSummary}>{ev.summary}</span>
        </div>
      </div>
    ));

  // stacked + collapsible (phones): row height must follow each day's own
  // content instead of the CSS default (grid-auto-rows: 1fr, all rows
  // equal) — an accordion needs UNEQUAL rows by definition, otherwise a
  // collapsed day still stretches to match the open one's row height and
  // renders as an empty box instead of a compact header. Collapsed days get
  // 'auto' (shrink to just their header); the one open day gets '1fr' (fill
  // whatever's left), which also gives its ClampedList a real bounded
  // height to clamp/paginate against instead of growing unbounded.
  const gridStyle = stacked
    ? collapsible
      ? {
          gridTemplateRows: board
            .map((day) => (day.start.getTime() === expandedDay ? '1fr' : 'auto'))
            .join(' '),
        }
      : undefined
    : { gridTemplateColumns: `repeat(${days}, minmax(158px, 1fr))` };

  return (
    <div class={stacked ? styles.weekStack : styles.weekScroll}>
      <div
        ref={gridRef}
        class={stacked ? styles.weekGridV : styles.weekGrid}
        style={gridStyle}
      >
        {board.map((day) => {
          const t = day.start.getTime();
          const collapse = collapsible;
          const open = !collapse || expandedDay === t;
          const showSkeleton = loading && events.length === 0;
          return (
            <div
              key={t}
              class={`${styles.day}${day.isToday ? ` ${styles.today}` : ''}`}
              data-bucket={bucket}
              style={dayStyle}
            >
              <header
                class={`${styles.dayHeader}${collapse ? ` ${styles.dayHeaderTap}` : ''}`}
                onClick={collapse ? () => toggle(t) : undefined}
              >
                <span class={styles.dayName}>{day.weekday}</span>
                <span class={styles.dayDate}>
                  {collapse && !open && day.events.length > 0 ? `${day.events.length} · ` : ''}
                  {day.dateLabel}
                  {collapse ? (open ? ' ▾' : ' ▸') : ''}
                </span>
              </header>
              {open &&
                (showSkeleton ? (
                  <div class={styles.dayEvents}>
                    <div class={styles.eventSkeleton} />
                    <div class={styles.eventSkeleton} />
                  </div>
                ) : (
                  <ClampedList
                    class={styles.dayEvents}
                    pillClass={styles.morePill}
                    items={dayEventItems(day)}
                    moreLabel={(n) => `+${n} more`}
                    fewerLabel="Show fewer ▲"
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  events,
  count,
  loading,
  marker,
  fill,
  scale,
}: {
  events: CalendarEvent[];
  count: number;
  loading: boolean;
  marker: EntryMarker;
  fill: boolean;
  scale: number;
}) {
  const now = new Date();
  const upcoming = events.filter((ev) => ev.end > now).slice(0, count);
  const agendaClass = `${styles.agenda}${fill ? ` ${styles.agendaFill}` : ''}`;
  const [width, setWidth] = useState(0);
  const bucket = dayBucket(width);
  const fontPx = Math.round(DEFAULT_AGENDA_FONT_SIZES[bucket] * scale);
  const agendaStyle = { fontSize: `calc(${fontPx}px * var(--ui-scale, 1))` };

  if (loading && events.length === 0) {
    return (
      <div class={agendaClass} data-bucket={bucket} style={agendaStyle}>
        <div class={styles.eventSkeleton} />
        <div class={styles.eventSkeleton} />
        <div class={styles.eventSkeleton} />
      </div>
    );
  }
  if (upcoming.length === 0) {
    return (
      <div class={agendaClass} data-bucket={bucket} style={agendaStyle}>
        <p class={styles.agendaEmpty}>No upcoming entries.</p>
      </div>
    );
  }

  return (
    <ClampedList
      class={agendaClass}
      pillClass={styles.morePill}
      bucket={bucket}
      style={agendaStyle}
      onResize={(w) => setWidth(w)}
      items={upcoming.map((ev, i) => (
        <div key={i} title={ev.calendarName} {...eventProps(marker, ev.calendarId)}>
          {marker === 'dot' && (
            <span class={styles.eventDot} style={{ background: calendarColor(ev.calendarId) }} />
          )}
          <div class={styles.eventText}>
            <span class={styles.eventTime}>{agendaDateLabel(ev)}</span>
            <span class={styles.eventSummary}>{ev.summary}</span>
          </div>
        </div>
      ))}
      moreLabel={(n) => `+${n} more`}
      fewerLabel="Show fewer ▲"
    />
  );
}
