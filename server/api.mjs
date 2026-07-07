import { getConnection, setConnection, normalizeHassUrl } from './config-store.mjs';

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/** /config/* API. Currently just the shared HA connection (profiles in C3). */
export async function handleConfig(req, res) {
  const url = (req.url || '').split('?')[0];

  if (url === '/config/connection') {
    if (req.method === 'GET') {
      const conn = await getConnection();
      // never expose the token
      json(res, 200, { configured: !!conn, hassUrl: conn ? conn.hassUrl : undefined });
      return;
    }
    if (req.method === 'PUT') {
      let body;
      try {
        body = await readJson(req);
      } catch {
        json(res, 400, { ok: false, error: 'Invalid JSON.' });
        return;
      }
      const hassUrl = normalizeHassUrl(body && body.hassUrl);
      const token = String((body && body.token) || '').trim();
      if (!hassUrl || !token) {
        json(res, 400, { ok: false, error: 'Both a URL and a token are required.' });
        return;
      }
      // validate against HA from the container (no CORS server-side)
      let r;
      try {
        r = await fetch(hassUrl + '/api/', { headers: { Authorization: `Bearer ${token}` } });
      } catch {
        json(res, 200, {
          ok: false,
          error: `Could not reach Home Assistant at ${hassUrl}. Check the URL (with http/https and port) and that HA is reachable from the dashboard container.`,
        });
        return;
      }
      if (r.status === 401 || r.status === 403) {
        json(res, 200, {
          ok: false,
          error: 'Home Assistant rejected the token. Create a fresh long-lived token (Profile → Security) and paste it exactly.',
        });
        return;
      }
      if (!r.ok) {
        json(res, 200, { ok: false, error: `Home Assistant returned ${r.status} for /api/.` });
        return;
      }
      await setConnection(hassUrl, token);
      json(res, 200, { ok: true });
      return;
    }
    res.writeHead(405).end('Method not allowed');
    return;
  }

  res.writeHead(404).end('Not found');
}
