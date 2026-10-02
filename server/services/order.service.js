import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, row, rows, tx } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { Validator, normalizePhone, cleanText } from '../lib/validate.js';
import { priceCustom, bestPromotion, deliveryFee } from '../../public/js/shared/pricing.js';
import { loadPricingData } from './catalog.service.js';
import { getSettings } from './settings.service.js';
import { storeStatus, scheduleSlots } from './hours.service.js';
import { STATUS, flowFor, isFinal } from './status.js';
import { customerToStoreMessage, storeOrderMessage, storeToCustomerMessage, waLink } from './whatsapp.service.js';
import { notifyOrderEvent } from './notify.service.js';

const MAX_LINES = 30;
const MAX_QTY = 50;

/**
 * Recalcula TODO o pedido a partir do banco. Nenhum preço do cliente é usado.
 * strict=false é usado na prévia (quote), sem exigir dados pessoais.
 */
export function computeOrder(input, { strict = true } = {}) {
  const v = new Validator();
  const data = loadPricingData();
  const settings = getSettings();
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new HttpError(422, 'Seu carrinho está vazio.');
  if (items.length > MAX_LINES) throw new HttpError(422, `Máximo de ${MAX_LINES} itens diferentes por pedido.`);

  const lines = items.map((it, idx) => {
    const qty = v.int(`items.${idx}.qty`, it?.qty ?? 1, { min: 1, max: MAX_QTY, label: 'a quantidade' }) || 1;
    const note = cleanText(it?.note, 140);
    if (it?.kind === 'product') {
      const p = data.products.get(Number(it.productId));
      if (!p) throw new HttpError(422, 'Um dos produtos do carrinho não está mais disponível. Remova-o e tente de novo.');
      let flavor = '';
      if (p.flavors?.length) {
        flavor = String(it.flavor || '');
        if (!p.flavors.includes(flavor)) throw new HttpError(422, `Escolha um sabor válido para ${p.name}.`);
      }
      return { kind: 'product', ref_id: p.id, name: p.name, flavor, note, qty, details: [], unit_price_cents: p.price_cents, total_cents: p.price_cents * qty };
    }
    if (it?.kind === 'custom') {
      const size = data.sizes.get(Number(it.sizeId));
      if (!size) throw new HttpError(422, 'O tamanho escolhido não está mais disponível.');
      const ids = [...new Set((Array.isArray(it.addonIds) ? it.addonIds : []).map(Number))];
      const picks = ids.map((id) => {
        const a = data.addons.get(id);
        if (!a) throw new HttpError(422, 'Um dos ingredientes escolhidos acabou. Revise seu açaí.');
        const g = data.groups.get(a.group_id);
        return { ...a, groupId: g.id, groupName: g.name, counts_as_free: g.counts_as_free };
      });
      for (const g of data.groups.values()) {
        const n = picks.filter((p) => p.groupId === g.id).length;
        if (n < g.min_select) throw new HttpError(422, `Escolha ${g.min_select === 1 ? 'uma opção' : `${g.min_select} opções`} em "${g.name}".`);
        if (n > g.max_select) throw new HttpError(422, `Em "${g.name}" o máximo é ${g.max_select}.`);
      }
      const { unit, lines: det } = priceCustom(size, picks);
      return {
        kind: 'custom', ref_id: size.id, name: `Açaí ${size.name}`, flavor: '', note, qty,
        details: det.map((d) => ({ group: d.group, name: d.name, charged: d.charged, included: d.included })),
        unit_price_cents: unit, total_cents: unit * qty,
      };
    }
    throw new HttpError(422, 'Item inválido no carrinho.');
  });

  const subtotal = lines.reduce((s, l) => s + l.total_cents, 0);

  // Entrega
  const fulfillment = v.oneOf('fulfillment', input.fulfillment || 'delivery', ['delivery', 'pickup'], { label: 'a forma de entrega' });
  if (fulfillment === 'delivery' && !settings.delivery.enabled) v.fail('fulfillment', 'No momento estamos trabalhando só com retirada.');
  if (fulfillment === 'pickup' && !settings.delivery.pickupEnabled) v.fail('fulfillment', 'No momento estamos trabalhando só com delivery.');
  let zone = null;
  if (fulfillment === 'delivery' && (strict || input.zoneId)) {
    zone = data.zones.get(Number(input.zoneId)) || null;
    if (!zone) v.fail('zoneId', 'Escolha seu bairro.');
  }
  if (fulfillment === 'delivery' && subtotal < settings.delivery.minOrderCents) {
    v.fail('items', `O pedido mínimo para delivery é de R$ ${(settings.delivery.minOrderCents / 100).toFixed(2).replace('.', ',')}.`);
  }
  const fee = deliveryFee({ fulfillment, zone, subtotal, freeAboveCents: settings.delivery.freeAboveCents });

  // Promoção (a melhor aplicável, calculada no servidor)
  const st = storeStatus();
  const promo = bestPromotion(data.promotions, subtotal, { weekday: st.now.day, ymd: st.now.ymd });
  const discount = promo ? promo.value : 0;
  const total = Math.max(0, subtotal - discount + fee);

  // Tempo estimado
  const p = settings.prep;
  const extra = zone?.extra_minutes || 0;
  const eta = fulfillment === 'pickup' ? { min: p.pickupMin, max: p.pickupMax } : { min: p.deliveryMin + extra, max: p.deliveryMax + extra };

  const result = { lines, subtotal, fee, discount, promo, total, fulfillment, zone, eta, validator: v };
  if (!strict) v.assert();
  return result;
}

export function quote(input) {
  const r = computeOrder(input, { strict: false });
  return {
    lines: r.lines.map(({ name, flavor, qty, details, unit_price_cents, total_cents }) => ({ name, flavor, qty, details, unit_price_cents, total_cents })),
    subtotal_cents: r.subtotal, delivery_fee_cents: r.fee, discount_cents: r.discount,
    promo: r.promo, total_cents: r.total, eta: r.eta,
    freeDeliveryAboveCents: getSettings().delivery.freeAboveCents,
  };
}

export function createOrder(input) {
  const r = computeOrder(input, { strict: true });
  const v = r.validator;
  const settings = getSettings();
  const c = input.customer || {};
  const name = v.text('customer.name', c.name, { required: true, min: 2, max: 60, label: 'seu nome' });
  const phone = normalizePhone(c.phone);
  if (!phone) v.fail('customer.phone', 'Informe um WhatsApp válido com DDD.');

  let address = {};
  if (r.fulfillment === 'delivery') {
    const a = input.address || {};
    address = {
      street: v.text('address.street', a.street, { required: true, min: 3, max: 100, label: 'a rua' }),
      number: v.text('address.number', a.number, { required: true, max: 10, label: 'o número' }),
      complement: v.text('address.complement', a.complement, { max: 60 }),
      district: r.zone?.name || '',
      reference: v.text('address.reference', a.reference, { max: 100 }),
    };
  }

  const pay = input.payment || {};
  const enabled = Object.entries(settings.payments).filter(([, on]) => on).map(([k]) => k);
  const method = v.oneOf('payment.method', pay.method, enabled, { label: 'a forma de pagamento' });
  let changeFor = null;
  if (method === 'cash' && v.bool(pay.needsChange)) {
    changeFor = v.int('payment.changeFor', pay.changeFor, { required: true, min: 0, max: 1_000_000, label: 'o valor do troco' });
    if (changeFor !== null && changeFor !== undefined && changeFor <= r.total) v.fail('payment.changeFor', 'O troco precisa ser para um valor maior que o total.');
  }
  const notes = v.text('notes', input.notes, { max: 300, multiline: true });

  // Horário de funcionamento / agendamento
  const st = storeStatus();
  let scheduledFor = null;
  if (!st.open) {
    const slots = scheduleSlots();
    if (!slots.length) throw new HttpError(409, `Estamos fechados agora. ${st.label}.`);
    const slot = slots.find((s) => s.value === input.scheduledFor);
    if (!slot) v.fail('scheduledFor', 'Estamos fechados agora — escolha um horário para agendar.');
    else scheduledFor = slot.label;
  }
  v.assert();

  const token = crypto.randomBytes(12).toString('base64url');
  const order = tx(() => {
    db.prepare(`INSERT INTO customers(phone, name, orders_count, last_order_at) VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(phone) DO UPDATE SET name = excluded.name, orders_count = orders_count + 1, last_order_at = excluded.last_order_at`).run(phone, name);
    const customer = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
    const info = db.prepare(`INSERT INTO orders (public_token, status, customer_id, customer_name, customer_phone, fulfillment, address, zone_name,
      payment_method, change_for_cents, notes, subtotal_cents, delivery_fee_cents, discount_cents, total_cents, promo_title, eta_min, eta_max, scheduled_for)
      VALUES (?, 'NOVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      token, customer.id, name, phone, r.fulfillment, JSON.stringify(address), r.zone?.name || '',
      method, changeFor, notes, r.subtotal, r.fee, r.discount, r.total, r.promo?.title || '', r.eta.min, r.eta.max, scheduledFor,
    );
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE orders SET number = ? WHERE id = ?').run(1000 + id, id);
    const ins = db.prepare('INSERT INTO order_items (order_id, kind, ref_id, name, flavor, details, note, qty, unit_price_cents, total_cents) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const l of r.lines) ins.run(id, l.kind, l.ref_id, l.name, l.flavor, JSON.stringify(l.details), l.note, l.qty, l.unit_price_cents, l.total_cents);
    db.prepare("INSERT INTO order_status_history (order_id, status) VALUES (?, 'NOVO')").run(id);
    return getOrderById(id);
  });
  notifyOrderEvent('created', order);
  return order;
}

function hydrate(o) {
  if (!o) return null;
  o.items = rows(db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(o.id), ['details']);
  o.history = rows(db.prepare('SELECT status, at FROM order_status_history WHERE order_id = ? ORDER BY id').all(o.id));
  o.tracking_url = `${config.publicUrl}/pedido/${o.public_token}`;
  o.flow = flowFor(o.fulfillment);
  return o;
}

export const getOrderById = (id) => hydrate(row(db.prepare('SELECT * FROM orders WHERE id = ?').get(id), ['address']));
export const getOrderByToken = (t) => hydrate(row(db.prepare('SELECT * FROM orders WHERE public_token = ?').get(String(t).slice(0, 40)), ['address']));

/** Visão pública (para o cliente acompanhar) com links do WhatsApp. */
export function publicOrderView(o) {
  const settings = getSettings();
  return {
    number: o.number, token: o.public_token, status: o.status, statusLabel: STATUS[o.status]?.label,
    flow: o.flow, history: o.history, created_at: o.created_at, customer_name: o.customer_name,
    fulfillment: o.fulfillment, address: o.address, payment_method: o.payment_method, change_for_cents: o.change_for_cents,
    items: o.items.map(({ name, flavor, qty, details, note, total_cents }) => ({ name, flavor, qty, details, note, total_cents })),
    subtotal_cents: o.subtotal_cents, delivery_fee_cents: o.delivery_fee_cents, discount_cents: o.discount_cents,
    promo_title: o.promo_title, total_cents: o.total_cents, eta_min: o.eta_min, eta_max: o.eta_max, scheduled_for: o.scheduled_for,
    notes: o.notes, pixKey: o.payment_method === 'pix' ? settings.pixKey : '',
    whatsappUrl: waLink(settings.whatsapp, customerToStoreMessage(o)),
    storeWhatsappUrl: waLink(settings.whatsapp, `Olá! Tenho uma dúvida sobre o pedido #${o.number}.`),
  };
}

/** Visão completa para o painel. */
export function adminOrderView(o) {
  return {
    ...o,
    statusLabel: STATUS[o.status]?.label,
    productionMessage: storeOrderMessage(o),
    customerWhatsappUrl: waLink(o.customer_phone, storeToCustomerMessage(o)),
  };
}

export function listOrders({ status, q, date, limit = 100, since } = {}) {
  const where = [], args = [];
  if (status === 'ATIVOS') where.push("status NOT IN ('ENTREGUE','CANCELADO')");
  else if (status && STATUS[status]) { where.push('status = ?'); args.push(status); }
  if (q) {
    const term = cleanText(q, 60);
    const digits = term.replace(/\D/g, '');
    where.push('(customer_name LIKE ? OR CAST(number AS TEXT) = ?' + (digits ? ' OR customer_phone LIKE ?' : '') + ')');
    args.push(`%${term}%`, term.replace('#', ''));
    if (digits) args.push(`%${digits}%`);
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) { where.push("date(created_at, '-3 hours') = ?"); args.push(date); }
  if (since) { where.push('updated_at > ?'); args.push(String(since)); }
  const sql = `SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
  args.push(Math.min(Number(limit) || 100, 300));
  return rows(db.prepare(sql).all(...args), ['address']).map((o) => adminOrderView(hydrate(o)));
}

export function updateStatus(id, status, user) {
  if (!STATUS[status]) throw new HttpError(422, 'Status inválido.');
  const o = getOrderById(Number(id));
  if (!o) throw new HttpError(404, 'Pedido não encontrado.');
  if (o.status === status) return adminOrderView(o);
  if (isFinal(o.status) && user.role !== 'admin') throw new HttpError(403, 'Apenas o administrador pode reabrir um pedido finalizado.');
  if (status !== 'CANCELADO' && !o.flow.includes(status)) throw new HttpError(422, 'Esse status não se aplica a este tipo de pedido.');
  tx(() => {
    db.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(status, o.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, user_id) VALUES (?, ?, ?)').run(o.id, status, user.id);
  });
  const updated = getOrderById(o.id);
  notifyOrderEvent('status', updated);
  return adminOrderView(updated);
}

export function dashboard() {
  const today = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status != 'CANCELADO' THEN total_cents END),0) revenue
    FROM orders WHERE date(created_at, '-3 hours') = date('now', '-3 hours')`).get();
  const byStatus = rows(db.prepare(`SELECT status, COUNT(*) n FROM orders WHERE status NOT IN ('ENTREGUE','CANCELADO') GROUP BY status`).all());
  const last = db.prepare('SELECT MAX(id) id, MAX(number) number FROM orders').get();
  return { todayCount: today.n, todayRevenue: today.revenue, active: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), lastId: last.id || 0, lastNumber: last.number || 0 };
}
