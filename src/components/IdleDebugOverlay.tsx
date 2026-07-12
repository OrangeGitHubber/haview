import { useEffect, useState } from 'preact/hooks';

interface Entry {
  n: number;
  type: string;
  info: string;
  t: number;
}

/**
 * Troubleshooting overlay (Settings → "Show input-activity debug overlay").
 * Logs the raw input events that reset the idle timer so a display that
 * refuses to stay dimmed can be diagnosed on-screen, without devtools — read
 * off which event fires at the moment the dim clears.
 *
 * `nightActive` reflects Shell's computed dim/screensaver state so the log and
 * the state are visible together (watch it flip false the instant a stray
 * event lands). This listens independently of useIdle — it only observes.
 */
export function IdleDebugOverlay({ nightActive }: { nightActive: boolean }) {
  const [log, setLog] = useState<Entry[]>([]);

  useEffect(() => {
    let n = 0;
    let lastX: number | null = null;
    let lastY: number | null = null;
    const push = (type: string, info: string) => {
      n += 1;
      const entry = { n, type, info, t: Date.now() };
      setLog((prev) => [entry, ...prev].slice(0, 12));
    };
    const onDiscrete = (e: Event) => {
      const extra = e instanceof KeyboardEvent ? ` key=${e.key}` : '';
      push(e.type, extra.trim());
    };
    const onMove = (e: PointerEvent) => {
      let d = '—';
      if (lastX !== null && lastY !== null) {
        d = Math.round(Math.hypot(e.clientX - lastX, e.clientY - lastY)) + 'px';
      }
      lastX = e.clientX;
      lastY = e.clientY;
      push('pointermove', `${e.clientX},${e.clientY} Δ${d} (${e.pointerType})`);
    };
    const discrete = ['pointerdown', 'pointerup', 'touchstart', 'keydown', 'wheel', 'click'];
    for (const ev of discrete) window.addEventListener(ev, onDiscrete, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      for (const ev of discrete) window.removeEventListener(ev, onDiscrete);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        // bottom-centre: clear of the left nav and the bottom-right edit FAB,
        // so it never covers anything you need to click
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200, // above the screensaver (101) so it stays readable
        maxWidth: 'min(520px, 92vw)',
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.82)',
        color: '#e6ffe6',
        font: '12px/1.45 ui-monospace, Menlo, Consolas, monospace',
        border: '1px solid #2c8',
        borderRadius: 8,
        // belt-and-braces: transparent to clicks so navigation underneath is
        // always reachable even if it does overlap something
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
      aria-hidden="true"
    >
      <div style={{ color: nightActive ? '#7CFC9A' : '#ff8f8f', fontWeight: 700 }}>
        night dim/screensaver: {nightActive ? 'ACTIVE' : 'cleared'}
      </div>
      <div style={{ color: '#9fd', marginBottom: 4 }}>last input events (newest first):</div>
      {log.length === 0 ? (
        <div style={{ color: '#8a8' }}>…waiting for input events…</div>
      ) : (
        log.map((e) => (
          <div key={e.n}>
            #{e.n} {e.type}
            {e.info ? '  ' + e.info : ''}
          </div>
        ))
      )}
    </div>
  );
}
