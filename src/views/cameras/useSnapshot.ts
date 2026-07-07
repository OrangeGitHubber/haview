import { useEffect, useRef, useState } from 'preact/hooks';
import { getSignedUrl } from '../../lib/ha/signedPath';
import { connectionStatus } from '../../lib/ha/connection';
import { haBase } from '../../lib/config';

const REFRESH_MS = 10_000;
const STALE_AFTER_MISSES = 3;

function preload(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image failed'));
    img.src = url;
  });
}

/**
 * Auto-refreshing camera snapshot. Frames are preloaded off-DOM and only
 * swapped in on success (no flicker; a failed fetch keeps the last good
 * frame). Refreshing pauses while the tab is hidden or HA is disconnected.
 * `staggerMs` offsets each tile's interval so a grid doesn't fire all
 * requests in one burst.
 */
export function useSnapshot(entityId: string, staggerMs: number, picture?: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const missed = useRef(0);

  useEffect(() => {
    let disposed = false;
    let interval: number | undefined;

    async function tick() {
      if (disposed || document.hidden || connectionStatus.peek() !== 'connected') return;
      try {
        // Prefer the camera's entity_picture (carries its own access token —
        // the same URL HA's UI uses); fall back to a signed camera_proxy path.
        // Both are fetched through the reverse proxy (same origin).
        let base: string;
        if (picture && picture.includes('token=') && picture.startsWith('/')) {
          base = haBase() + picture;
        } else {
          base = await getSignedUrl(`/api/camera_proxy/${entityId}`, 300);
        }
        const url = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
        await preload(url);
        if (disposed) return;
        missed.current = 0;
        setStale(false);
        setSrc(url);
      } catch {
        missed.current += 1;
        if (!disposed && missed.current >= STALE_AFTER_MISSES) setStale(true);
      }
    }

    const startTimer = setTimeout(() => {
      tick();
      interval = window.setInterval(tick, REFRESH_MS);
    }, staggerMs);

    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      clearTimeout(startTimer);
      if (interval !== undefined) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [entityId, staggerMs, picture]);

  return { src, stale };
}
