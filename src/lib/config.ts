import { signal } from '@preact/signals';

/**
 * Connection model. The HA URL + long-lived token live ONLY in the container
 * (see server/config-store.mjs); the browser talks to Home Assistant through
 * the same-origin reverse proxy at /ha and never sees the token.
 */

/** true while the user is re-running the connection setup from Settings */
export const setupRequested = signal(false);

export interface ServerConfig {
  /** has the container been given an HA URL + token yet? */
  configured: boolean;
  /** for display only (the token is never sent to the browser) */
  hassUrl?: string;
  /** false until the first /config/connection fetch resolves */
  loaded: boolean;
}

export const serverConfig = signal<ServerConfig>({ configured: false, loaded: false });

/** Same-origin base for the Home Assistant reverse proxy. */
export function haBase(): string {
  return `${location.origin}/ha`;
}

export function normalizeHassUrl(url: string): string {
  let u = url.trim();
  if (u === '') return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, '');
}

/** Loads the container's connection status (does NOT include the token). */
export async function fetchServerConfig(): Promise<ServerConfig> {
  try {
    const res = await fetch('/config/connection');
    if (res.ok) {
      const j = (await res.json()) as { configured?: boolean; hassUrl?: string };
      serverConfig.value = { configured: !!j.configured, hassUrl: j.hassUrl, loaded: true };
      return serverConfig.value;
    }
  } catch {
    /* server unreachable — fall through to unconfigured/loaded */
  }
  serverConfig.value = { ...serverConfig.peek(), loaded: true };
  return serverConfig.value;
}

/** Stores the HA URL + token in the container (validated server-side). */
export async function saveConnection(
  hassUrl: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/config/connection', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hassUrl: normalizeHassUrl(hassUrl), token: token.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && j.ok) return { ok: true };
    return { ok: false, error: j.error || `Dashboard server returned ${res.status}.` };
  } catch {
    return { ok: false, error: 'Could not reach the dashboard server.' };
  }
}
