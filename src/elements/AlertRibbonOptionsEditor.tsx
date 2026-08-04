import { useState } from 'preact/hooks';
import { OptionsDialog, Section, WideField } from '../components/OptionsDialog';
import { updateElementOptions, newId } from '../lib/settings';
import { EntityPicker } from '../grid/EntityPicker';
import { TextSizeRow } from './TextSizeRow';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';
import type { EditorProps } from './domainOptionsEditor';
import { alertCardSize, type AlertItem, type AlertOp, type AlertRibbonOptions } from './AlertRibbon';
import opt from '../components/options.module.css';

const OPS: { op: AlertOp; label: string }[] = [
  { op: 'on', label: 'is on' },
  { op: 'off', label: 'is off' },
  { op: 'gt', label: '>' },
  { op: 'lt', label: '<' },
  { op: 'eq', label: '=' },
  { op: 'ne', label: '≠' },
];

function needsValue(op: AlertOp): boolean {
  return op === 'gt' || op === 'lt' || op === 'eq' || op === 'ne';
}

export default function AlertRibbonOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as AlertRibbonOptions;
  const items = Array.isArray(o.items) ? o.items : [];
  const fontScale = typeof o.fontScale === 'number' ? o.fontScale : DEFAULT_FONT_SCALE;
  const [adding, setAdding] = useState(items.length === 0);

  const set = (patch: Partial<AlertRibbonOptions>) =>
    updateElementOptions(pageId, element.id, patch);
  const setItems = (next: AlertItem[]) => set({ items: next });
  const patchItem = (id: string, patch: Partial<AlertItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const moveItem = (id: string, dir: -1 | 1) => {
    const arr = [...items];
    const i = arr.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setItems(arr);
  };

  return (
    <OptionsDialog
      title="Alert ribbon settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={560}
    >
      <Section title="Rules">
        <p class={opt.dim}>
          Each card shows only while its condition holds; the order here is the ribbon order.
        </p>
        {items.length > 0 && (
          <ul class={opt.checklist}>
            {items.map((it, i) => (
              <li key={it.id} class={opt.checkItem} style={{ cursor: 'default' }}>
                <span class={opt.checkName} title={it.entityId}>
                  {it.entityId}
                </span>
                <select
                  value={it.op}
                  aria-label={`Condition for ${it.entityId}`}
                  onChange={(e) =>
                    patchItem(it.id, { op: (e.target as HTMLSelectElement).value as AlertOp })
                  }
                >
                  {OPS.map((op) => (
                    <option key={op.op} value={op.op}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {needsValue(it.op) && (
                  <input
                    type="text"
                    style={{ width: '72px' }}
                    value={it.value ?? ''}
                    placeholder="value"
                    aria-label={`Value for ${it.entityId}`}
                    onInput={(e) =>
                      patchItem(it.id, { value: (e.target as HTMLInputElement).value })
                    }
                  />
                )}
                <button
                  class={opt.close}
                  onClick={() => moveItem(it.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${it.entityId} left`}
                >
                  ◀
                </button>
                <button
                  class={opt.close}
                  onClick={() => moveItem(it.id, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${it.entityId} right`}
                >
                  ▶
                </button>
                <button
                  class={opt.close}
                  onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                  aria-label={`Remove rule for ${it.entityId}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div class={opt.summary}>
          <span class={opt.summaryText}>
            <span class={opt.summaryName}>
              {items.length} rule{items.length === 1 ? '' : 's'}
            </span>
          </span>
          <button class={opt.segBtn} aria-expanded={adding} onClick={() => setAdding(!adding)}>
            {adding ? 'Done' : 'Add a device…'}
          </button>
        </div>
        {adding && (
          <EntityPicker
            onPick={(entityId) => setItems([...items, { id: newId('a'), entityId, op: 'on' }])}
          />
        )}
      </Section>

      <Section title="Display">
        <WideField label={`Card width · ${alertCardSize(o).w}px`}>
          <input
            type="range"
            min={120}
            max={420}
            step={10}
            value={alertCardSize(o).w}
            onInput={(e) => set({ cardWidth: Number((e.target as HTMLInputElement).value) })}
          />
        </WideField>
        <WideField label={`Card height · ${alertCardSize(o).h}px`}>
          <input
            type="range"
            min={56}
            max={220}
            step={4}
            value={alertCardSize(o).h}
            onInput={(e) => set({ cardHeight: Number((e.target as HTMLInputElement).value) })}
          />
        </WideField>
        <WideField label="Card title">
          <input
            type="text"
            value={o.title ?? ''}
            placeholder="Alerts"
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </WideField>
        <TextSizeRow scale={fontScale} onChange={(pct) => set({ fontScale: pct })} />
      </Section>
    </OptionsDialog>
  );
}
