import { config } from '../config.js';
import { getSettings } from './settings.service.js';
import { storeOrderMessage } from './whatsapp.service.js';

/**
 * Ponto único de notificação de pedidos. Hoje: log + webhook opcional + WhatsApp Cloud API opcional.
 * Futuro: impressora térmica, push, e-mail — basta adicionar aqui.
 */
export function notifyOrderEvent(event, order) {
  console.log(`[pedido] ${event} #${order.number} — ${order.status} — ${order.customer_name}`);
  if (config.webhookUrl) {
    fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, order }),
      signal: AbortSignal.timeout(5000),
    }).catch((e) => console.warn('[webhook] falhou:', e.message));
  }
  if (event === 'created' && config.whatsappCloud.token && config.whatsappCloud.phoneId) {
    const to = getSettings().whatsapp.replace(/\D/g, '');
    fetch(`https://graph.facebook.com/v20.0/${config.whatsappCloud.phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.whatsappCloud.token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: storeOrderMessage(order) } }),
      signal: AbortSignal.timeout(8000),
    }).catch((e) => console.warn('[whatsapp-cloud] falhou:', e.message));
  }
}
