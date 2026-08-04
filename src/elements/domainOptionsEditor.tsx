import { OptionsDialog, Section } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { EntityChooser } from './EntityChooser';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { GridElement } from '../grid/types';

export interface EditorProps {
  pageId: string;
  element: GridElement;
  onClose: () => void;
}

/** Options editor for elements that just pick one entity of a fixed domain. */
export function makeDomainOptionsEditor(domain: string, label: string) {
  return function DomainOptionsEditor({ pageId, element, onClose }: EditorProps) {
    const rawId = element.options?.entityId;
    const current = typeof rawId === 'string' ? rawId : '';
    const fontScale =
      typeof element.options?.fontScale === 'number'
        ? element.options.fontScale
        : DEFAULT_FONT_SCALE;
    const set = (patch: Record<string, unknown>) => updateElementOptions(pageId, element.id, patch);

    return (
      <OptionsDialog title={label} pageId={pageId} element={element} onClose={onClose}>
        <Section title="Entity">
          <EntityChooser
            current={current}
            filter={(en) => en.entity_id.startsWith(`${domain}.`)}
            onPick={(entityId) => set({ entityId })}
            emptyLabel={`No ${domain.replace(/_/g, ' ')} selected`}
          />
        </Section>
        <Section title="Display">
          <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
        </Section>
      </OptionsDialog>
    );
  };
}
