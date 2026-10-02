/**
 * Regras de preço COMPARTILHADAS entre navegador e servidor.
 * O navegador usa para mostrar o preço em tempo real; o servidor usa a MESMA regra
 * com dados do banco para recalcular tudo — valores enviados pelo cliente são ignorados.
 * Todos os valores em centavos.
 */

/**
 * Preço de um açaí montado.
 * Cada tamanho dá direito a `free_items` ingredientes grátis; entram na cota apenas grupos
 * com `counts_as_free`. A cota é aplicada aos itens mais caros (melhor para o cliente).
 */
export function priceCustom(size, picks) {
  const lines = picks.map((p) => ({ id: p.id, group: p.groupName, groupId: p.groupId, name: p.name, price: p.price_cents, free: !!p.is_free, included: false }));
  const eligible = lines
    .filter((l, i) => !l.free && picks[i].counts_as_free)
    .sort((a, b) => b.price - a.price || a.id - b.id);
  eligible.slice(0, Math.max(0, size.free_items || 0)).forEach((l) => (l.included = true));
  let unit = size.price_cents;
  for (const l of lines) {
    l.charged = l.free || l.included ? 0 : l.price;
    unit += l.charged;
  }
  return { unit, lines };
}

/** Promoção ativa que gera o maior desconto para o subtotal. */
export function bestPromotion(promos, subtotal, { weekday, ymd }) {
  let best = null;
  for (const p of promos) {
    if (!p.active) continue;
    if (p.starts_at && ymd < p.starts_at) continue;
    if (p.ends_at && ymd > p.ends_at) continue;
    const days = Array.isArray(p.weekdays) ? p.weekdays : [];
    if (days.length && !days.includes(weekday)) continue;
    if (subtotal < (p.min_subtotal_cents || 0)) continue;
    const value = Math.min(subtotal, Math.round((subtotal * (p.percent_off || 0)) / 100) + (p.amount_off_cents || 0));
    if (value > 0 && (!best || value > best.value)) best = { id: p.id, title: p.title, value };
  }
  return best;
}

export function deliveryFee({ fulfillment, zone, subtotal, freeAboveCents }) {
  if (fulfillment !== 'delivery' || !zone) return 0;
  if (freeAboveCents > 0 && subtotal >= freeAboveCents) return 0;
  return zone.fee_cents;
}
