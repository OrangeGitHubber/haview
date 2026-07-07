import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DATA = process.env.DATA_DIR || '/data';
const CONN_FILE = join(DATA, 'connection.json');

let connCache; // { hassUrl, token } | null | undefined (undefined = not loaded)

export function normalizeHassUrl(url) {
  let u = String(url || '').trim();
  if (u === '') return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, '');
}

/** The stored HA connection { hassUrl, token }, or null if unconfigured. */
export async function getConnection() {
  if (connCache !== undefined) return connCache;
  try {
    const parsed = JSON.parse(await readFile(CONN_FILE, 'utf8'));
    connCache = parsed && parsed.hassUrl && parsed.token ? parsed : null;
  } catch {
    connCache = null;
  }
  return connCache;
}

export async function setConnection(hassUrl, token) {
  await mkdir(DATA, { recursive: true });
  connCache = { hassUrl: normalizeHassUrl(hassUrl), token: String(token).trim() };
  await writeFile(CONN_FILE, JSON.stringify(connCache), { mode: 0o600 });
  return connCache;
}

export { DATA };
