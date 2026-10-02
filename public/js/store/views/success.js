import { h, replace } from '../../ui/dom.js';
import { brl, timeOf } from '../../ui/format.js';
import { confetti } from '../../ui/motion.js';
import { toast } from '../../ui/toast.js';
import { api } from '../api.js';

/** Tela "PEDIDO REALIZADO! 💜" e acompanhamento do pedido (/pedido/:token). */
const STATUS = {
  NOVO: { label: 'Pedido recebido', emoji: '🧾' },
  EM_PREPARACAO: { label: 'Em preparação', emoji: '👩‍🍳' },
  PRONTO: { label: 'Pronto', emoji: '✅' },
  SAIU_PARA_ENTREGA: { label: 'Saiu para entrega', emoji: '🛵' },
  ENTREGUE: { label: 'Entregue', emoji: '💜' },
  CANCELADO: { label: 'Cancelado', emoji: '❌' },
};
const PAY = { pix: 'PIX', cash: 'Dinheiro', credit: 'Cartão de crédito', debit: 'Cartão de débito' };

let overlay = null, poll = null;

function mount(content) {
  if (!overlay) {
    overlay = h('div', { class: 'done', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'done-title' });
    document.body.append(overlay);
    document.body.classList.add('is-locked');
  }
  replace(overlay, h('div', { class: 'done__inner' }, content));
  overlay.scrollTop = 0;
  overlay.querySelector('[autofocus], h2')?.focus({ preventScroll: true });
}

export function closeOrderScreen({ toHome = true } = {}) {
  clearInterval(poll);
  poll = null;
  overlay?.remove();
  overlay = null;
  document.body.classList.remove('is-locked');
  if (toHome && location.pathname.startsWith('/pedido/')) history.pushState({}, '', '/');
}

const checkSvg = () => h('div', {
  html: '<svg class="done__check" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="#F8BE1C" stroke-width="8" stroke-linecap="round" transform="rotate(-90 60 60)"/><path d="M36 62l16 16 32-34" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
});

function addressLines(o) {
  if (o.fulfillment !== 'delivery') return ['Retirada no balcão'];
  const a = o.address || {};
  return [`${a.street}, nº ${a.number}${a.complement ? ` — ${a.complement}` : ''}`, a.district, a.reference && `Ref.: ${a.reference}`].filter(Boolean);
}

function payText(o) {
  let t = PAY[o.payment_method] || o.payment_method;
  if (o.payment_method === 'cash') t += o.change_for_cents ? ` (troco p/ ${brl(o.change_for_cents)})` : ' (sem troco)';
  return t;
}

function itemsCard(o) {
  return h('div', { class: 'done__card' },
    h('h3', {}, 'Resumo do pedido'),
    h('ul', { class: 'cart-items', style: { gap: '8px' } }, o.items.map((it) => h('li', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px' } },
      h('span', {},
        h('b', {}, `${it.qty}x ${it.name}${it.flavor ? ` (${it.flavor})` : ''}`),
        it.details?.length > 0 && h('small', { style: { display: 'block', color: 'rgba(42,11,54,.65)' } }, it.details.map((d) => d.name).join(', ')),
        it.note && h('small', { style: { display: 'block', color: 'var(--acai-3)' } }, `Obs.: ${it.note}`)),
      h('span', { style: { fontWeight: 700, whiteSpace: 'nowrap' } }, brl(it.total_cents))))),
    h('dl', { class: 'totals' },
      h('div', {}, h('dt', {}, 'Subtotal'), h('dd', {}, brl(o.subtotal_cents))),
      o.discount_cents > 0 && h('div', { class: 'discount' }, h('dt', {}, o.promo_title || 'Desconto'), h('dd', {}, `− ${brl(o.discount_cents)}`)),
      o.fulfillment === 'delivery' && h('div', {}, h('dt', {}, 'Entrega'), h('dd', {}, o.delivery_fee_cents ? brl(o.delivery_fee_cents) : 'Grátis')),
      h('div', { class: 'grand' }, h('dt', {}, 'Total'), h('dd', {}, brl(o.total_cents)))),
    o.notes && h('p', { style: { fontSize: '.9rem' } }, h('b', {}, 'Observações: '), o.notes));
}

function metaCard(o) {
  const eta = o.scheduled_for ? `Agendado: ${o.scheduled_for}` : `${o.eta_min}–${o.eta_max} min`;
  return h('div', { class: 'done__card' },
    h('div', { class: 'done__meta' },
      h('div', {}, h('span', {}, 'Valor total'), h('b', {}, brl(o.total_cents))),
      h('div', {}, h('span', {}, 'Pagamento'), payText(o)),
      h('div', {}, h('span', {}, o.fulfillment === 'delivery' ? 'Tempo estimado' : 'Pronto em'), eta),
      h('div', {}, h('span', {}, o.fulfillment === 'delivery' ? 'Endereço' : 'Entrega'), addressLines(o).map((l) => h('div', {}, l)))),
    o.pixKey && h('div', { style: { padding: '12px', borderRadius: '14px', background: 'var(--lilac-2)', display: 'grid', gap: '6px' } },
      h('span', { style: { fontSize: '.85rem', fontWeight: 700 } }, '⚡ Chave PIX da loja'),
      h('code', { style: { wordBreak: 'break-all', fontWeight: 700 } }, o.pixKey),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', style: { justifySelf: 'start', '--fg': 'var(--ink)' }, onclick: () => copy(o.pixKey, 'Chave PIX copiada!') }, 'Copiar chave')));
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg, { icon: '📋' }); }
  catch { toast('Não deu para copiar automaticamente. Selecione e copie a chave.', { type: 'error' }); }
}

export function showSuccess(o, { waOpened = false } = {}) {
  history.pushState({ order: o.token }, '', `/pedido/${o.token}`);
  mount([
    checkSvg(),
    h('h2', { id: 'done-title', tabindex: '-1' }, 'PEDIDO REALIZADO! 💜'),
    h('span', { class: 'done__num' }, `Pedido #${o.number}`),
    h('p', { style: { color: 'var(--lilac-2)', maxWidth: '40ch' } }, 'Já recebemos seu pedido e estamos preparando tudo com muito carinho.'),
    !waOpened && h('p', { class: 'closed-note', style: { color: 'var(--ink)' } }, '📲 Toque em “Enviar pedido no WhatsApp” para mandar o resumo completo para a loja.'),
    h('div', { class: 'done__actions' },
      h('a', { class: 'btn btn--block', href: o.whatsappUrl, target: '_blank', rel: 'noopener' }, waOpened ? 'Reenviar pedido no WhatsApp' : 'Enviar pedido no WhatsApp')),
    metaCard(o),
    itemsCard(o),
    h('div', { class: 'done__actions' },
      h('button', { class: 'btn btn--grape btn--block', type: 'button', onclick: () => showTracking(o.token, o) }, 'Acompanhar pedido'),
      h('a', { class: 'btn btn--ghost btn--block', href: o.storeWhatsappUrl, target: '_blank', rel: 'noopener' }, 'Falar pelo WhatsApp'),
      h('button', { class: 'btn btn--ghost btn--block', type: 'button', onclick: () => closeOrderScreen() }, 'Voltar ao cardápio')),
  ]);
  setTimeout(confetti, 350);
}

/** Acompanhamento: linha do tempo atualizada a cada 15s. */
export async function showTracking(token, initial) {
  if (location.pathname !== `/pedido/${token}`) history.pushState({ order: token }, '', `/pedido/${token}`);
  let o = initial;
  if (!o) {
    mount([h('div', { class: 'skeleton', style: { width: '100%', height: '320px' } })]);
    try { o = await api.order(token); }
    catch (e) {
      mount([
        h('h2', { id: 'done-title', tabindex: '-1' }, 'Pedido não encontrado'),
        h('p', { style: { color: 'var(--lilac-2)' } }, e.message),
        h('button', { class: 'btn', type: 'button', onclick: () => closeOrderScreen() }, 'Ir para o cardápio'),
      ]);
      return;
    }
  }
  const draw = () => {
    const cancelled = o.status === 'CANCELADO';
    const flow = cancelled ? [...o.history.map((x) => x.status)] : o.flow;
    const reached = new Map(o.history.map((x) => [x.status, x.at]));
    const idx = flow.indexOf(o.status);
    mount([
      h('h2', { id: 'done-title', tabindex: '-1' }, `${STATUS[o.status]?.emoji || ''} ${cancelled ? 'Pedido cancelado' : STATUS[o.status]?.label}`),
      h('span', { class: 'done__num' }, `Pedido #${o.number}`),
      h('div', { class: 'done__card' },
        h('h3', {}, 'Acompanhe seu pedido'),
        h('ol', { class: 'timeline', 'aria-label': 'Etapas do pedido' }, flow.map((s, i) => {
          const at = reached.get(s);
          const cls = i < idx || (i === idx && s === 'ENTREGUE') ? 'is-done' : i === idx ? 'is-current' : '';
          return h('li', { class: cls, 'aria-current': i === idx ? 'step' : false },
            `${STATUS[s]?.emoji} ${s === 'PRONTO' && o.fulfillment === 'pickup' ? 'Pronto para retirada' : STATUS[s]?.label}`,
            at && h('time', { datetime: at }, timeOf(at.endsWith('Z') ? at : `${at.replace(' ', 'T')}Z`)));
        })),
        h('p', { style: { fontSize: '.85rem', color: 'rgba(42,11,54,.6)' } }, 'Esta tela se atualiza sozinha.')),
      metaCard(o),
      itemsCard(o),
      h('div', { class: 'done__actions' },
        h('a', { class: 'btn btn--block', href: o.storeWhatsappUrl, target: '_blank', rel: 'noopener' }, 'Falar pelo WhatsApp'),
        h('button', { class: 'btn btn--ghost btn--block', type: 'button', onclick: () => closeOrderScreen() }, 'Voltar ao cardápio')),
    ]);
  };
  draw();
  clearInterval(poll);
  poll = setInterval(async () => {
    if (document.hidden) return;
    try {
      const n = await api.order(token);
      if (n.status !== o.status) { o = n; draw(); toast(`Pedido #${o.number}: ${STATUS[o.status]?.label}`, { icon: STATUS[o.status]?.emoji }); }
    } catch { /* tenta de novo no próximo ciclo */ }
    if (['ENTREGUE', 'CANCELADO'].includes(o.status)) { clearInterval(poll); poll = null; }
  }, 15000);
}
