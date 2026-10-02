import { db } from '../db/database.js';

/** Valores padrão — também documentam o formato de cada configuração. */
export const DEFAULT_SETTINGS = {
  storeName: 'TUDO DE BOM',
  tagline: 'Açaí cremoso, montado do seu jeito.',
  whatsapp: '5511999999999', // ← TROQUE pelo WhatsApp real da loja (painel → Configurações)
  instagram: 'tudodebom',
  logo: '/assets/brand/logo.webp',
  address: { street: 'Rua Exemplo', number: '123', district: 'Centro', city: 'Sua Cidade', reference: '' },
  mapsUrl: '',
  timezone: 'America/Sao_Paulo',
  manualStatus: 'auto', // auto | open | closed
  hours: [
    { closed: false, open: '14:00', close: '23:00' }, // domingo
    { closed: true, open: '14:00', close: '22:30' },  // segunda
    { closed: false, open: '14:00', close: '22:30' },
    { closed: false, open: '14:00', close: '22:30' },
    { closed: false, open: '14:00', close: '22:30' },
    { closed: false, open: '14:00', close: '23:30' },
    { closed: false, open: '13:00', close: '23:30' }, // sábado
  ],
  prep: { pickupMin: 15, pickupMax: 25, deliveryMin: 30, deliveryMax: 45 },
  payments: { pix: true, cash: true, credit: true, debit: true },
  pixKey: '',
  delivery: { enabled: true, pickupEnabled: true, minOrderCents: 1500, freeAboveCents: 8000 },
  scheduling: { allowWhenClosed: true, slotMinutes: 30 },
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[r.key] = JSON.parse(r.value); } catch { /* ignora valor corrompido */ }
  }
  cache = out;
  return out;
}

export function saveSettings(partial) {
  const up = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(partial)) if (k in DEFAULT_SETTINGS) up.run(k, JSON.stringify(v));
  cache = null;
  return getSettings();
}

/** Somente o que pode ir para o navegador do cliente. */
export function publicSettings() {
  const s = getSettings();
  return {
    storeName: s.storeName, tagline: s.tagline, whatsapp: s.whatsapp, instagram: s.instagram, logo: s.logo,
    address: s.address, mapsUrl: s.mapsUrl, hours: s.hours, prep: s.prep, payments: s.payments,
    pixKey: s.pixKey, delivery: s.delivery, scheduling: s.scheduling,
  };
}
