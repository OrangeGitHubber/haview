import { useState } from 'preact/hooks';
import { useCalendarEvents, calendarColor } from './useCalendarEvents';
import { settings } from '../../lib/settings';
import { pageIcons } from '../../lib/icons';
import { useMediaQuery } from '../../lib/useMediaQuery';
import type { CalendarEvent } from '../../lib/types';
import type { ElementProps } from '../../grid/elements';
import styles from './main.module.css';

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
}

export type EntryMarker = 'hide' | 'dot' | 'bar';

export function calendarOptionsOf(element: ElementProps['element']): Required<CalendarOptions> {
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
  const windowDays = opt.mode === 'agenda' ? AGENDA_WINDOW_DAYS : opt.days;
  const { events, loading, error, lastFetched, refresh } = useCalendarEvents(
    windowDays,
    opt.calendars,
  );
  // phones: stack the day board vertically and collapse all but today
  const narrow = useMediaQuery('(max-width: 699px)');

  return (
    <section class={styles.week}>
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
        <AgendaList events={events} count={opt.count} loading={loading} marker={opt.marker} />
      ) : (
        <WeekBoard
          events={events}
          days={opt.days}
          vertical={opt.vertical}
          loading={loading}
          marker={opt.marker}
          narrow={narrow}
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
}: {
  events: CalendarEvent[];
  days: number;
  vertical: boolean;
  loading: boolean;
  marker: EntryMarker;
  narrow: boolean;
}) {
  const board = buildDays(events, days);
  const stacked = vertical || narrow;
  const collapsible = narrow; // on phones, collapse every day except today
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const toggle = (t: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const dayEvents = (day: Day) =>
    loading && events.length === 0 ? (
      <>
        <div class={styles.eventSkeleton} />
        <div class={styles.eventSkeleton} />
      </>
    ) : (
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
      ))
    );

  return (
    <div class={stacked ? '' : styles.weekScroll}>
      <div
        class={stacked ? styles.weekGridV : styles.weekGrid}
        style={stacked ? undefined : { gridTemplateColumns: `repeat(${days}, minmax(158px, 1fr))` }}
      >
        {board.map((day) => {
          const t = day.start.getTime();
          const collapse = collapsible && !day.isToday;
          const open = !collapse || expanded.has(t);
          return (
            <div key={t} class={`${styles.day}${day.isToday ? ` ${styles.today}` : ''}`}>
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
              {open && <div class={styles.dayEvents}>{dayEvents(day)}</div>}
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
}: {
  events: CalendarEvent[];
  count: number;
  loading: boolean;
  marker: EntryMarker;
}) {
  const now = new Date();
  const upcoming = events.filter((ev) => ev.end > now).slice(0, count);
  return (
    <div class={styles.agenda}>
      {loading && events.length === 0 && (
        <>
          <div class={styles.eventSkeleton} />
          <div class={styles.eventSkeleton} />
          <div class={styles.eventSkeleton} />
        </>
      )}
      {!loading && upcoming.length === 0 && (
        <p class={styles.agendaEmpty}>No upcoming entries.</p>
      )}
      {upcoming.map((ev, i) => (
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
    </div>
  );
}
