// Serves dist/ with Brotli/gzip and long-lived caching for /_astro/, like a production CDN.
// Local verification only: npm run serve:dist, then BASE=http://localhost:4322 npm run audit:lighthouse
import http from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import zlib from 'node:zlib'; import path from 'node:path';
const root = path.resolve(process.argv[2] || 'dist'); const port = Number(process.argv[3] || 4322);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.gz': 'application/gzip', '.ttf': 'font/ttf' };
const text = /\.(html|css|js|json|svg|xml|txt|webmanifest)$/;
http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let file = path.join(root, p);
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { try { await stat(file + '.html'); file += '.html'; } catch {} }
  let status = 200, body;
  try { body = await readFile(file); } catch { status = 404; file = path.join(root, '404.html'); body = await readFile(file); }
  const ext = path.extname(file); const headers = { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': file.includes('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  const ae = req.headers['accept-encoding'] || '';
  if (text.test(file) && /\bbr\b/.test(ae)) { body = zlib.brotliCompressSync(body); headers['Content-Encoding'] = 'br'; }
  else if (text.test(file) && /gzip/.test(ae)) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(status, headers); res.end(body);
}).listen(port, () => console.log('serving', root, 'on', port));
