import { OptionsDialog, Section, Field, WideField } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { MdiIcon } from '../components/MdiIcon';
import { EntityChooser } from './EntityChooser';
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
    <OptionsDialog
      title="History graph settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={480}
    >
      <Section title="Sensor">
        <EntityChooser
          current={o.entityId ?? ''}
          filter={(en) => en.entity_id.startsWith('sensor.')}
          onPick={(entityId) => set({ entityId })}
          emptyLabel="No sensor selected"
        />
      </Section>

      <Section title="Display">
        <Field label="Layout">
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
        </Field>
        <Field label="Window">
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
        </Field>
        {o.layout === 'tile' && (
          <div class={opt.fieldWide}>
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
        <WideField label="Name (for ugly sensor names)">
          <input
            type="text"
            value={o.title ?? ''}
            placeholder="Uses the sensor's name if empty"
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </WideField>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>
    </OptionsDialog>
  );
}
