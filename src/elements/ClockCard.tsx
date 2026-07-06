import { useEffect, useState } from 'preact/hooks';
import type { ElementProps } from '../grid/elements';
import type { ClockOptions } from './ClockOptionsEditor';
import styles from './elements.module.css';

const FONT_SIZES: Record<string, string> = {
  s: '1.5rem',
  m: '2.4rem',
  l: '3.8rem',
  xl: '5.5rem',
};

/** System-time clock, aligned to the minute boundary so it never lags. */
export default function ClockCard({ element }: ElementProps) {
  const o = (element.options ?? {}) as ClockOptions;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: number | undefined;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    const onVis = () => {
      if (!document.hidden) setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(align);
      if (interval !== undefined) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const timeStyle: Record<string, string> = {};
  if (o.size && FONT_SIZES[o.size]) timeStyle.fontSize = FONT_SIZES[o.size];
  if (typeof o.color === 'string' && o.color) timeStyle.color = o.color;

  return (
    <div class={`${styles.card} ${styles.clockCard}`}>
      <span class={styles.clockTime} style={timeStyle}>
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span class={styles.clockDate}>
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </div>
  );
}
