import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCustom, bestPromotion, deliveryFee } from '../public/js/shared/pricing.js';

const size = { price_cents: 1990, free_items: 2 };
const a = (id, price, extra = {}) => ({ id, name: `A${id}`, price_cents: price, groupId: 1, groupName: 'G', counts_as_free: 1, is_free: 0, ...extra });

test('cota de grátis vai para os itens mais caros', () => {
  const r = priceCustom(size, [a(1, 200), a(2, 450), a(3, 300)]);
  assert.equal(r.unit, 1990 + 200); // 450 e 300 inclusos
  assert.deepEqual(r.lines.map((l) => l.included), [false, true, true]);
});

test('grupos que não contam na cota (premium) são sempre cobrados', () => {
  const r = priceCustom(size, [a(1, 400, { counts_as_free: 0 }), a(2, 200)]);
  assert.equal(r.unit, 1990 + 400);
});

test('itens sempre grátis não consomem a cota', () => {
  const r = priceCustom(size, [a(1, 0, { is_free: 1 }), a(2, 300), a(3, 300), a(4, 250)]);
  assert.equal(r.unit, 1990 + 250);
});

test('melhor promoção respeita mínimo, dia da semana e período', () => {
  const promos = [
    { id: 1, title: '15%', active: 1, percent_off: 15, amount_off_cents: 0, min_subtotal_cents: 4000, weekdays: [2] },
    { id: 2, title: 'R$5', active: 1, percent_off: 0, amount_off_cents: 500, min_subtotal_cents: 6000, weekdays: [] },
    { id: 3, title: 'vencida', active: 1, percent_off: 50, amount_off_cents: 0, min_subtotal_cents: 0, weekdays: [], ends_at: '2020-01-01' },
  ];
  assert.equal(bestPromotion(promos, 5000, { weekday: 2, ymd: '2026-10-06' }).title, '15%');
  assert.equal(bestPromotion(promos, 5000, { weekday: 3, ymd: '2026-10-07' }), null);
  assert.equal(bestPromotion(promos, 7000, { weekday: 3, ymd: '2026-10-07' }).value, 500);
  assert.equal(bestPromotion(promos, 7000, { weekday: 2, ymd: '2026-10-06' }).value, 1050);
});

test('taxa de entrega: retirada, frete grátis e bairro', () => {
  const zone = { fee_cents: 600 };
  assert.equal(deliveryFee({ fulfillment: 'pickup', zone, subtotal: 1000, freeAboveCents: 8000 }), 0);
  assert.equal(deliveryFee({ fulfillment: 'delivery', zone, subtotal: 9000, freeAboveCents: 8000 }), 0);
  assert.equal(deliveryFee({ fulfillment: 'delivery', zone, subtotal: 3000, freeAboveCents: 8000 }), 600);
});
