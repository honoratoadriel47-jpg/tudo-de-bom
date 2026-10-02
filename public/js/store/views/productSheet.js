import { h, icons } from '../../ui/dom.js';
import { brl } from '../../ui/format.js';
import { bump } from '../../ui/motion.js';
import { openPanel } from '../../ui/overlay.js';
import { addLine } from '../cart.js';
import { feedback } from './products.js';

/** Folha para escolher sabor, quantidade e observação de um produto. */
export function openProductSheet(p) {
  let flavor = '', qty = 1;
  const price = h('span', { class: 'btn__price' }, brl(p.price_cents));
  const out = h('output', { 'aria-live': 'polite' }, '1');
  const err = h('p', { class: 'error', role: 'alert' });
  const note = h('textarea', { class: 'textarea', maxlength: 140, placeholder: 'Ex.: caprichar na calda', id: 'ps-note' });

  const setQty = (n) => { qty = Math.max(1, Math.min(50, n)); out.textContent = qty; bump(out); price.textContent = brl(p.price_cents * qty); };
  const flavors = h('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Sabor' },
    p.flavors.map((f, i) => h('div', { class: 'choice' },
      h('input', { type: 'radio', name: 'ps-flavor', id: `ps-f${i}`, value: f, onchange: () => { flavor = f; err.textContent = ''; } }),
      h('label', { for: `ps-f${i}` }, f))));

  const add = h('button', { class: 'btn btn--grape btn--block', type: 'button' }, 'Adicionar', price);
  const panel = h('div', { class: 'panel panel--sheet' },
    h('div', { class: 'grabber' }),
    h('div', { class: 'panel__head' }, h('h2', {}, p.name), h('button', { class: 'icon-btn', 'aria-label': 'Fechar', html: icons.close, onclick: () => close() })),
    h('div', { class: 'panel__body' },
      h('div', { style: { display: 'grid', gap: '18px' } },
        h('img', { src: p.image, alt: '', style: { width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '20px', background: 'var(--lilac-2)' } }),
        p.description && h('p', { style: { color: 'rgba(42,11,54,.72)' } }, p.description),
        h('fieldset', { style: { border: 0, padding: 0, margin: 0, display: 'grid', gap: '10px' } }, h('legend', { style: { fontWeight: 800, marginBottom: '8px' } }, 'Escolha o sabor'), flavors, err),
        h('label', { class: 'field', for: 'ps-note' }, h('span', {}, 'Observação (opcional)'), note),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('span', { style: { fontWeight: 700 } }, 'Quantidade'),
          h('div', { class: 'qty' }, h('button', { type: 'button', 'aria-label': 'Diminuir', onclick: () => setQty(qty - 1) }, '−'), out, h('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => setQty(qty + 1) }, '+'))))),
    h('div', { class: 'panel__foot' }, add));

  add.addEventListener('click', () => {
    if (!flavor) { err.textContent = 'Escolha um sabor para continuar.'; flavors.querySelector('input')?.focus(); return; }
    addLine({ kind: 'product', productId: p.id, flavor, qty, note: note.value.trim() });
    feedback(add, p.image, `${qty}x ${p.name} (${flavor}) no carrinho!`);
    close();
  });
  const close = openPanel({ panel, label: `Escolher sabor: ${p.name}` });
}
