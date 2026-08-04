import { OptionsDialog, Section, Field, OverrideRow } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

export interface ClockOptions {
  /** undefined = auto (scales with card width) */
  size?: 's' | 'm' | 'l' | 'xl';
  /** CSS color for the time; undefined = theme text color */
  color?: string;
  /** hide on phones (<700px); undefined defaults to hidden for the clock */
  hideOnMobile?: boolean;
  /** text-size multiplier (percent, 50–200; 100 = default) on top of the
      Auto/S/M/L/XL size */
  fontScale?: number;
}

const SIZES: { id: ClockOptions['size']; label: string }[] = [
  { id: undefined, label: 'Auto' },
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
  { id: 'xl', label: 'XL' },
];

export default function ClockOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as ClockOptions;
  const fontScale = typeof o.fontScale === 'number' ? o.fontScale : DEFAULT_FONT_SCALE;
  const set = (patch: Partial<ClockOptions>) => updateElementOptions(pageId, element.id, patch);

  return (
    <OptionsDialog
      title="Clock settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={420}
      // the clock draws no card title, so those overrides would do nothing
      withTitleOverride={false}
    >
      <Section title="Display">
        <Field label="Size">
          <div class={opt.seg}>
            {SIZES.map((sz) => (
              <button
                key={sz.label}
                class={`${opt.segBtn}${o.size === sz.id ? ` ${opt.segActive}` : ''}`}
                onClick={() => set({ size: sz.id })}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </Field>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
        <OverrideRow
          label="Colour"
          overridden={!!o.color}
          value={o.color}
          onOverride={() => set({ color: '#f2ede8' })}
          onReset={() => set({ color: undefined })}
        >
          <input
            type="color"
            value={o.color ?? '#f2ede8'}
            aria-label="Clock colour"
            onInput={(e) => set({ color: (e.target as HTMLInputElement).value })}
          />
        </OverrideRow>
        <Field label="Show on phones">
          <div class={opt.seg}>
            <button
              class={`${opt.segBtn}${o.hideOnMobile === false ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ hideOnMobile: false })}
            >
              Show
            </button>
            <button
              class={`${opt.segBtn}${o.hideOnMobile !== false ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ hideOnMobile: true })}
            >
              Hide
            </button>
          </div>
        </Field>
      </Section>
    </OptionsDialog>
  );
}
