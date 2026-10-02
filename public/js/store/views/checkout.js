import { h, replace, icons } from '../../ui/dom.js';
import { brl, maskPhone, parseMoney } from '../../ui/format.js';
import { animateNumber } from '../../ui/motion.js';
import { openPanel, closeAll } from '../../ui/overlay.js';
import { toast } from '../../ui/toast.js';
import { api, ApiError } from '../api.js';
import { state } from '../state.js';
import { toPayload, clearCart, getLines } from '../cart.js';
import { showSuccess } from './success.js';

/**
 * Checkout em uma única tela, curta e confortável no celular:
 * dados → entrega → pagamento → (agendamento) → observações.
 * O total exibido vem do servidor (/api/orders/quote), que recalcula tudo.
 */
const SAVED = 'tdb-customer-v1';
const PAY = {
  pix: { ico: '⚡', label: 'PIX', hint: 'Chave enviada na confirmação' },
  cash: { ico: '💵', label: 'Dinheiro', hint: 'Na entrega ou retirada' },
  credit: { ico: '💳', label: 'Crédito', hint: 'Maquininha na entrega' },
  debit: { ico: '💳', label: 'Débito', hint: 'Maquininha na entrega' },
};

let opened = false;

export function openCheckout() {
  if (opened || !getLines().length) return;
  opened = true;
  const s = state.settings;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(SAVED) || '{}'); } catch { return {}; } })();
  const methods = Object.keys(PAY).filter((k) => s.payments[k]);
  const f = {
    name: saved.name || '', phone: saved.phone || '',
    fulfillment: s.delivery.enabled ? (saved.fulfillment === 'pickup' && s.delivery.pickupEnabled ? 'pickup' : 'delivery') : 'pickup',
    zoneId: saved.zoneId && state.catalog.zones.some((z) => z.id === saved.zoneId) ? saved.zoneId : '',
    street: saved.street || '', number: saved.number || '', complement: saved.complement || '', reference: saved.reference || '',
    method: '', needsChange: false, changeFor: '', notes: '', scheduledFor: '',
  };
  let quote = null, busy = false;

  /* ── Campos ───────────────────────────────── */
  const errors = new Map();
  const field = (key, label, control, hint) => {
    const err = h('span', { class: 'error', id: `err-${key}`, 'aria-live': 'polite' });
    control.setAttribute('aria-describedby', `err-${key}`);
    const wrap = h('label', { class: 'field', for: control.id }, h('span', {}, label), control, hint && h('small', {}, hint), err);
    errors.set(key, { wrap, err, control });
    return wrap;
  };
  const input = (key, attrs = {}) => {
    const el = h('input', { class: 'input', id: `co-${key}`, name: key, value: f[key] ?? '', ...attrs });
    el.addEventListener('input', () => {
      if (key === 'phone') el.value = maskPhone(el.value);
      f[key] = el.value;
      setError(key, '');
    });
    return el;
  };
  const setError = (key, msg) => {
    const e = errors.get(key);
    if (!e) return;
    e.err.textContent = msg || '';
    e.wrap.classList.toggle('has-error', !!msg);
    e.control.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  // 1. Dados
  const dados = h('fieldset', {},
    h('legend', {}, h('span', { class: 'n' }, '1'), 'Seus dados'),
    field('customer.name', 'Nome', input('name', { autocomplete: 'name', maxlength: 60, placeholder: 'Como podemos te chamar?', required: true })),
    field('customer.phone', 'WhatsApp', input('phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: '(00) 00000-0000', required: true, value: maskPhone(f.phone) }),
      'Vamos usar para confirmar e avisar sobre o pedido.'));

  // 2. Entrega
  const zoneSel = h('select', { class: 'select', id: 'co-zone', name: 'zoneId', autocomplete: 'off' },
    h('option', { value: '' }, 'Selecione seu bairro'),
    state.catalog.zones.map((z) => h('option', { value: z.id, selected: z.id === f.zoneId }, `${z.name} — ${z.fee_cents ? brl(z.fee_cents) : 'grátis'}`)));
  zoneSel.addEventListener('change', () => { f.zoneId = Number(zoneSel.value) || ''; setError('zoneId', ''); refreshQuote(); });
  const addressBlock = h('div', { class: 'reveal-block' },
    field('zoneId', 'Bairro', zoneSel, 'Não achou seu bairro? Fale com a gente no WhatsApp.'),
    h('div', { class: 'two' },
      field('address.street', 'Rua', input('street', { autocomplete: 'address-line1', maxlength: 100, placeholder: 'Nome da rua' })),
      field('address.number', 'Número', input('number', { inputmode: 'numeric', maxlength: 10, placeholder: 'Nº' }))),
    field('address.complement', 'Complemento (opcional)', input('complement', { autocomplete: 'address-line2', maxlength: 60, placeholder: 'Apto, bloco, casa…' })),
    field('address.reference', 'Ponto de referência (opcional)', input('reference', { maxlength: 100, placeholder: 'Ex.: em frente à padaria' })));
  const a = s.address;
  const pickupBlock = h('div', { class: 'reveal-block' },
    h('p', { class: 'eta-card', style: { background: 'var(--lilac-2)', color: 'var(--ink)' } },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, '🏪'),
      h('span', {}, h('b', { style: { color: 'var(--acai)' } }, 'Retire em: '), `${a.street}, ${a.number} — ${a.district}`)));
  const entregaSlot = h('div');
  const ffChoices = [
    s.delivery.enabled && ['delivery', '🛵', 'Delivery', 'Levamos até você'],
    s.delivery.pickupEnabled && ['pickup', '🏪', 'Retirada', 'Sem taxa de entrega'],
  ].filter(Boolean);
  const entrega = h('fieldset', {},
    h('legend', {}, h('span', { class: 'n' }, '2'), 'Entrega'),
    h('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Forma de entrega' },
      ffChoices.map(([v, ico, label, hint]) => h('div', { class: 'choice' },
        h('input', { type: 'radio', name: 'fulfillment', id: `co-ff-${v}`, value: v, checked: f.fulfillment === v, onchange: () => { f.fulfillment = v; drawEntrega(); refreshQuote(); } }),
        h('label', { for: `co-ff-${v}` }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), h('span', {}, label, h('small', {}, hint)))))),
    entregaSlot);
  const drawEntrega = () => replace(entregaSlot, f.fulfillment === 'delivery' ? addressBlock : pickupBlock);
  drawEntrega();

  // 3. Pagamento
  const changeInput = h('input', { class: 'input', id: 'co-change', inputmode: 'decimal', placeholder: 'Ex.: 100,00', autocomplete: 'off' });
  changeInput.addEventListener('input', () => { f.changeFor = changeInput.value; setError('payment.changeFor', ''); });
  const changeBlock = h('div', { class: 'reveal-block' },
    h('p', { style: { fontWeight: 700 } }, 'Precisa de troco?'),
    h('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Precisa de troco?' },
      [['no', 'Não preciso'], ['yes', 'Sim, preciso']].map(([v, label]) => h('div', { class: 'choice' },
        h('input', { type: 'radio', name: 'needsChange', id: `co-ch-${v}`, value: v, checked: (v === 'yes') === f.needsChange, onchange: () => { f.needsChange = v === 'yes'; drawPay(); if (f.needsChange) changeInput.focus(); } }),
        h('label', { for: `co-ch-${v}` }, label)))),
    h('div', { 'data-change': '' }));
  const changeField = field('payment.changeFor', 'Troco para quanto?', changeInput);
  const paySlot = h('div');
  const pagamento = h('fieldset', {},
    h('legend', {}, h('span', { class: 'n' }, '3'), 'Pagamento'),
    h('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Forma de pagamento', id: 'co-method', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
      methods.map((m) => h('div', { class: 'choice' },
        h('input', { type: 'radio', name: 'method', id: `co-pay-${m}`, value: m, onchange: () => { f.method = m; setError('payment.method', ''); drawPay(); } }),
        h('label', { for: `co-pay-${m}` }, h('span', { class: 'ico', 'aria-hidden': 'true' }, PAY[m].ico), h('span', {}, PAY[m].label, h('small', {}, PAY[m].hint)))))),
    h('span', { class: 'error', id: 'err-method', 'aria-live': 'polite' }),
    paySlot);
  errors.set('payment.method', { wrap: pagamento, err: pagamento.querySelector('#err-method'), control: pagamento.querySelector('#co-method') });
  const drawPay = () => {
    if (f.method !== 'cash') return replace(paySlot);
    replace(changeBlock.querySelector('[data-change]'), f.needsChange ? changeField : null);
    if (!paySlot.contains(changeBlock)) replace(paySlot, changeBlock);
  };

  // 4. Agendamento (loja fechada)
  const st = state.store;
  let agendamento = null;
  if (!st.open) {
    if (st.slots?.length) {
      const sel = h('select', { class: 'select', id: 'co-slot' }, h('option', { value: '' }, 'Escolha um horário'), st.slots.map((x) => h('option', { value: x.value }, x.label)));
      sel.addEventListener('change', () => { f.scheduledFor = sel.value; setError('scheduledFor', ''); });
      agendamento = h('fieldset', {},
        h('legend', {}, h('span', { class: 'n' }, '4'), 'Agendar pedido'),
        h('p', { class: 'closed-note' }, `🔴 Estamos fechados agora (${st.label.toLowerCase()}). Você pode deixar o pedido agendado:`),
        field('scheduledFor', 'Horário', sel));
    } else {
      agendamento = h('p', { class: 'closed-note', role: 'alert' }, `🔴 Estamos fechados agora — ${st.label.toLowerCase()}. Você pode montar o carrinho e enviar quando abrirmos.`);
    }
  }
  const blocked = !st.open && !st.slots?.length;

  // 5. Observações
  const notes = h('textarea', { class: 'textarea', id: 'co-notes', maxlength: 300, placeholder: 'Ex.: entregar na portaria, mandar colher…' });
  notes.addEventListener('input', () => { f.notes = notes.value; });
  const obs = h('fieldset', {},
    h('legend', {}, h('span', { class: 'n' }, agendamento && !blocked ? '5' : '4'), 'Observações'),
    field('notes', 'Algum recado para a gente? (opcional)', notes));

  /* ── Resumo / totais do servidor ─────────── */
  const etaBox = h('div', { class: 'eta-card', 'aria-live': 'polite' });
  const totalsBox = h('dl', { class: 'totals' });
  const formError = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn--grape btn--block', type: 'submit', disabled: blocked },
    blocked ? 'Loja fechada no momento' : (agendamento ? 'Agendar pedido' : 'Enviar pedido'), h('span', { class: 'btn__price', 'data-value': 0 }, ''));
  const priceEl = submit.querySelector('.btn__price');

  const drawTotals = () => {
    if (!quote) return;
    const z = state.catalog.zones.find((x) => x.id === f.zoneId);
    const feeText = f.fulfillment === 'pickup' ? 'Retirada' : !z ? 'escolha o bairro' : quote.delivery_fee_cents ? brl(quote.delivery_fee_cents) : 'Grátis 🎉';
    replace(totalsBox,
      h('div', {}, h('dt', {}, 'Subtotal'), h('dd', {}, brl(quote.subtotal_cents))),
      quote.discount_cents > 0 && h('div', { class: 'discount' }, h('dt', {}, `🏷️ ${quote.promo.title}`), h('dd', {}, `− ${brl(quote.discount_cents)}`)),
      h('div', {}, h('dt', {}, 'Entrega'), h('dd', {}, feeText)),
      h('div', { class: 'grand' }, h('dt', {}, 'Total'), h('dd', {}, brl(quote.total_cents))));
    animateNumber(priceEl, quote.total_cents, brl);
    const when = agendamento && !blocked ? 'a partir do horário agendado' : '';
    replace(etaBox, h('span', { class: 'ico', 'aria-hidden': 'true' }, f.fulfillment === 'pickup' ? '🏪' : '⏱️'),
      h('span', {}, f.fulfillment === 'pickup' ? 'Seu pedido ficará pronto para retirada em aproximadamente ' : 'Seu pedido chega em aproximadamente ',
        h('b', {}, `${quote.eta.min}–${quote.eta.max} minutos`), when ? ` ${when}` : '', '.'));
  };

  let timer, seq = 0;
  const refreshQuote = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const q = await api.quote({ items: toPayload(), fulfillment: f.fulfillment, zoneId: f.zoneId || undefined });
        if (my !== seq) return;
        quote = q;
        formError.hidden = true;
        drawTotals();
      } catch (e) {
        if (my !== seq) return;
        formError.textContent = e.message;
        formError.hidden = false;
      }
    }, 120);
  };

  /* ── Envio ───────────────────────────────── */
  const validateLocal = () => {
    let first = null;
    const need = (key, ok, msg) => { if (!ok) { setError(key, msg); first ||= errors.get(key)?.control; } };
    need('customer.name', f.name.trim().length >= 2, 'Informe seu nome.');
    need('customer.phone', /^\d{10,11}$/.test(f.phone.replace(/\D/g, '')), 'Informe um WhatsApp válido com DDD.');
    if (f.fulfillment === 'delivery') {
      need('zoneId', !!f.zoneId, 'Escolha seu bairro.');
      need('address.street', f.street.trim().length >= 3, 'Informe a rua.');
      need('address.number', !!f.number.trim(), 'Informe o número.');
    }
    need('payment.method', !!f.method, 'Escolha como vai pagar.');
    if (f.method === 'cash' && f.needsChange) {
      const c = parseMoney(f.changeFor);
      need('payment.changeFor', c && (!quote || c > quote.total_cents), quote ? `Informe um valor maior que ${brl(quote.total_cents)}.` : 'Informe o valor.');
    }
    if (agendamento && !blocked) need('scheduledFor', !!f.scheduledFor, 'Escolha um horário.');
    if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !first;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy || blocked) return;
    formError.hidden = true;
    if (!validateLocal()) return;
    busy = true;
    submit.classList.add('is-busy');
    submit.setAttribute('aria-busy', 'true');
    // Abre a aba do WhatsApp no clique (evita bloqueio de pop-up) e só depois aponta para o link.
    let win = null;
    try { win = window.open('', '_blank'); if (win) win.document.title = 'Abrindo WhatsApp…'; } catch { win = null; }
    try {
      const order = await api.createOrder({
        items: toPayload(),
        customer: { name: f.name, phone: f.phone },
        fulfillment: f.fulfillment,
        zoneId: f.fulfillment === 'delivery' ? f.zoneId : undefined,
        address: f.fulfillment === 'delivery' ? { street: f.street, number: f.number, complement: f.complement, reference: f.reference } : undefined,
        payment: { method: f.method, needsChange: f.method === 'cash' && f.needsChange, changeFor: f.method === 'cash' && f.needsChange ? parseMoney(f.changeFor) : undefined },
        notes: f.notes,
        scheduledFor: f.scheduledFor || undefined,
      });
      try {
        localStorage.setItem(SAVED, JSON.stringify({ name: f.name, phone: f.phone, fulfillment: f.fulfillment, zoneId: f.zoneId, street: f.street, number: f.number, complement: f.complement, reference: f.reference }));
        localStorage.setItem('tdb-last-order', order.token);
      } catch { /* sem storage */ }
      let waOpened = false;
      if (win && !win.closed) { try { win.location.href = order.whatsappUrl; waOpened = true; } catch { /* bloqueado */ } }
      clearCart();
      closeAll();
      showSuccess(order, { waOpened });
    } catch (err) {
      try { win?.close(); } catch { /* ignore */ }
      if (err instanceof ApiError && err.details) for (const [k, msg] of Object.entries(err.details)) setError(k, msg);
      formError.textContent = err.message;
      formError.hidden = false;
      formError.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast(err.message, { type: 'error' });
      if (err.status === 422) refreshQuote();
    } finally {
      busy = false;
      submit.classList.remove('is-busy');
      submit.removeAttribute('aria-busy');
    }
  };

  const form = h('form', { class: 'checkout', novalidate: true, id: 'checkout-form' },
    dados, entrega, pagamento, blocked ? null : agendamento, obs,
    h('section', { class: 'card-summary', 'aria-label': 'Resumo de valores' }, totalsBox), etaBox, formError);
  form.addEventListener('submit', onSubmit);
  submit.setAttribute('form', 'checkout-form');

  const panel = h('section', { class: 'panel panel--side' },
    h('div', { class: 'panel__head' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Voltar ao carrinho', html: icons.back, onclick: () => close() }),
      h('h2', {}, 'Finalizar pedido')),
    h('div', { class: 'panel__body' }, blocked ? agendamento : null, form),
    h('div', { class: 'panel__foot' }, submit));

  const close = openPanel({ panel, label: 'Finalizar pedido', onClose: () => { opened = false; clearTimeout(timer); } });
  refreshQuote();
}
