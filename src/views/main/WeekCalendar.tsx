import { useCalendarEvents, calendarColor } from './useCalendarEvents';
import { settings } from '../../lib/settings';
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
  mode?: 'week' | 'agenda';
  days?: number;
  vertical?: boolean;
  count?: number;
  calendars?: string[] | null;
}

export function calendarOptionsOf(element: ElementProps['element']): Required<CalendarOptions> {
  const o = (element.options ?? {}) as CalendarOptions;
  const mode = o.mode === 'agenda' ? 'agenda' : 'week';
  return {
    mode,
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

  return (
    <section class={styles.week}>
      <header class={styles.weekHeader}>
        <h2 class={styles.weekTitle}>{opt.title}</h2>
        <div class={styles.weekTools}>
          {error && lastFetched !== null && <span class={styles.offline}>offline</span>}
          {lastFetched !== null && (
            <span class={styles.updated}>updated {agoLabel(lastFetched)}</span>
          )}
        </div>
      </header>

      {error && events.length === 0 && !loading ? (
        <div class={styles.weekError}>
          {error.isLikelyCors
            ? `Could not reach the Home Assistant REST API — usually missing CORS config. Add "${location.origin}" to http: cors_allowed_origins in configuration.yaml and restart HA.`
            : `Could not load calendars (${error.message}).`}{' '}
          <button onClick={refresh}>Retry</button>
        </div>
      ) : opt.mode === 'agenda' ? (
        <AgendaList events={events} count={opt.count} loading={loading} />
      ) : (
        <WeekBoard
          events={events}
          days={opt.days}
          vertical={opt.vertical}
          loading={loading}
        />
      )}
    </section>
  );
}

function WeekBoard({
  events,
  days,
  vertical,
  loading,
}: {
  events: CalendarEvent[];
  days: number;
  vertical: boolean;
  loading: boolean;
}) {
  const board = buildDays(events, days);
  return (
    <div class={vertical ? '' : styles.weekScroll}>
      <div
        class={vertical ? styles.weekGridV : styles.weekGrid}
        style={vertical ? undefined : { gridTemplateColumns: `repeat(${days}, minmax(158px, 1fr))` }}
      >
        {board.map((day) => (
          <div
            key={day.start.getTime()}
            class={`${styles.day}${day.isToday ? ` ${styles.today}` : ''}`}
          >
            <header class={styles.dayHeader}>
              <span class={styles.dayName}>{day.weekday}</span>
              <span class={styles.dayDate}>{day.dateLabel}</span>
            </header>
            <div class={styles.dayEvents}>
              {loading && events.length === 0 ? (
                <>
                  <div class={styles.eventSkeleton} />
                  <div class={styles.eventSkeleton} />
                </>
              ) : (
                day.events.map((ev, i) => (
                  <div class={styles.event} key={i} title={ev.calendarName}>
                    <span
                      class={styles.eventDot}
                      style={{ background: calendarColor(ev.calendarId) }}
                    />
                    <div class={styles.eventText}>
                      <span class={styles.eventTime}>{timeLabel(ev, day)}</span>
                      <span class={styles.eventSummary}>{ev.summary}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaList({
  events,
  count,
  loading,
}: {
  events: CalendarEvent[];
  count: number;
  loading: boolean;
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
        <div class={styles.event} key={i} title={ev.calendarName}>
          <span class={styles.eventDot} style={{ background: calendarColor(ev.calendarId) }} />
          <div class={styles.eventText}>
            <span class={styles.eventTime}>{agendaDateLabel(ev)}</span>
            <span class={styles.eventSummary}>{ev.summary}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
