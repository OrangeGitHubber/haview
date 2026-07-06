import type { FunctionComponent } from 'preact';
import type { GridElement } from './types';

/**
 * Element types placeable on a grid page. Loaders MUST be module-level
 * constants (AsyncView caches on loader identity). Widget components take no
 * props and read settings signals directly; the entity card reads
 * element.options.entityId — hence FunctionComponent<any>.
 */

// <any>: heterogeneous element props, see above
type AnyComponent = FunctionComponent<any>;

export interface ElementProps {
  pageId: string;
  element: GridElement;
  editing: boolean;
}

export interface ElementDef {
  type: string;
  /** label in the Add dialog and unknown-type fallback */
  title: string;
  load: () => Promise<{ default: AnyComponent }>;
  /**
   * Optional per-instance options editor, shown via a gear badge in page
   * edit mode. Receives { pageId, element, onClose } and renders a Modal.
   */
  optionsLoader?: () => Promise<{ default: AnyComponent }>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

export const elementDefs: Record<string, ElementDef> = {
  entity: {
    type: 'entity',
    title: 'Entity card',
    load: () => import('../elements/EntityCard'),
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
  },
  weather: {
    type: 'weather',
    title: 'Weather',
    load: () => import('../views/main/weather/WeatherWidget'),
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
  },
  presence: {
    type: 'presence',
    title: 'Family presence',
    load: () => import('../views/main/presence/PresenceWidget'),
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
  },
  calendar: {
    type: 'calendar',
    title: 'Calendar',
    load: () => import('../views/main/WeekCalendar').then((m) => ({ default: m.WeekCalendar })),
    optionsLoader: () => import('../views/main/CalendarOptionsEditor'),
    defaultSize: { w: 12, h: 4 },
    minSize: { w: 3, h: 3 },
  },
};
