/**
 * Minimal static server for local development: node scripts/serve.mjs [port]
 * The application itself needs no server; any static host will do.
 */

import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * /api is served by the optional Python service (backend/app.py). Without it,
 * answer 204 so the frontend probe stays quiet instead of logging a 404.
 */
function proxyApi(url, response) {
  const target = httpRequest(
    {
      host: '127.0.0.1', port: 8000, path: url.pathname + url.search, method: 'GET',
      headers: { accept: 'application/json' },
    },
    (upstream) => {
      const chunks = [];
      upstream.on('data', (chunk) => chunks.push(chunk));
      upstream.on('end', () => {
        response.writeHead(upstream.statusCode || 502, {
          'content-type': upstream.headers['content-type'] || 'application/json',
          'cache-control': 'no-store',
        });
        response.end(Buffer.concat(chunks));
      });
    },
  );
  target.on('error', () => {
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
  });
  target.setTimeout(1500, () => target.destroy());
  target.end();
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      proxyApi(url, response);
      return;
    }
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    const info = await stat(file).catch(() => null);
    if (info && info.isDirectory()) {
      file = join(root, 'index.html');
    } else if (!info) {
      // Route paths fall back to the SPA shell; real files must 404, so a
      // missing asset is never silently served as HTML.
      if (extname(file)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end(`404 ${path}`);
        return;
      }
      file = join(root, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`404 ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CLPS browser on http://127.0.0.1:${port}`);
});
