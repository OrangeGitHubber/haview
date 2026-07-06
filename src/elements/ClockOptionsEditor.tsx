import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

export interface ClockOptions {
  /** undefined = auto (scales with card width) */
  size?: 's' | 'm' | 'l' | 'xl';
  /** CSS color for the time; undefined = theme text color */
  color?: string;
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
  const set = (patch: Partial<ClockOptions>) => updateElementOptions(pageId, element.id, patch);

  return (
    <Modal onClose={onClose} maxWidth={380}>
      <header class={opt.header}>
        <span>Clock settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <div class={opt.row}>
          Size
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
        </div>
        <div class={opt.row}>
          Color
          <div class={opt.seg}>
            <input
              type="color"
              value={o.color ?? '#f2ede8'}
              onChange={(e) => set({ color: (e.target as HTMLInputElement).value })}
            />
            <button
              class={`${opt.segBtn}${!o.color ? ` ${opt.segActive}` : ''}`}
              onClick={() => set({ color: undefined })}
            >
              Theme default
            </button>
          </div>
        </div>
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
