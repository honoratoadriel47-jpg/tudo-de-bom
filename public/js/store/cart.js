import { state, emit } from './state.js';
import { priceCustom } from '../shared/pricing.js';

/**
 * Carrinho no navegador. Guarda só IDs e quantidades — nomes e preços vêm do catálogo
 * e o valor final é SEMPRE recalculado pelo servidor.
 */
const KEY = 'tdb-cart-v1';
let lines = [];

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* modo privado */ }
  emit('cart', { lines });
}

export function loadCart() {
  try { lines = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { lines = []; }
  const before = lines.length;
  lines = lines.filter((l) => describe(l).available);
  if (lines.length !== before) save();
  emit('cart', { lines });
  return before - lines.length;
}

const keyOf = (l) => l.kind === 'product'
  ? `p:${l.productId}:${l.flavor || ''}:${l.note || ''}`
  : `c:${l.sizeId}:${[...l.addonIds].sort((a, b) => a - b).join('.')}:${l.note || ''}`;

export function addLine(line) {
  const l = { ...line, qty: line.qty || 1 };
  l.key = keyOf(l);
  const found = lines.find((x) => x.key === l.key);
  if (found) found.qty = Math.min(50, found.qty + l.qty);
  else lines.push(l);
  save();
  return l.key;
}

export function setQty(key, qty) {
  const l = lines.find((x) => x.key === key);
  if (!l) return;
  if (qty <= 0) lines = lines.filter((x) => x.key !== key);
  else l.qty = Math.min(50, qty);
  save();
}

export const removeLine = (key) => setQty(key, 0);
export function clearCart() { lines = []; save(); }
export const getLines = () => lines;
export const count = () => lines.reduce((s, l) => s + l.qty, 0);

/** Dados de exibição de uma linha a partir do catálogo atual. */
export function describe(l) {
  const c = state.catalog;
  if (!c) return { available: false };
  if (l.kind === 'product') {
    const p = c.productById.get(l.productId);
    if (!p) return { available: false };
    if (p.flavors?.length && !p.flavors.includes(l.flavor)) return { available: false };
    return { available: true, name: p.name, image: p.image, details: l.flavor ? [`Sabor: ${l.flavor}`] : [], unit: p.price_cents, total: p.price_cents * l.qty };
  }
  const size = c.sizeById.get(l.sizeId);
  const picks = l.addonIds.map((id) => c.addonById.get(id));
  if (!size || picks.some((p) => !p)) return { available: false };
  const { unit, lines: det } = priceCustom(size, picks);
  return { available: true, name: `Açaí ${size.name}`, image: size.image, details: det.map((d) => d.name), unit, total: unit * l.qty };
}

export const subtotal = () => lines.reduce((s, l) => s + (describe(l).total || 0), 0);

/** Formato aceito pela API. */
export const toPayload = () => lines.map((l) => l.kind === 'product'
  ? { kind: 'product', productId: l.productId, flavor: l.flavor || '', qty: l.qty, note: l.note || '' }
  : { kind: 'custom', sizeId: l.sizeId, addonIds: l.addonIds, qty: l.qty, note: l.note || '' });
