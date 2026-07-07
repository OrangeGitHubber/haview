import { Readable } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { getConnection } from './config-store.mjs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
]);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

/**
 * Reverse-proxy an HTTP request under /ha/api/* to Home Assistant, injecting
 * the stored bearer token. Only /api/* paths on the configured host are
 * allowed (no open proxy).
 */
export async function proxyRest(req, res) {
  const conn = await getConnection();
  if (!conn) {
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Home Assistant not configured');
    return;
  }
  const path = (req.url || '').slice('/ha'.length); // e.g. /api/states...
  // allow HA's API plus its public /local/ static folder (background images)
  if (!path.startsWith('/api/') && !path.startsWith('/local/')) {
    res.writeHead(404).end('Not found');
    return;
  }

  const headers = { Authorization: `Bearer ${conn.token}` };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['accept']) headers['Accept'] = req.headers['accept'];
  if (req.headers['range']) headers['Range'] = req.headers['range'];

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);

  let upstream;
  try {
    upstream = await fetch(conn.hassUrl + path, { method: req.method, headers, body });
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Home Assistant unreachable');
    return;
  }

  const outHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders[key] = value;
  });
  res.writeHead(upstream.status, outHeaders);
  if (upstream.body) {
    Readable.fromWeb(upstream.body).pipe(res);
  } else {
    res.end();
  }
}

/**
 * WebSocket reverse proxy for /ha/api/websocket. The proxy owns the real HA
 * auth handshake with the stored token; toward the browser it emulates HA's
 * handshake (accepting any token) and then relays messages verbatim, so the
 * token never leaves the server. One dedicated HA socket per browser socket.
 */
export function attachWsProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url || '').split('?')[0];
    if (path !== '/ha/api/websocket') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (browserWs) => {
      bridge(browserWs).catch(() => browserWs.close());
    });
  });
}

async function bridge(browserWs) {
  const conn = await getConnection();
  if (!conn) {
    browserWs.close();
    return;
  }
  const haUrl = conn.hassUrl.replace(/^http/i, 'ws') + '/api/websocket';
  const haWs = new WebSocket(haUrl);

  let haAuthed = false;
  let browserAuthed = false;
  let haVersion = '';

  const closeBoth = () => {
    try {
      browserWs.close();
    } catch {
      /* ignore */
    }
    try {
      haWs.close();
    } catch {
      /* ignore */
    }
  };

  haWs.on('message', (data) => {
    const text = data.toString();
    if (!haAuthed) {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.type === 'auth_required') {
        haWs.send(JSON.stringify({ type: 'auth', access_token: conn.token }));
      } else if (msg.type === 'auth_ok') {
        haAuthed = true;
        haVersion = msg.ha_version || '';
        // begin the emulated handshake toward the browser
        browserWs.send(JSON.stringify({ type: 'auth_required', ha_version: haVersion }));
      } else if (msg.type === 'auth_invalid') {
        closeBoth();
      }
      return;
    }
    if (browserWs.readyState === WebSocket.OPEN) browserWs.send(text);
  });

  browserWs.on('message', (data) => {
    const text = data.toString();
    if (!browserAuthed) {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.type === 'auth') {
        // ignore the browser's dummy token — the proxy already authed to HA
        browserAuthed = true;
        browserWs.send(JSON.stringify({ type: 'auth_ok', ha_version: haVersion }));
      }
      return;
    }
    if (haWs.readyState === WebSocket.OPEN) haWs.send(text);
  });

  browserWs.on('close', closeBoth);
  browserWs.on('error', closeBoth);
  haWs.on('close', closeBoth);
  haWs.on('error', closeBoth);
}
