import { createServer } from 'node:http';
import { serveStatic } from './static.mjs';
import { handleConfig } from './api.mjs';
import { proxyRest, attachWsProxy } from './ha-proxy.mjs';

const PORT = Number(process.env.PORT) || 80;

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  const handled =
    path.startsWith('/config/')
      ? handleConfig(req, res)
      : path.startsWith('/ha/')
        ? proxyRest(req, res)
        : serveStatic(req, res);
  Promise.resolve(handled).catch((err) => {
    console.error('request failed', err);
    if (!res.headersSent) res.writeHead(500);
    res.end('Server error');
  });
});

// /ha/api/websocket upgrades are handled here
attachWsProxy(server);

server.listen(PORT, () => {
  console.log(`oranjehuis server listening on :${PORT}`);
});
