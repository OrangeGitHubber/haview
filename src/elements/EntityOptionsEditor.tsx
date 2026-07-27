import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import { EntityPicker } from '../grid/EntityPicker';
import { CardOpacityRow, CardTitleRow } from './CardOpacityRow';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

/** Change which entity this card shows, or remove the card. */
export default function EntityOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const rawId = element.options?.entityId;
  const current = typeof rawId === 'string' ? rawId : '';
  const fontScale =
    typeof element.options?.fontScale === 'number' ? element.options.fontScale : DEFAULT_FONT_SCALE;

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <header class={opt.header}>
        <span>Entity card settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <p class={opt.dim}>
          Currently showing <code>{current || 'nothing'}</code>
        </p>
        <div class={opt.row}>
          Change entity
          <EntityPicker
            onPick={(entityId) => updateElementOptions(pageId, element.id, { entityId })}
          />
        </div>
        <div class={opt.row}>
          Decimals (numeric sensors, e.g. temperature)
          <div class={opt.seg}>
            {([null, 0, 1, 2] as const).map((d) => (
              <button
                key={String(d)}
                class={`${opt.segBtn}${
                  (typeof element.options?.decimals === 'number'
                    ? element.options.decimals
                    : null) === d
                    ? ` ${opt.segActive}`
                    : ''
                }`}
                onClick={() =>
                  updateElementOptions(pageId, element.id, { decimals: d ?? undefined })
                }
              >
                {d === null ? 'Auto' : d}
              </button>
            ))}
          </div>
        </div>
        <TextSizeRow
          scale={fontScale}
          onChange={(pct) => updateElementOptions(pageId, element.id, { fontScale: pct })}
        />
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
