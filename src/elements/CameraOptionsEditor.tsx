import { Modal } from '../components/Modal';
import { updateElementOptions, removeElement } from '../lib/settings';
import { EntityPicker } from '../grid/EntityPicker';
import { useEntity } from '../lib/ha/entities';
import { friendlyName } from '../views/settings/EntitySelect';
import { CardOpacityRow, CardTitleRow } from './CardOpacityRow';
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
  return (
    <li class={opt.checkItem} style={{ cursor: 'default' }}>
      <span class={opt.checkName}>{entity ? friendlyName(entity) : id}</span>
      <button class={opt.close} onClick={onUp} disabled={first} aria-label="Move up">
        ▲
      </button>
      <button class={opt.close} onClick={onDown} disabled={last} aria-label="Move down">
        ▼
      </button>
      <button class={opt.close} onClick={onRemove} aria-label={`Remove ${id}`}>
        ✕
      </button>
    </li>
  );
}

export default function CameraOptionsEditor({ pageId, element, onClose }: EditorProps) {
  const o = (element.options ?? {}) as CamerasOptions;
  const cams = cameraIds(o);
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
    <Modal onClose={onClose} maxWidth={520}>
      <header class={opt.header}>
        <span>Cameras settings</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        <label class={opt.row}>
          Title
          <input
            type="text"
            value={o.title ?? ''}
            placeholder="Cameras"
            onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
          />
        </label>

        {cams.length > 0 && (
          <div class={opt.row}>
            Cameras in this card ({cams.length})
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
          </div>
        )}

        <div class={opt.row}>
          Columns
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
        </div>

        <div class={opt.row}>
          Add a camera
          <EntityPicker
            filter={(en) => en.entity_id.startsWith('camera.')}
            onPick={(id) => {
              if (!cams.includes(id)) setCams([...cams, id]);
            }}
          />
        </div>

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
