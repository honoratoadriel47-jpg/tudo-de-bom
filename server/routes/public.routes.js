import { readJson, sendJson, HttpError, clientIp } from '../lib/http.js';
import { rateLimiter } from '../lib/rateLimit.js';
import { config } from '../config.js';
import { getCatalog } from '../services/catalog.service.js';
import { publicSettings } from '../services/settings.service.js';
import { storeStatus, scheduleSlots, hoursSummary } from '../services/hours.service.js';
import { quote, createOrder, getOrderByToken, publicOrderView } from '../services/order.service.js';

const orderLimit = rateLimiter({ windowMs: 10 * 60_000, max: 8, message: 'Você fez muitos pedidos em pouco tempo. Aguarde alguns minutos ou chame a gente no WhatsApp.' });
const quoteLimit = rateLimiter({ windowMs: 60_000, max: 120 });

function storeInfo() {
  const st = storeStatus();
  return { open: st.open, label: st.label, slots: scheduleSlots(), hours: hoursSummary() };
}

export function registerPublicRoutes(r) {
  r.get('/api/catalog', ({ req, res }) => sendJson(req, res, 200, { ...getCatalog(), settings: publicSettings(), store: storeInfo() }));

  r.get('/api/store', ({ req, res }) => sendJson(req, res, 200, storeInfo()));

  r.post('/api/orders/quote', async ({ req, res }) => {
    quoteLimit(clientIp(req, config.trustProxy));
    sendJson(req, res, 200, quote(await readJson(req, 50_000)));
  });

  r.post('/api/orders', async ({ req, res }) => {
    orderLimit(clientIp(req, config.trustProxy));
    const order = createOrder(await readJson(req, 50_000));
    sendJson(req, res, 201, publicOrderView(order));
  });

  r.get('/api/orders/:token', ({ req, res, params }) => {
    const o = getOrderByToken(params.token);
    if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    sendJson(req, res, 200, publicOrderView(o));
  });
}
