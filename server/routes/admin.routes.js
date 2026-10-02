import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { readJson, readBody, sendJson, HttpError, clientIp } from '../lib/http.js';
import { rateLimiter } from '../lib/rateLimit.js';
import { login, logout, requireAuth, sessionCookie, listUsers, createUser, updateUser, changeOwnPassword } from '../services/auth.service.js';
import { getSettings, saveSettings } from '../services/settings.service.js';
import { storeStatus } from '../services/hours.service.js';
import { listOrders, updateStatus, getOrderById, adminOrderView, dashboard } from '../services/order.service.js';
import { listResource, createResource, updateResource, deleteResource, publicSchema } from '../admin/resources.js';
import { validateSettings } from '../admin/settings.validate.js';

const loginLimit = rateLimiter({ windowMs: 15 * 60_000, max: 10, message: 'Muitas tentativas de login. Aguarde 15 minutos.' });
const anyStaff = requireAuth('admin', 'staff');
const adminOnly = requireAuth('admin');

const IMAGE_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { ext: 'png', magic: (b) => b.slice(0, 4).toString('hex') === '89504e47' },
  'image/webp': { ext: 'webp', magic: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
};

export function registerAdminRoutes(r) {
  r.post('/api/admin/login', async ({ req, res }) => {
    loginLimit(clientIp(req, config.trustProxy));
    const body = await readJson(req, 5_000);
    const { token, user } = login(body.email, body.password);
    sendJson(req, res, 200, { user }, { 'Set-Cookie': sessionCookie(token, config.sessionTtlMs) });
  });

  r.post('/api/admin/logout', ({ req, res }) => {
    logout(req);
    sendJson(req, res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  });

  r.get('/api/admin/me', anyStaff, ({ req, res, user }) => sendJson(req, res, 200, { user, store: storeStatus() }));

  r.post('/api/admin/password', anyStaff, async ({ req, res, user }) => {
    const b = await readJson(req, 2_000);
    changeOwnPassword(user, b.current, b.next);
    sendJson(req, res, 200, { ok: true });
  });

  // Usuários do painel — somente admin
  r.get('/api/admin/users', adminOnly, ({ req, res }) => sendJson(req, res, 200, listUsers()));
  r.post('/api/admin/users', adminOnly, async ({ req, res }) => sendJson(req, res, 201, createUser(await readJson(req, 2_000))));
  r.patch('/api/admin/users/:id', adminOnly, async ({ req, res, params, user }) => sendJson(req, res, 200, updateUser(params.id, await readJson(req, 2_000), user)));

  // Pedidos — admin e funcionários
  r.get('/api/admin/orders', anyStaff, ({ req, res, query }) => {
    sendJson(req, res, 200, { orders: listOrders(Object.fromEntries(query)), dashboard: dashboard(), serverTime: new Date().toISOString() });
  });
  r.get('/api/admin/orders/:id', anyStaff, ({ req, res, params }) => {
    const o = getOrderById(Number(params.id));
    if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    sendJson(req, res, 200, adminOrderView(o));
  });
  r.patch('/api/admin/orders/:id/status', anyStaff, async ({ req, res, params, user }) => {
    const body = await readJson(req, 2_000);
    sendJson(req, res, 200, updateStatus(params.id, String(body.status || ''), user));
  });

  // Configurações — somente admin
  r.get('/api/admin/settings', adminOnly, ({ req, res }) => sendJson(req, res, 200, getSettings()));
  r.put('/api/admin/settings', adminOnly, async ({ req, res }) => {
    sendJson(req, res, 200, saveSettings(validateSettings(await readJson(req, 50_000))));
  });

  // Cadastros genéricos — somente admin
  r.get('/api/admin/schema', adminOnly, ({ req, res }) => sendJson(req, res, 200, publicSchema()));
  r.get('/api/admin/r/:res', adminOnly, ({ req, res, params }) => sendJson(req, res, 200, listResource(params.res)));
  r.post('/api/admin/r/:res', adminOnly, async ({ req, res, params }) => sendJson(req, res, 201, createResource(params.res, await readJson(req))));
  r.put('/api/admin/r/:res/:id', adminOnly, async ({ req, res, params }) => sendJson(req, res, 200, updateResource(params.res, params.id, await readJson(req))));
  r.delete('/api/admin/r/:res/:id', adminOnly, ({ req, res, params }) => { deleteResource(params.res, params.id); sendJson(req, res, 200, { ok: true }); });

  // Upload de imagens (corpo binário). Valida tipo pelo conteúdo, não só pelo cabeçalho.
  r.post('/api/admin/uploads', adminOnly, async ({ req, res }) => {
    const type = IMAGE_TYPES[(req.headers['content-type'] || '').split(';')[0]];
    if (!type) throw new HttpError(415, 'Envie uma imagem JPG, PNG ou WEBP.');
    const buf = await readBody(req, 5 * 1024 * 1024);
    if (!type.magic(buf)) throw new HttpError(415, 'O arquivo não é uma imagem válida.');
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${type.ext}`;
    fs.writeFileSync(path.join(config.uploadDir, name), buf);
    sendJson(req, res, 201, { url: `/uploads/${name}` });
  });
}
