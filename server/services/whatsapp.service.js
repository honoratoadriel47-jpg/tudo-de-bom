import { brl } from '../lib/money.js';
import { formatPhone } from '../lib/validate.js';
import { getSettings } from './settings.service.js';
import { PAYMENT_LABELS, STATUS } from './status.js';

const LINE = '━━━━━━━━━━━━━━━━━━';

export function waLink(phoneDigits, text) {
  const d = String(phoneDigits || '').replace(/\D/g, '');
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function itemsBlock(order, { prices = true } = {}) {
  return order.items.map((it) => {
    const head = `${it.qty}x ${it.name}${it.flavor ? ` (${it.flavor})` : ''}${prices ? ` — ${brl(it.total_cents)}` : ''}`;
    const details = (it.details || []).map((d) => `   • ${d.name}${prices && d.charged > 0 ? ` (+${brl(d.charged)})` : ''}`);
    const note = it.note ? [`   📝 ${it.note}`] : [];
    return [head, ...details, ...note].join('\n');
  }).join('\n\n');
}

function totalsBlock(o) {
  const out = [`💰 Subtotal: ${brl(o.subtotal_cents)}`];
  if (o.fulfillment === 'delivery') out.push(`🛵 Entrega: ${o.delivery_fee_cents ? brl(o.delivery_fee_cents) : 'Grátis'}`);
  if (o.discount_cents) out.push(`🎁 Desconto${o.promo_title ? ` (${o.promo_title})` : ''}: -${brl(o.discount_cents)}`);
  out.push(`💜 Total: ${brl(o.total_cents)}`);
  return out.join('\n');
}

function paymentText(o) {
  let t = PAYMENT_LABELS[o.payment_method] || o.payment_method;
  if (o.payment_method === 'cash') t += o.change_for_cents ? ` — troco para ${brl(o.change_for_cents)}` : ' — sem troco';
  return t;
}

function addressText(o) {
  if (o.fulfillment !== 'delivery') return '🏪 Retirada no balcão';
  const a = o.address || {};
  return [
    `${a.street}, nº ${a.number}`,
    a.complement && `Complemento: ${a.complement}`,
    `Bairro: ${a.district || o.zone_name}`,
    a.reference && `Referência: ${a.reference}`,
  ].filter(Boolean).join('\n');
}

const etaText = (o) => (o.scheduled_for ? `Agendado: ${o.scheduled_for}` : `${o.eta_min}–${o.eta_max} minutos`);

/** Mensagem completa de produção (formato da loja). */
export function storeOrderMessage(o) {
  const s = getSettings();
  return [
    LINE, `💜 ${s.storeName}`, `🧾 NOVO PEDIDO #${o.number}`, LINE, '',
    '👤 Cliente:', o.customer_name, '',
    '📱 WhatsApp:', formatPhone(o.customer_phone), '',
    `${o.fulfillment === 'delivery' ? '🛵 DELIVERY' : '🏪 RETIRADA NO LOCAL'}`, '',
    '🥣 PEDIDO:', '', itemsBlock(o), '',
    o.notes ? `📝 Observações:\n${o.notes}\n` : null,
    totalsBlock(o), '',
    '💳 Pagamento:', paymentText(o), '',
    o.fulfillment === 'delivery' ? '📍 ENDEREÇO:' : '📍 ENTREGA:', addressText(o), '',
    '⏱️ Tempo estimado:', etaText(o), '', LINE,
  ].filter((l) => l !== null).join('\n');
}

/** Mensagem que o CLIENTE envia para a loja ao finalizar (abre no WhatsApp dele). */
export function customerToStoreMessage(o) {
  const s = getSettings();
  return [
    `Olá! Meu pedido na ${s.storeName} foi realizado! 🍇💜`, '',
    storeOrderMessage(o), '',
    `Acompanhe: ${o.tracking_url}`,
  ].join('\n');
}

/** Confirmação/atualização que a LOJA envia para o cliente (botão no painel). */
export function storeToCustomerMessage(o) {
  const s = getSettings();
  const first = o.customer_name.split(' ')[0];
  const st = STATUS[o.status];
  const intro = {
    NOVO: `Olá, ${first}! Recebemos seu pedido #${o.number} na ${s.storeName} 💜`,
    EM_PREPARACAO: `Oba, ${first}! Seu pedido #${o.number} já está sendo preparado 👩‍🍳🍇`,
    PRONTO: o.fulfillment === 'pickup' ? `${first}, seu pedido #${o.number} está pronto para retirada! ✅` : `${first}, seu pedido #${o.number} está pronto e logo sai para entrega! ✅`,
    SAIU_PARA_ENTREGA: `${first}, seu pedido #${o.number} saiu para entrega! 🛵💨`,
    ENTREGUE: `Pedido #${o.number} entregue! Obrigado pela preferência, ${first} 💜 Bom apetite!`,
    CANCELADO: `${first}, seu pedido #${o.number} foi cancelado. Se tiver dúvidas, é só responder esta mensagem.`,
  }[o.status] || `${st?.emoji || ''} Pedido #${o.number}: ${st?.label}`;
  const body = o.status === 'NOVO'
    ? ['', itemsBlock(o, { prices: true }), '', totalsBlock(o), '', `💳 ${paymentText(o)}`, `⏱️ ${etaText(o)}`]
    : [];
  return [intro, ...body, '', `Acompanhe: ${o.tracking_url}`].join('\n');
}
