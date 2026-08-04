import { useState } from 'preact/hooks';
import { OptionsDialog, Section, Field, WideField } from '../components/OptionsDialog';
import { updateElementOptions } from '../lib/settings';
import { EntityPicker } from '../grid/EntityPicker';
import { useEntity } from '../lib/ha/entities';
import { friendlyName } from '../views/settings/EntitySelect';
import { cameraIds, type CamerasOptions } from './CameraCard';
import type { EditorProps } from './domainOptionsEditor';
import opt from '../components/options.module.css';

function CamRow({
  id,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: {
  id: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const entity = useEntity(id).value;
  const name = entity ? friendlyName(entity) : id;
  return (
    <li class={opt.checkItem} style={{ cursor: 'default' }}>
      <span class={opt.checkName}>{name}</span>
      <button class={opt.close} onClick={onUp} disabled={first} aria-label={`Move ${name} up`}>
        ▲
      </button>
      <button class={opt.close} onClick={onDown} disabled={last} aria-label={`Move ${name} down`}>
        ▼
      </button>
      <button class={opt.close} onClick={onRemove} aria-label={`Remove ${name}`}>
        ✕
      </button>
    </li>
  );
}

export default function CameraOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as CamerasOptions;
  const cams = cameraIds(o);
  const [adding, setAdding] = useState(cams.length === 0);
  const set = (patch: Partial<CamerasOptions>) => updateElementOptions(pageId, element.id, patch);
  const setCams = (next: string[]) => set({ cameras: next });
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...cams];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setCams(arr);
  };

  return (
    <OptionsDialog
      title="Cameras settings"
      pageId={pageId}
      element={element}
      onClose={onClose}
      maxWidth={520}
    >
      <Section title="Cameras">
        {cams.length === 0 && <p class={opt.dim}>No cameras in this card yet.</p>}
        {cams.length > 0 && (
          <ul class={opt.checklist}>
            {cams.map((id, i) => (
              <CamRow
                key={id}
                id={id}
                first={i === 0}
                last={i === cams.length - 1}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => setCams(cams.filter((c) => c !== id))}
              />
            ))}
          </ul>
        )}
        <div class={opt.summary}>
          <span class={opt.summaryText}>
            <span class={opt.summaryName}>
              {cams.length} camera{cams.length === 1 ? '' : 's'} in this card
            </span>
          </span>
          <button class={opt.segBtn} aria-expanded={adding} onClick={() => setAdding(!adding)}>
            {adding ? 'Done' : 'Add…'}
          </button>
        </div>
        {adding && (
          <EntityPicker
            filter={(en) => en.entity_id.startsWith('camera.')}
            onPick={(id) => {
              if (!cams.includes(id)) setCams([...cams, id]);
            }}
          />
        )}
      </Section>

      <Section title="Display">
        <WideField label="Card title">
          <input
            type="text"
            value={o.title ?? ''}
            placeholder="Cameras"
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </WideField>
        <Field label="Columns">
          <div class={opt.seg}>
            {([0, 1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                class={`${opt.segBtn}${(o.columns ?? 0) === n ? ` ${opt.segActive}` : ''}`}
                onClick={() => set({ columns: n })}
              >
                {n === 0 ? 'Auto' : n}
              </button>
            ))}
          </div>
        </Field>
      </Section>
    </OptionsDialog>
  );
}
