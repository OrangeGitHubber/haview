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
    optionsLoader: () => import('../elements/EntityOptionsEditor'),
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
  },
  media: {
    type: 'media',
    title: 'Media player',
    load: () => import('../elements/MediaCard'),
    optionsLoader: () => import('../elements/MediaOptionsEditor'),
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 2, h: 2 },
  },
  camera: {
    type: 'camera',
    title: 'Cameras',
    load: () => import('../elements/CameraCard'),
    optionsLoader: () => import('../elements/CameraOptionsEditor'),
    defaultSize: { w: 10, h: 8 },
    minSize: { w: 3, h: 3 },
  },
  clock: {
    type: 'clock',
    title: 'Clock',
    load: () => import('../elements/ClockCard'),
    optionsLoader: () => import('../elements/ClockOptionsEditor'),
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
  },
  weather: {
    type: 'weather',
    title: 'Weather',
    load: () => import('../views/main/weather/WeatherWidget'),
    optionsLoader: () => import('../elements/WeatherOptionsEditor'),
    defaultSize: { w: 12, h: 6 },
    minSize: { w: 8, h: 6 },
  },
  alerts: {
    type: 'alerts',
    title: 'Alert ribbon',
    load: () => import('../elements/AlertRibbon'),
    optionsLoader: () => import('../elements/AlertRibbonOptionsEditor'),
    defaultSize: { w: 24, h: 4 },
    minSize: { w: 4, h: 2 },
  },
  graph: {
    type: 'graph',
    title: 'History graph',
    load: () => import('../elements/GraphCard'),
    optionsLoader: () => import('../elements/GraphOptionsEditor'),
    defaultSize: { w: 8, h: 6 },
    // low floor so the compact tile layout can be made small
    minSize: { w: 3, h: 2 },
  },
  presence: {
    type: 'presence',
    title: 'Family presence',
    load: () => import('../views/main/presence/PresenceWidget'),
    optionsLoader: () => import('../views/main/presence/PresenceOptionsEditor'),
    defaultSize: { w: 12, h: 6 },
    minSize: { w: 4, h: 4 },
  },
  calendar: {
    type: 'calendar',
    title: 'Calendar',
    load: () => import('../views/main/WeekCalendar').then((m) => ({ default: m.WeekCalendar })),
    optionsLoader: () => import('../views/main/CalendarOptionsEditor'),
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 2, h: 4 },
  },
};
