import { OptionsDialog, Section, Field } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { useEntity } from '../lib/ha/entities';
import { EntityChooser } from './EntityChooser';
import { TextSizeRow } from './TextSizeRow';
import EntityCard from './EntityCard';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

const DECIMALS = [null, 0, 1, 2] as const;

export default function EntityOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const rawId = element.options?.entityId;
  const current = typeof rawId === 'string' ? rawId : '';
  const fontScale =
    typeof element.options?.fontScale === 'number' ? element.options.fontScale : DEFAULT_FONT_SCALE;
  const decimals =
    typeof element.options?.decimals === 'number' ? element.options.decimals : null;
  const set = (patch: Record<string, unknown>) => updateElementOptions(pageId, element.id, patch);

  // decimals only mean anything for a numeric state — showing the row on a
  // light or a lock was just noise
  const entity = useEntity(current).value;
  const numeric = !!entity && entity.state !== '' && Number.isFinite(Number(entity.state));

  return (
    <OptionsDialog
      title="Entity card settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      preview={
        current ? (
          <div style={{ height: '104px' }}>
            <EntityCard pageId={pageId} element={element} editing={false} />
          </div>
        ) : undefined
      }
    >
      <Section title="Entity">
        <EntityChooser current={current} onPick={(entityId) => set({ entityId })} />
      </Section>

      <Section title="Display">
        {numeric && (
          <Field label="Decimals">
            <div class={opt.seg}>
              {DECIMALS.map((d) => (
                <button
                  key={String(d)}
                  class={`${opt.segBtn}${decimals === d ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ decimals: d ?? undefined })}
                >
                  {d === null ? 'Auto' : d}
                </button>
              ))}
            </div>
          </Field>
        )}
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>
    </OptionsDialog>
  );
}
