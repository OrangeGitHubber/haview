import { useState } from 'preact/hooks';
import opt from '../components/options.module.css';
import { DEFAULT_FONT_SCALE } from '../lib/fontSizePresets';

let seq = 0;

/** Single per-widget text-size knob (replaces the old four per-bucket
    inputs). The widget still auto-fits its text to its rendered size via its
    size buckets; this scales all of those sizes up or down together. The live
    percentage and the reset affordance replace the paragraph of helper text
    that used to explain it. */
export function TextSizeRow({
  scale,
  onChange,
}: {
  scale: number;
  onChange: (pct: number) => void;
}) {
  const [id] = useState(() => `txtsize${++seq}`);
  return (
    <div class={opt.ovRow}>
      <div class={opt.ovHead}>
        <span id={id}>Text size</span>
        <span>{scale}%</span>
      </div>
      <div class={opt.ovBody}>
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={scale}
          aria-labelledby={id}
          style={{ flex: '1', minWidth: '140px' }}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        />
        <button
          class={opt.reset}
          disabled={scale === DEFAULT_FONT_SCALE}
          onClick={() => onChange(DEFAULT_FONT_SCALE)}
          aria-label={`Reset text size to ${DEFAULT_FONT_SCALE}%`}
          title={`Reset to ${DEFAULT_FONT_SCALE}%`}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
