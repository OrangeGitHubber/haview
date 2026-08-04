import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useEntity } from '../lib/ha/entities';
import { useHistory, type HistoryPoint } from './useHistory';
import { friendlyName } from './EntityCard';
import { MdiIcon } from '../components/MdiIcon';
import { domainIconNames } from '../lib/entityIcons';
import { fontScaleOf } from '../lib/fontSizePresets';
import type { ElementProps } from '../grid/elements';
import styles from './elements.module.css';

export interface GraphOptions {
  entityId?: string;
  /** window in hours (3–168) */
  hours?: number;
  title?: string;
  /** 'graph' = full history chart; 'tile' = compact stat tile + sparkline */
  layout?: 'graph' | 'tile';
  /** mdi icon name for tile mode; falls back to the entity's icon */
  icon?: string;
  /** text-size multiplier (percent, 50–200; 100 = default) */
  fontScale?: number;
}

// viewBox units; stretched to the card (line width stays fixed via
// vector-effect: non-scaling-stroke)
const W = 100;
const H = 36;

function fmtVal(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

export default function GraphCard({ element }: ElementProps) {
  const o = (element.options ?? {}) as GraphOptions;
  const entityId = typeof o.entityId === 'string' ? o.entityId : '';
  const hours = typeof o.hours === 'number' ? Math.min(Math.max(o.hours, 1), 168) : 24;
  const entity = useEntity(entityId).value;
  const { points, loading, error } = useHistory(entityId, hours);
  const [hover, setHover] = useState<HistoryPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardScale = { '--card-scale': String(fontScaleOf(o.fontScale)) } as Record<string, string>;

  if (!entityId) {
    return (
      <div class={`${styles.card} ${styles.cardDead}`} style={cardScale}>
        <span class={styles.state}>No sensor selected</span>
      </div>
    );
  }

  const unit =
    typeof entity?.attributes.unit_of_measurement === 'string'
      ? entity.attributes.unit_of_measurement
      : '';
  const title = o.title?.trim() || (entity ? friendlyName(entity) : entityId);
  const curState = entity ? Number(entity.state) : NaN;
  const current = Number.isFinite(curState)
    ? curState
    : points.length > 0
      ? points[points.length - 1].v
      : null;

  let min = 0;
  let max = 0;
  let avg = 0;
  let linePath = '';
  let areaPath = '';
  let xOf: (t: number) => number = () => 0;
  if (points.length >= 2) {
    min = Infinity;
    max = -Infinity;
    let sum = 0;
    for (const p of points) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
      sum += p.v;
    }
    avg = sum / points.length;
    const t0 = points[0].t;
    const span = Math.max(points[points.length - 1].t - t0, 1);
    const pad = Math.max(max - min, 1e-9) * 0.08;
    const lo = min - pad;
    const vspan = max + pad - lo;
    const y = (v: number) => H - ((v - lo) / vspan) * H;
    xOf = (t: number) => ((t - t0) / span) * W;
    linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(2)} ${y(p.v).toFixed(2)}`)
      .join(' ');
    areaPath = `${linePath} L${W} ${H} L0 ${H} Z`;
  }

  const onMove = (e: JSX.TargetedPointerEvent<SVGSVGElement>) => {
    if (points.length < 2 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHover(points[Math.round(frac * (points.length - 1))]);
  };

  const shown = hover ? hover.v : current;

  // ---- compact stat tile: mirrors the entity card exactly (title, then
  // icon + value) and just appends a sparkline, so a graph tile and an entity
  // card read as one family ----
  if (o.layout === 'tile') {
    const iconNames = [
      ...(typeof o.icon === 'string' && o.icon ? [o.icon] : []),
      ...(typeof entity?.attributes.icon === 'string' ? [entity.attributes.icon] : []),
      ...domainIconNames(entityId),
    ];
    return (
      <div class={styles.card} style={cardScale}>
        <span class={`${styles.name} card-title`}>{title}</span>
        <div class={styles.cardBottom}>
          <div class={styles.cardTop}>
            <MdiIcon names={iconNames} class={styles.glyph} />
            <span class={styles.state}>
              {current !== null ? fmtVal(current) : '—'}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
          {points.length >= 2 && (
            <svg
              class={styles.tileSpark}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={areaPath} class={styles.graphArea} />
              <path d={linePath} class={styles.graphLine} />
            </svg>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class={`${styles.card} ${styles.graphCard}`} style={cardScale}>
      <div class={styles.graphHead}>
        <span class={`${styles.name} card-title`}>{title}</span>
        <span class={styles.graphWindow}>{hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`}</span>
      </div>
      <span class={styles.graphValue}>
        {shown !== null ? fmtVal(shown) : '—'}
        {unit && <span class={styles.graphUnit}> {unit}</span>}
        {hover && (
          <span class={styles.graphTime}>
            {' · '}
            {new Date(hover.t).toLocaleString(undefined, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </span>
      <div class={styles.graphPlot}>
        {points.length < 2 ? (
          <span class={styles.graphEmpty}>
            {loading ? 'Loading history…' : error ? `No history (${error})` : 'Not enough history yet.'}
          </span>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {/* recessive grid */}
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} class={styles.graphGrid} />
            <line x1="0" y1="0.5" x2={W} y2="0.5" class={styles.graphGrid} />
            <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} class={styles.graphGrid} />
            <path d={areaPath} class={styles.graphArea} />
            <path d={linePath} class={styles.graphLine} />
            {hover && <line x1={xOf(hover.t)} y1="0" x2={xOf(hover.t)} y2={H} class={styles.graphCross} />}
          </svg>
        )}
      </div>
      {points.length >= 2 && (
        <span class={styles.graphSummary}>
          min {fmtVal(min)} · avg {fmtVal(avg)} · max {fmtVal(max)}
          {unit ? ` ${unit}` : ''}
        </span>
      )}
    </div>
  );
}
