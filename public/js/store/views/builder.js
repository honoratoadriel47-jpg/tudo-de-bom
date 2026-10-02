import { h, replace, icons } from '../../ui/dom.js';
import { brl, plural } from '../../ui/format.js';
import { animateNumber, bump } from '../../ui/motion.js';
import { toast } from '../../ui/toast.js';
import { priceCustom } from '../../shared/pricing.js';
import { state } from '../state.js';
import { addLine } from '../cart.js';
import { feedback } from './products.js';
import { centerIn } from '../../ui/motion.js';

/**
 * "Monte seu açaí": tamanho → base → complementos → frutas → recheios → coberturas → adicionais → revisão.
 * As etapas vêm do banco (grupos de ingredientes), então novas etapas aparecem sozinhas.
 */
const b = { sizeId: null, picks: new Map(), step: 0, qty: 1, note: '', shown: new Set() };
let root, groups, sizes, steps;

export function renderBuilder(preselectSizeId) {
  root = document.getElementById('builder');
  ({ groups, sizes } = state.catalog.builder);
  if (!sizes.length || !groups.length) { document.getElementById('monte-seu-acai').hidden = true; return; }
  steps = [{ id: 'size', name: 'Tamanho' }, ...groups.map((g) => ({ id: `g${g.id}`, name: g.name, group: g })), { id: 'review', name: 'Revisar' }];
  b.sizeId = preselectSizeId || b.sizeId || sizes.find((s) => s.ml === 500)?.id || sizes[0].id;
  for (const g of groups) if (!b.picks.has(g.id)) b.picks.set(g.id, []);
  // Base padrão (primeira opção grátis) para agilizar
  for (const g of groups) if (g.min_select === 1 && g.max_select === 1 && !b.picks.get(g.id).length) b.picks.set(g.id, [g.addons[0].id]);
  draw();
  watchVisibility();
}

function selectedAddons() {
  const all = [];
  for (const g of groups) for (const id of b.picks.get(g.id)) {
    const a = state.catalog.addonById.get(id);
    if (a) all.push(a);
  }
  return all;
}

const current = () => {
  const size = state.catalog.sizeById.get(b.sizeId);
  return { size, ...priceCustom(size, selectedAddons()) };
};

function draw() {
  const tabs = h('div', { class: 'steps', role: 'tablist', 'aria-label': 'Etapas da montagem' },
    steps.map((s, i) => h('button', {
      class: `step-tab ${i < b.step ? 'is-done' : ''}`, role: 'tab', type: 'button', id: `bt-${s.id}`,
      'aria-selected': i === b.step ? 'true' : 'false', 'aria-controls': 'builder-panel',
      onclick: () => go(i),
    }, h('span', { class: 'step-tab__n' }, i < b.step ? '✓' : i + 1), s.name)));

  const panel = h('div', { class: 'step-panel', id: 'builder-panel', role: 'tabpanel', 'aria-labelledby': `bt-${steps[b.step].id}` }, stepContent());
  const left = h('div', {}, tabs, panel, stepNav());
  replace(root, h('div', { class: 'builder' }, left, summary()), mobileBar());
  centerIn(tabs, tabs.querySelector('[aria-selected="true"]'));
  refreshTotals();
}

function stepContent() {
  const s = steps[b.step];
  if (s.id === 'size') {
    return [
      h('h3', {}, 'Qual o tamanho?'),
      h('p', { class: 'hint' }, 'Cada tamanho já vem com ingredientes grátis inclusos.'),
      h('div', { class: 'opt-grid opt-grid--sizes', role: 'radiogroup', 'aria-label': 'Tamanho' },
        sizes.map((z) => h('button', {
          class: 'opt opt--size', type: 'button', role: 'radio', 'aria-checked': z.id === b.sizeId ? 'true' : 'false',
          onclick: (e) => { b.sizeId = z.id; markRadio(e.currentTarget); refreshTotals(); },
        }, h('span', { class: 'opt__name' }, z.name), h('small', {}, z.description), h('small', {}, z.free_items ? `${plural(z.free_items, 'grátis incluso', 'grátis inclusos')}` : ''), h('span', { class: 'opt__price' }, brl(z.price_cents))))),
    ];
  }
  if (s.id === 'review') return review();
  const g = s.group;
  const picked = b.picks.get(g.id);
  const single = g.max_select === 1;
  const limits = [];
  if (g.description) limits.push(g.description);
  limits.push(single ? 'Escolha 1.' : g.min_select ? `Escolha de ${g.min_select} a ${g.max_select}.` : `Até ${g.max_select}.`);
  if (!g.counts_as_free) limits.push('Não entra nos grátis.');
  return [
    h('h3', {}, g.name),
    h('p', { class: 'hint' }, limits.map((t) => h('span', {}, t)), h('span', { 'data-count': g.id }, h('b', {}, `${picked.length}/${g.max_select}`))),
    h('div', { class: 'opt-grid', role: single ? 'radiogroup' : 'group', 'aria-label': g.name },
      g.addons.map((a) => {
        const on = picked.includes(a.id);
        return h('button', {
          class: 'opt', type: 'button', role: single ? 'radio' : null,
          [single ? 'aria-checked' : 'aria-pressed']: on ? 'true' : 'false', style: { '--c': a.color },
          onclick: (e) => toggle(g, a, e.currentTarget),
        }, h('span', { class: 'opt__dot', html: icons.check }), h('span', { class: 'opt__name' }, a.name),
        h('span', { class: 'opt__price' }, a.is_free ? 'Grátis' : a.price_cents ? `+ ${brl(a.price_cents)}` : 'Sem custo'));
      })),
  ];
}

function markRadio(btn) {
  btn.parentElement.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', x === btn ? 'true' : 'false'));
}

function toggle(g, a, btn) {
  const list = b.picks.get(g.id);
  const idx = list.indexOf(a.id);
  if (g.max_select === 1) {
    b.picks.set(g.id, idx === -1 ? [a.id] : g.min_select ? list : []);
    markRadio(btn);
    if (idx !== -1 && !g.min_select) btn.setAttribute('aria-checked', 'false');
  } else if (idx !== -1) {
    list.splice(idx, 1);
    btn.setAttribute('aria-pressed', 'false');
  } else {
    if (list.length >= g.max_select) {
      toast(`Em ${g.name} o máximo é ${g.max_select}. Tire um para trocar.`, { icon: '✋', type: 'error' });
      btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      return;
    }
    list.push(a.id);
    btn.setAttribute('aria-pressed', 'true');
  }
  const counter = root.querySelector(`[data-count="${g.id}"] b`);
  if (counter) { counter.textContent = `${b.picks.get(g.id).length}/${g.max_select}`; bump(counter.parentElement); }
  refreshTotals();
}

function review() {
  const { size, lines } = current();
  const note = h('textarea', { class: 'textarea', id: 'b-note', maxlength: 140, placeholder: 'Ex.: pouco leite condensado, mandar colher extra' });
  note.value = b.note;
  note.addEventListener('input', () => (b.note = note.value));
  const missing = groups.filter((g) => b.picks.get(g.id).length < g.min_select);
  return [
    h('h3', {}, `Seu açaí de ${size.name}`),
    h('p', { class: 'hint' }, lines.length ? `${plural(lines.length, 'ingrediente', 'ingredientes')} escolhidos. Toque numa etapa acima para mudar.` : 'Puro, do jeito que veio ao mundo. Ou volte e adicione o que quiser.'),
    missing.length ? h('p', { class: 'closed-note', style: { color: 'var(--ink)', marginBottom: '14px' } }, `Falta escolher: ${missing.map((g) => g.name).join(', ')}.`) : null,
    h('div', { class: 'opt-grid', style: { marginBottom: '18px' } },
      groups.map((g) => {
        const names = b.picks.get(g.id).map((id) => state.catalog.addonById.get(id)?.name).filter(Boolean);
        return h('button', { class: 'opt', type: 'button', style: { paddingLeft: '16px' }, onclick: () => go(steps.findIndex((s) => s.group === g)) },
          h('span', { class: 'opt__price' }, g.name), h('span', { class: 'opt__name' }, names.length ? names.join(', ') : 'Nenhum'));
      })),
    h('label', { class: 'field', for: 'b-note', style: { color: 'var(--white)' } }, h('span', {}, 'Observação para este açaí (opcional)'), note),
  ];
}

function stepNav() {
  const last = b.step === steps.length - 1;
  return h('div', { class: 'step-nav' },
    b.step > 0 && h('button', { class: 'btn btn--ghost', type: 'button', 'aria-label': 'Etapa anterior', html: icons.back, style: { padding: '0 1em' }, onclick: () => go(b.step - 1) }),
    last
      ? h('button', { class: 'btn', type: 'button', onclick: (e) => addToCart(e.currentTarget) }, 'Adicionar ao carrinho', h('span', { class: 'btn__price', 'data-btn-total': '' }))
      : h('button', { class: 'btn', type: 'button', onclick: () => next() }, `Próximo: ${steps[b.step + 1].name}`));
}

function next() {
  const g = steps[b.step].group;
  if (g && b.picks.get(g.id).length < g.min_select) { toast(`Escolha ${g.min_select === 1 ? 'uma opção' : `${g.min_select} opções`} em ${g.name}.`, { type: 'error', icon: '👆' }); return; }
  go(b.step + 1);
}

function go(i) {
  b.step = Math.max(0, Math.min(steps.length - 1, i));
  draw();
  const top = root.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.6) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addToCart(btn) {
  const missing = groups.find((g) => b.picks.get(g.id).length < g.min_select);
  if (missing) { toast(`Falta escolher em ${missing.name}.`, { type: 'error', icon: '👆' }); go(steps.findIndex((s) => s.group === missing)); return; }
  const { size } = current();
  addLine({ kind: 'custom', sizeId: b.sizeId, addonIds: selectedAddons().map((a) => a.id), qty: b.qty, note: b.note.trim() });
  feedback(btn, size.image, `${b.qty}x Açaí ${size.name} no carrinho!`);
  // Recomeça mantendo o tamanho e a base
  for (const g of groups) if (!(g.min_select === 1 && g.max_select === 1)) b.picks.set(g.id, []);
  b.note = ''; b.qty = 1; b.step = 0; b.shown.clear();
  setTimeout(draw, 650);
}

/* ── Resumo lateral com o copo enchendo ── */
function summary() {
  return h('aside', { class: 'summary', 'aria-label': 'Resumo do seu açaí' },
    h('div', { class: 'summary__cup', 'data-cup': '' }),
    h('div', { class: 'summary__body' },
      h('div', { class: 'summary__title' }, h('span', { 'data-sum-name': '' }), h('span', { class: 'price', 'data-sum-base': '' })),
      h('div', { class: 'summary__free', 'data-sum-free': '' }),
      h('div', { class: 'summary__lines', 'data-sum-lines': '', 'aria-live': 'polite' }),
      h('div', { class: 'summary__total' }, h('span', {}, 'Total'), h('span', { class: 'price', 'data-sum-total': '' })),
      h('div', { class: 'row' },
        h('div', { class: 'qty', 'aria-label': 'Quantidade' },
          h('button', { type: 'button', 'aria-label': 'Diminuir quantidade', onclick: () => setQty(b.qty - 1) }, '−'),
          h('output', { 'data-sum-qty': '' }, b.qty),
          h('button', { type: 'button', 'aria-label': 'Aumentar quantidade', onclick: () => setQty(b.qty + 1) }, '+')),
        h('button', { class: 'btn btn--grape btn--sm', type: 'button', onclick: (e) => (b.step === steps.length - 1 ? addToCart(e.currentTarget) : go(steps.length - 1)) }, b.step === steps.length - 1 ? 'Adicionar' : 'Revisar'))));
}

function setQty(n) {
  b.qty = Math.max(1, Math.min(20, n));
  const o = root.querySelector('[data-sum-qty]');
  o.textContent = b.qty; bump(o);
  refreshTotals();
}

function mobileBar() {
  const last = b.step === steps.length - 1;
  return h('div', { class: 'builder-bar' },
    h('span', { class: 'price' }, h('small', { 'data-bar-label': '' }), h('span', { 'data-bar-total': '' })),
    h('button', { class: 'btn btn--grape btn--sm', type: 'button', onclick: (e) => (last ? addToCart(e.currentTarget) : next()) }, last ? 'Adicionar' : `Próximo`));
}

function refreshTotals() {
  const { size, unit, lines } = current();
  const total = unit * b.qty;
  root.querySelector('[data-sum-name]').textContent = `Açaí ${size.name}`;
  root.querySelector('[data-sum-base]').textContent = brl(size.price_cents);
  const usedFree = lines.filter((l) => l.included).length;
  const free = root.querySelector('[data-sum-free]');
  free.hidden = !size.free_items;
  free.textContent = size.free_items ? `🎁 ${usedFree} de ${size.free_items} grátis usados${usedFree >= size.free_items ? ' — os próximos são cobrados' : ''}` : '';
  replace(root.querySelector('[data-sum-lines]'), lines.length
    ? lines.map((l) => h('div', { class: 'summary__line' }, h('span', {}, l.name), h('span', { class: l.charged ? '' : 'free' }, l.charged ? `+ ${brl(l.charged)}` : l.included ? 'incluso' : 'grátis')))
    : h('div', { class: 'summary__line', style: { color: 'rgba(42,11,54,.55)' } }, 'Escolha os ingredientes nas etapas.'));
  animateNumber(root.querySelector('[data-sum-total]'), total, brl);
  animateNumber(root.querySelector('[data-bar-total]'), total, brl);
  root.querySelector('[data-bar-label]').textContent = `${b.qty}x Açaí ${size.name}`;
  const bt = root.querySelector('[data-btn-total]');
  if (bt) bt.textContent = brl(total);
  drawCup(size);
}

function drawCup(size) {
  const cup = root.querySelector('[data-cup]');
  const addons = selectedAddons();
  const base = addons.find((a) => a.groupId === groups[0].id);
  const color = base?.color || '#5B1A7A';
  const maxMl = Math.max(...sizes.map((s) => s.ml || 500));
  const fill = 0.45 + 0.5 * Math.min(1, (size.ml || 500) / maxMl);
  const top = 200 - 150 * fill;
  const tops = addons.filter((a) => a !== base);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 210');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="M40 50 L160 50 L148 200 Q100 208 52 200Z" fill="#fff" opacity=".55" stroke="#2A0B36" stroke-width="3"/>
    <path d="M${40 + (12 * (top - 50)) / 150} ${top} L${160 - (12 * (top - 50)) / 150} ${top} L148 200 Q100 208 52 200Z" fill="${color}" style="transition:all .5s"/>
    <path d="M${36 + (12 * (top - 50)) / 150} ${top + 2} Q100 ${top - 46} ${164 - (12 * (top - 50)) / 150} ${top + 2}Z" fill="${color}"/>
    <path d="M50 70 L58 190" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
  tops.forEach((a, i) => {
    const key = `${a.id}`;
    const c = document.createElementNS(NS, 'circle');
    const cols = 6, row = Math.floor(i / cols), col = i % cols;
    const x = 58 + col * 17 + (row % 2) * 8, y = top - 12 - row * 13 + Math.abs(col - 2.5) * 3;
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 8.5);
    c.setAttribute('fill', a.color); c.setAttribute('stroke', '#2A0B36'); c.setAttribute('stroke-width', '2');
    if (!b.shown.has(key)) c.setAttribute('class', 'topping');
    svg.append(c);
  });
  b.shown = new Set(tops.map((a) => `${a.id}`));
  cup.replaceChildren(svg);
}

/** Esconde a barra do carrinho enquanto o montador está na tela (ele tem a própria barra). */
let watching = false;
function watchVisibility() {
  if (watching || !('IntersectionObserver' in window)) return;
  watching = true;
  new IntersectionObserver(([e]) => document.body.classList.toggle('builder-visible', e.isIntersecting), { threshold: 0.15 })
    .observe(document.getElementById('monte-seu-acai'));
}
