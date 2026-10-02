import { h, replace, icons } from '../../ui/dom.js';
import { brl, plural } from '../../ui/format.js';
import { bump, animateNumber } from '../../ui/motion.js';
import { openPanel } from '../../ui/overlay.js';
import { bestPromotion } from '../../shared/pricing.js';
import { state, on } from '../state.js';
import { getLines, describe, setQty, removeLine, subtotal, count } from '../cart.js';
import { openCheckout } from './checkout.js';

/** Data de hoje no fuso da loja (para prever promoções por dia da semana). */
export function storeToday() {
  const tz = state.settings?.timezone || 'America/Sao_Paulo';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { weekday, ymd: `${p.year}-${p.month}-${p.day}` };
}

/** Prévia local (o servidor confirma no checkout). */
export function localTotals() {
  const sub = subtotal();
  const promo = bestPromotion(state.catalog.promotions, sub, storeToday());
  return { sub, promo, discount: promo?.value || 0 };
}

let isOpen = false;
let lastGrand = 0;

export function openCart() {
  if (isOpen) return;
  isOpen = true;
  const body = h('div', { class: 'panel__body' });
  const foot = h('div', { class: 'panel__foot' });
  const title = h('h2', { id: 'cart-title' }, 'Seu pedido');
  const panel = h('aside', { class: 'panel panel--side' },
    h('div', { class: 'panel__head' }, title,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar carrinho', html: icons.close, onclick: () => close() })),
    body, foot);

  const render = () => {
    const lines = getLines();
    if (!lines.length) {
      replace(body, h('div', { class: 'cart-empty' },
        h('div', { class: 'cart-empty__bowl', 'aria-hidden': 'true' }, '🥣'),
        h('h3', {}, 'Seu carrinho está vazio'),
        h('p', {}, 'Que tal começar montando um açaí do seu jeito?'),
        h('a', { class: 'btn', href: '/monte-seu-acai', 'data-nav': 'monte-seu-acai', onclick: () => close() }, 'Monte seu açaí')));
      replace(foot);
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    replace(body, h('ul', { class: 'cart-items', 'aria-label': 'Itens no carrinho' }, lines.map(itemRow)), freeDelivery());
    replace(foot, totals());
  };

  const itemRow = (l) => {
    const d = describe(l);
    const out = h('output', { 'aria-live': 'polite', 'aria-label': 'Quantidade' }, l.qty);
    const li = h('li', { class: 'cart-item', 'data-key': l.key },
      h('img', { src: d.image || '/assets/img/produtos/acai-copo.svg', alt: '', loading: 'lazy', width: 64, height: 64 }),
      h('div', {},
        h('div', { class: 'cart-item__top' },
          h('h4', {}, d.name),
          h('button', { class: 'remove', type: 'button', 'aria-label': `Remover ${d.name}`, html: icons.trash, onclick: () => remove(li, l.key) })),
        d.details.length > 0 && h('ul', { class: 'cart-item__details' }, d.details.map((x) => h('li', {}, x))),
        l.note && h('p', { class: 'cart-item__note' }, `Obs.: ${l.note}`),
        h('div', { class: 'cart-item__bottom' },
          h('div', { class: 'qty' },
            h('button', { type: 'button', 'aria-label': `Diminuir ${d.name}`, onclick: () => (l.qty === 1 ? remove(li, l.key) : (setQty(l.key, l.qty - 1), bump(body.querySelector(`[data-key="${CSS.escape(l.key)}"] output`)))) }, '−'),
            out,
            h('button', { type: 'button', 'aria-label': `Aumentar ${d.name}`, onclick: () => { setQty(l.key, l.qty + 1); bump(body.querySelector(`[data-key="${CSS.escape(l.key)}"] output`)); } }, '+')),
          h('span', { class: 'price' }, brl(d.total)))));
    return li;
  };

  const remove = (li, key) => {
    li.classList.add('is-removing');
    setTimeout(() => removeLine(key), 280);
  };

  const freeDelivery = () => {
    const free = state.settings.delivery.freeAboveCents;
    if (!free || !state.settings.delivery.enabled) return null;
    const sub = subtotal();
    const missing = free - sub;
    return h('div', { class: 'progress-free', style: { marginTop: '18px' } },
      missing > 0 ? h('span', {}, 'Faltam ', h('b', {}, brl(missing)), ' para o frete grátis 🛵') : h('b', {}, '🎉 Você ganhou frete grátis!'),
      h('div', { class: 'progress-free__bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, Math.round((sub / free) * 100)) },
        h('span', { style: { width: `${Math.min(100, (sub / free) * 100)}%` } })));
  };

  const totals = () => {
    const { sub, promo, discount } = localTotals();
    const grand = h('dd', { 'data-value': lastGrand });
    const dl = h('dl', { class: 'totals' },
      h('div', {}, h('dt', {}, `Subtotal (${plural(count(), 'item', 'itens')})`), h('dd', {}, brl(sub))),
      discount > 0 && h('div', { class: 'discount' }, h('dt', {}, `🏷️ ${promo.title}`), h('dd', {}, `− ${brl(discount)}`)),
      h('div', {}, h('dt', {}, 'Entrega'), h('dd', {}, !state.settings.delivery.enabled ? 'retirada' : state.settings.delivery.freeAboveCents && sub >= state.settings.delivery.freeAboveCents ? 'Grátis 🎉' : 'calculada no próximo passo')),
      h('div', { class: 'grand' }, h('dt', {}, 'Total'), grand));
    animateNumber(grand, sub - discount, brl);
    lastGrand = sub - discount;
    const go = h('button', { class: 'btn btn--grape btn--block', type: 'button', style: { marginTop: '14px' }, onclick: () => openCheckout() }, 'Finalizar pedido');
    return [dl, go];
  };

  render();
  const off = onCart(render);
  const close = openPanel({ panel, label: 'Carrinho', onClose: () => { isOpen = false; off(); } });
}

/** Inscrição removível no evento 'cart'. */
const listeners = new Set();
on('cart', () => listeners.forEach((fn) => fn()));
function onCart(fn) { listeners.add(fn); return () => listeners.delete(fn); }
