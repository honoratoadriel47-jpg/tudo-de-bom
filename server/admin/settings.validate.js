import { Validator } from '../lib/validate.js';
import { getSettings } from '../services/settings.service.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida a edição das configurações gerais da loja. */
export function validateSettings(input) {
  const v = new Validator();
  const cur = getSettings();
  const out = {};
  if ('storeName' in input) out.storeName = v.text('storeName', input.storeName, { required: true, max: 40, label: 'o nome da loja' });
  if ('tagline' in input) out.tagline = v.text('tagline', input.tagline, { max: 120 });
  if ('instagram' in input) out.instagram = v.text('instagram', input.instagram, { max: 40 }).replace(/^@/, '');
  if ('mapsUrl' in input) {
    const u = v.text('mapsUrl', input.mapsUrl, { max: 300 });
    out.mapsUrl = /^https:\/\//.test(u) || !u ? u : v.fail('mapsUrl', 'O link do mapa deve começar com https://') ?? '';
  }
  if ('pixKey' in input) out.pixKey = v.text('pixKey', input.pixKey, { max: 100 });
  if ('logo' in input) {
    const l = String(input.logo || '');
    out.logo = /^\/(uploads|assets)\/[\w\-./]+$/.test(l) ? l : v.fail('logo', 'Logo inválida.') ?? cur.logo;
  }
  if ('whatsapp' in input) {
    let d = String(input.whatsapp || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    if (!/^55\d{10,11}$/.test(d)) v.fail('whatsapp', 'Informe o WhatsApp da loja com DDD. Ex.: (27) 99999-9999');
    out.whatsapp = d;
  }
  if ('manualStatus' in input) out.manualStatus = v.oneOf('manualStatus', input.manualStatus, ['auto', 'open', 'closed']);
  if ('address' in input) {
    const a = input.address || {};
    out.address = {
      street: v.text('address.street', a.street, { max: 100 }), number: v.text('address.number', a.number, { max: 10 }),
      district: v.text('address.district', a.district, { max: 60 }), city: v.text('address.city', a.city, { max: 60 }),
      reference: v.text('address.reference', a.reference, { max: 100 }),
    };
  }
  if ('hours' in input) {
    const h = Array.isArray(input.hours) ? input.hours : [];
    if (h.length !== 7) v.fail('hours', 'Informe os 7 dias da semana.');
    out.hours = h.map((d, i) => {
      if (!HHMM.test(d?.open) || !HHMM.test(d?.close)) v.fail(`hours.${i}`, 'Horário inválido (use HH:MM).');
      return { closed: !!d?.closed, open: d?.open, close: d?.close };
    });
  }
  if ('prep' in input) {
    const p = input.prep || {};
    const n = (k) => v.int(`prep.${k}`, p[k], { required: true, min: 0, max: 600, label: 'o tempo' });
    out.prep = { pickupMin: n('pickupMin'), pickupMax: n('pickupMax'), deliveryMin: n('deliveryMin'), deliveryMax: n('deliveryMax') };
    if (out.prep.pickupMin > out.prep.pickupMax || out.prep.deliveryMin > out.prep.deliveryMax) v.fail('prep', 'O tempo mínimo não pode ser maior que o máximo.');
  }
  if ('payments' in input) {
    const p = input.payments || {};
    out.payments = { pix: !!p.pix, cash: !!p.cash, credit: !!p.credit, debit: !!p.debit };
    if (!Object.values(out.payments).some(Boolean)) v.fail('payments', 'Deixe pelo menos uma forma de pagamento ativa.');
  }
  if ('delivery' in input) {
    const d = input.delivery || {};
    out.delivery = {
      enabled: !!d.enabled, pickupEnabled: !!d.pickupEnabled,
      minOrderCents: v.int('delivery.minOrderCents', d.minOrderCents ?? 0, { min: 0, max: 1_000_000 }) ?? 0,
      freeAboveCents: v.int('delivery.freeAboveCents', d.freeAboveCents ?? 0, { min: 0, max: 1_000_000 }) ?? 0,
    };
    if (!out.delivery.enabled && !out.delivery.pickupEnabled) v.fail('delivery', 'Ative delivery, retirada ou ambos.');
  }
  if ('scheduling' in input) {
    const s = input.scheduling || {};
    out.scheduling = { allowWhenClosed: !!s.allowWhenClosed, slotMinutes: v.int('scheduling.slotMinutes', s.slotMinutes ?? 30, { min: 15, max: 120 }) ?? 30 };
  }
  v.assert();
  return out;
}
