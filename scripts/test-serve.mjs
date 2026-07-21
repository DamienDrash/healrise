// Kombinierter Static+Proxy-Server für Browser-Tests (spiegelt die Caddy-Prod-Route).
// Landing (dist/) unter /  ·  App (app/dist/) unter /healrise/app/  ·  API-Proxy → Strapi 9130.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = '/opt/healrise';
const LANDING = join(ROOT, 'dist');
const APP = join(ROOT, 'app/dist');
const APP_BASE = '/healrise/app';
const STRAPI = { host: '127.0.0.1', port: 9130 };
const PORT = Number(process.argv[2] || 5197);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.map': 'application/json',
};

// Prod-Security-Header (identisch zu deploy/caddy/healrise-security-headers.caddy)
function secHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
}

function proxyApi(req, res) {
  const upstreamPath = req.url.replace(APP_BASE, ''); // /healrise/app/api/x -> /api/x
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers, host: `${STRAPI.host}:${STRAPI.port}` };
    const preq = http.request(
      { host: STRAPI.host, port: STRAPI.port, path: upstreamPath, method: req.method, headers },
      pres => { res.writeHead(pres.statusCode, pres.headers); pres.pipe(res); }
    );
    preq.on('error', e => { res.writeHead(502); res.end('proxy error: ' + e.message); });
    if (body.length) preq.write(body);
    preq.end();
  });
}

async function sendFile(res, filePath, status = 200) {
  const data = await readFile(filePath);
  res.writeHead(status, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
  res.end(data);
}

async function tryFile(p) { try { const s = await stat(p); return s.isFile() ? p : null; } catch { return null; } }

const server = http.createServer(async (req, res) => {
  secHeaders(res);
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url.startsWith(`${APP_BASE}/api`)) return proxyApi(req, res);

  // App unter /healrise/app/
  if (url === APP_BASE || url.startsWith(`${APP_BASE}/`)) {
    let rel = url.slice(APP_BASE.length) || '/';
    if (rel === '/' || rel === '') rel = '/index.html';
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
    let file = await tryFile(join(APP, safe));
    if (!file) file = join(APP, 'index.html'); // SPA-Fallback
    return sendFile(res, file);
  }

  // Landing unter /
  let rel = url === '/' ? '/index.html' : url;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  let file = await tryFile(join(LANDING, safe));
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404</h1>'); }
  return sendFile(res, file);
});

server.listen(PORT, '127.0.0.1', () => console.log(`test-serve on http://127.0.0.1:${PORT} (landing / · app ${APP_BASE}/ · api→${STRAPI.port})`));
