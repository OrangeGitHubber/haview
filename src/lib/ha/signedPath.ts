import { getConnection } from './connection';
import { haBase } from '../config';

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const REFRESH_MARGIN_MS = 30_000;

/**
 * Returns an absolute, signed URL for an authenticated HA path (camera
 * snapshots, entity pictures) so it can be used in a plain <img> src.
 * Signed URLs are cached until shortly before expiry so a refreshing camera
 * grid doesn't issue a WS sign call per frame.
 */
export async function getSignedUrl(path: string, expiresSec = 300): Promise<string> {
  const hit = cache.get(path);
  if (hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS) return hit.url;

  const conn = await getConnection();
  const result = await conn.sendMessagePromise<{ path: string }>({
    type: 'auth/sign_path',
    path,
    expires: expiresSec,
  });
  // the signed path is served through the reverse proxy (same origin)
  const url = haBase() + result.path;
  cache.set(path, { url, expiresAt: Date.now() + expiresSec * 1000 });
  return url;
}
