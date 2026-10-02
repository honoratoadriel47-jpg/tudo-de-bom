import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db/database.js';
import { seed } from './db/seed.js';
import { Router } from './lib/router.js';
import { send, sendError, sendJson, HttpError } from './lib/http.js';
import { ensureUser } from './services/auth.service.js';
import { getSettings } from './services/settings.service.js';
import { registerPublicRoutes } from './routes/public.routes.js';
import { registerAdminRoutes } from './routes/admin.routes.js';

// Primeira execução: popula dados de exemplo e cria usuários do painel
if (!db.prepare('SELECT COUNT(*) n FROM categories').get().n) seed();
ensureUser({ email: config.admin.email, password: config.admin.password, name: 'Administrador', role: 'admin' });
ensureUser({ email: config.staff.email, password: config.staff.password, name: 'Funcionário', role: 'staff' });
if (config.isProd && config.admin.password === 'troque-esta-senha') console.warn('⚠️  ADMIN_PASSWORD padrão em produção! Troque no .env.');

const router = new Router();
registerPublicRoutes(router);
registerAdminRoutes(router);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; '),
};

// Páginas da loja (URLs amigáveis) — todas servem o mesmo app, que rola até a seção certa
const STORE_PAGES = /^\/(|cardapio|monte-seu-acai|promocoes|galeria|pedido\/[\w-]+)\/?$/;

function storeHtml() {
  const s = getSettings();
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'IceCreamShop', name: `${s.storeName} — Açaiteria`,
    url: config.publicUrl, image: `${config.publicUrl}/assets/brand/og-image.jpg`, servesCuisine: ['Açaí', 'Sorvete'],
    telephone: `+${s.whatsapp}`, priceRange: '$$',
    address: { '@type': 'PostalAddress', streetAddress: `${s.address.street}, ${s.address.number}`, addressLocality: s.address.city, addressCountry: 'BR' },
    openingHoursSpecification: s.hours.map((h, i) => h.closed ? null : ({ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i], opens: h.open, closes: h.close })).filter(Boolean),
  };
  return fs.readFileSync(path.join(config.publicDir, 'index.html'), 'utf8')
    .replace('<!--JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`)
    .replaceAll('{{PUBLIC_URL}}', config.publicUrl);
}

function serveFile(req, res, baseDir, rel, cache) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir + path.sep)) throw new HttpError(404, 'Não encontrado.');
  let stat;
  try { stat = fs.statSync(file); } catch { throw new HttpError(404, 'Não encontrado.'); }
  if (!stat.isFile()) throw new HttpError(404, 'Não encontrado.');
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const etag = `W/"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
  send(req, res, 200, fs.readFileSync(file), { 'Content-Type': type, 'Cache-Control': cache, ETag: etag, ...SECURITY_HEADERS });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      const m = router.match(req.method, pathname);
      if (!m) throw new HttpError(404, 'Rota não encontrada.');
      if (m.methodNotAllowed) throw new HttpError(405, 'Método não permitido.');
      const ctx = { req, res, params: m.params, query: url.searchParams };
      for (const h of m.handlers) await h(ctx);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método não permitido.');
    if (STORE_PAGES.test(pathname)) {
      return send(req, res, 200, storeHtml(), { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/') && !path.extname(pathname)) {
      return serveFile(req, res, config.publicDir, 'admin/index.html', 'no-cache');
    }
    if (pathname.startsWith('/uploads/')) return serveFile(req, res, config.uploadDir, pathname.slice('/uploads/'.length), 'public, max-age=604800');
    const cache = /\.(png|jpe?g|webp|svg|ico)$/.test(pathname) ? 'public, max-age=604800' : 'public, max-age=300';
    return serveFile(req, res, config.publicDir, decodeURIComponent(pathname), cache);
  } catch (err) {
    if (pathname.startsWith('/api/')) return sendError(req, res, err);
    if (err instanceof HttpError && err.status === 404) {
      return send(req, res, 404, fs.readFileSync(path.join(config.publicDir, '404.html')), { 'Content-Type': MIME['.html'], ...SECURITY_HEADERS });
    }
    if (!res.headersSent) sendJson(req, res, err.status || 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  console.log(`💜 TUDO DE BOM rodando em ${config.publicUrl}`);
  console.log(`   Loja:   ${config.publicUrl}/`);
  console.log(`   Painel: ${config.publicUrl}/admin`);
});

export default server;
