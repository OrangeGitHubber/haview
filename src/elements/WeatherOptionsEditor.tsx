import { OptionsDialog, Section, Field } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { EntityChooser } from './EntityChooser';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

const DAY_CHOICES = [3, 4, 5, 6, 7];

export default function WeatherOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const rawId = element.options?.entityId;
  const current = typeof rawId === 'string' ? rawId : '';
  const rawDays = element.options?.forecastDays;
  const days = typeof rawDays === 'number' ? rawDays : 5;
  const rawScale = element.options?.fontScale;
  const fontScale = typeof rawScale === 'number' ? rawScale : DEFAULT_FONT_SCALE;
  const rawDropHourly = element.options?.dropHourlyAtXs;
  const dropHourlyAtXs = typeof rawDropHourly === 'boolean' ? rawDropHourly : true;
  const set = (patch: Record<string, unknown>) => updateElementOptions(pageId, element.id, patch);

  return (
    <OptionsDialog
      title="Weather settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={440}
    >
      <Section title="Entity">
        <EntityChooser
          current={current}
          filter={(en) => en.entity_id.startsWith('weather.')}
          onPick={(entityId) => set({ entityId })}
          emptyLabel="No weather entity selected"
        />
      </Section>

      <Section title="Display">
        <Field label="Forecast days">
          <div class={opt.seg}>
            {DAY_CHOICES.map((d) => (
              <button
                key={d}
                class={`${opt.segBtn}${days === d ? ` ${opt.segActive}` : ''}`}
                onClick={() => set({ forecastDays: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Hourly forecast when small">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${dropHourlyAtXs ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ dropHourlyAtXs: true })}
            >
              Hide
            </button>
            <button
              class={`${opt.segBtn}${!dropHourlyAtXs ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ dropHourlyAtXs: false })}
            >
              Always
            </button>
          </div>
        </Field>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>
    </OptionsDialog>
  );
}
