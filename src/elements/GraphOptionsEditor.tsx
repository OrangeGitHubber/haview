import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import { EntityPicker } from '../grid/EntityPicker';
import { MdiIcon } from '../components/MdiIcon';
import { CardOpacityRow, CardTitleRow } from './CardOpacityRow';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import type { GraphOptions } from './GraphCard';
import opt from '../components/options.module.css';

const WINDOWS: { hours: number; label: string }[] = [
  { hours: 3, label: '3 h' },
  { hours: 12, label: '12 h' },
  { hours: 24, label: '24 h' },
  { hours: 48, label: '2 d' },
  { hours: 168, label: '7 d' },
];

// common stat-tile icons (the mdi set HA uses)
const TILE_ICONS = [
  'mdi:chip',
  'mdi:memory',
  'mdi:wifi',
  'mdi:harddisk',
  'mdi:server-network',
  'mdi:thermometer',
  'mdi:speedometer',
  'mdi:gauge',
  'mdi:flash',
  'mdi:lightning-bolt',
  'mdi:download',
  'mdi:upload',
  'mdi:fan',
  'mdi:water-percent',
];

export default function GraphOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as GraphOptions;
  const fontScale = typeof o.fontScale === 'number' ? o.fontScale : DEFAULT_FONT_SCALE;
  const set = (patch: Partial<GraphOptions>) => updateElementOptions(pageId, element.id, patch);

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <header class={opt.header}>
        <span>History graph settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <p class={opt.dim}>
          Showing <code>{o.entityId ?? 'no sensor yet'}</code>
        </p>
        <div class={opt.row}>
          Sensor
          <EntityPicker
            onPick={(entityId) => set({ entityId })}
            filter={(en) => en.entity_id.startsWith('sensor.')}
          />
        </div>
        <div class={opt.row}>
          Layout
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${o.layout !== 'tile' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ layout: 'graph' })}
            >
              Full graph
            </button>
            <button
              class={`${opt.segBtn}${o.layout === 'tile' ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ layout: 'tile' })}
            >
              Compact tile
            </button>
          </div>
        </div>
        {o.layout === 'tile' && (
          <div class={opt.row}>
            Tile icon
            <div class={opt.iconRow}>
              <button
                class={`${opt.iconBtn}${!o.icon ? ` ${opt.iconBtnActive}` : ''}`}
                onClick={() => set({ icon: undefined })}
              >
                Auto
              </button>
              {TILE_ICONS.map((name) => (
                <button
                  key={name}
                  class={`${opt.iconBtn}${o.icon === name ? ` ${opt.iconBtnActive}` : ''}`}
                  onClick={() => set({ icon: name })}
                  aria-label={name}
                >
                  <MdiIcon names={[name]} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div class={opt.row}>
          Window
          <div class={opt.seg}>
            {WINDOWS.map((w) => (
              <button
                key={w.hours}
                class={`${opt.segBtn}${(o.hours ?? 24) === w.hours ? ` ${opt.segActive}` : ''}`}
                onClick={() => set({ hours: w.hours })}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <label class={opt.row}>
          Title (a friendly name for ugly sensor names)
          <input
            type="text"
            value={o.title ?? ''}
            placeholder="Uses the sensor's name if empty"
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </label>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
        <CardTitleRow pageId={pageId} element={element} />
        <CardOpacityRow pageId={pageId} element={element} />
        <div class={opt.footerRow}>
          <button
            class={opt.removeBtn}
            onClick={() => {
              removeElement(pageId, element.id);
              onClose();
            }}
          >
            Remove element
          </button>
          <button class={opt.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
