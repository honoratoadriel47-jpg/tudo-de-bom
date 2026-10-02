import { h, icons } from '../../ui/dom.js';
import { brl } from '../../ui/format.js';
import { flyToCart } from '../../ui/motion.js';
import { toast } from '../../ui/toast.js';
import { addLine } from '../cart.js';
import { openProductSheet } from './productSheet.js';

const badgeClass = (b) => `badge badge--${b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`;

/** Adiciona direto ou abre a escolha de sabor. */
export function addProduct(p, fromEl) {
  if (p.flavors?.length) return openProductSheet(p);
  addLine({ kind: 'product', productId: p.id, qty: 1 });
  feedback(fromEl, p.image, `${p.name} no carrinho!`);
}

export function feedback(btn, image, message) {
  flyToCart(btn, image);
  toast(message, { icon: '🛒' });
  if (btn && btn.classList.contains('add-btn')) {
    const label = btn.innerHTML;
    btn.classList.add('is-added');
    btn.innerHTML = `${icons.check}<span>Adicionado</span>`;
    setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = label; }, 1400);
  }
}

export function productCard(p) {
  const btn = h('button', {
    class: 'add-btn', type: 'button',
    'aria-label': p.flavors?.length ? `Escolher sabor de ${p.name}` : `Adicionar ${p.name} ao carrinho`,
    html: `${icons.plus}<span>${p.flavors?.length ? 'Escolher' : 'Adicionar'}</span>`,
  });
  btn.addEventListener('click', () => addProduct(p, btn));
  return h('article', { class: 'pcard' },
    h('div', { class: 'pcard__media' },
      h('img', { src: p.image || '/assets/img/produtos/acai-copo.svg', alt: p.name, loading: 'lazy', decoding: 'async', width: 600, height: 450 }),
      p.badge && h('span', { class: badgeClass(p.badge) }, p.badge)),
    h('div', { class: 'pcard__body' },
      h('h3', {}, p.name),
      h('p', {}, p.description),
      h('div', { class: 'pcard__foot' },
        h('span', { class: 'price' }, brl(p.price_cents)),
        btn)));
}
