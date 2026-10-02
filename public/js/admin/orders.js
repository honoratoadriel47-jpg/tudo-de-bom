import { h, replace, icons } from '../ui/dom.js';
import { brl, timeOf, plural } from '../ui/format.js';
import { openPanel } from '../ui/overlay.js';
import { toast } from '../ui/toast.js';
import { api } from './api.js';
import { session } from './main.js';

/** Gestão de pedidos: atualização automática, aviso sonoro de pedido novo e troca de status em 1 toque. */
export const STATUS = {
  NOVO: { label: 'Novo', emoji: '🆕' },
  EM_PREPARACAO: { label: 'Em preparação', emoji: '👩‍🍳' },
  PRONTO: { label: 'Pronto', emoji: '✅' },
  SAIU_PARA_ENTREGA: { label: 'Saiu para entrega', emoji: '🛵' },
  ENTREGUE: { label: 'Entregue', emoji: '💜' },
  CANCELADO: { label: 'Cancelado', emoji: '❌' },
};
const NEXT_LABEL = {
  EM_PREPARACAO: 'Iniciar preparo', PRONTO: 'Marcar como pronto',
  SAIU_PARA_ENTREGA: 'Saiu para entrega', ENTREGUE: 'Marcar entregue',
};
const PAY = { pix: 'PIX', cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito' };
const FILTERS = [['ATIVOS', 'Em andamento'], ['NOVO', 'Novos'], ['EM_PREPARACAO', 'Em preparação'], ['PRONTO', 'Prontos'], ['SAIU_PARA_ENTREGA', 'Saíram'], ['ENTREGUE', 'Entregues'], ['CANCELADO', 'Cancelados'], ['', 'Todos']];

const f = { status: 'ATIVOS', q: '', date: '' };
let timer = null, known = null, root, listEl, kpiEl, chipsEl, baseTitle = 'Pedidos — Painel TUDO DE BOM', flash = null;

export function stopOrders() {
  clearInterval(timer); timer = null;
  stopFlash();
}

export async function renderOrders(el) {
  root = el;
  document.title = baseTitle;
  kpiEl = h('div', { class: 'kpis' });
  chipsKey = '';
  chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por status' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nome, telefone ou nº', 'aria-label': 'Buscar pedido', value: f.q });
  let deb;
  search.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { f.q = search.value.trim(); load(); }, 300); });
  const date = h('input', { class: 'input', type: 'date', 'aria-label': 'Filtrar por data', value: f.date });
  date.addEventListener('change', () => { f.date = date.value; load(); });
  listEl = h('div', { class: 'orders', 'aria-live': 'polite' });
  replace(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Pedidos'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { unlockAudio(); load(); toast('Lista atualizada', { icon: '🔄' }); } }, 'Atualizar')),
    kpiEl,
    h('div', { class: 'filters' }, chipsEl, search, date),
    listEl);
  drawChips();
  await load();
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) load({ quiet: true }); }, 5000);
}

let chipsKey = '';
function drawChips(active = {}) {
  const key = f.status + JSON.stringify(active);
  if (key === chipsKey && chipsEl.childElementCount) return; // evita redesenhar (e perder a rolagem) a cada 5s
  chipsKey = key;
  const sl = chipsEl.scrollLeft;
  replace(chipsEl, FILTERS.map(([v, label]) => {
    const n = v === 'ATIVOS' ? Object.values(active).reduce((a, b) => a + b, 0) : active[v];
    return h('button', { class: 'chip', type: 'button', 'aria-pressed': f.status === v ? 'true' : 'false', onclick: () => { f.status = v; drawChips(active); load(); } },
      label, n ? h('span', { class: 'n' }, n) : null);
  }));
  chipsEl.scrollLeft = sl;
}

async function load({ quiet = false } = {}) {
  let data;
  try { data = await api.orders({ ...f, limit: 150 }); }
  catch (e) { if (!quiet) toast(e.message, { type: 'error' }); return; }
  const d = data.dashboard;
  const activeTotal = Object.values(d.active).reduce((a, b) => a + b, 0);
  replace(kpiEl,
    kpi('Pedidos hoje', d.todayCount), kpi('Faturamento hoje', brl(d.todayRevenue)),
    kpi('Novos aguardando', d.active.NOVO || 0), kpi('Em andamento', activeTotal));
  drawChips(d.active);
  const badge = document.querySelector('[data-new-count]');
  if (badge) { badge.textContent = d.active.NOVO || 0; badge.hidden = !d.active.NOVO; }

  // Pedido novo? (o maior ID cresceu — independe dos filtros)
  const fresh = known !== null && d.lastId > known ? data.orders.filter((o) => o.id > known) : [];
  if (known !== null && d.lastId > known) {
    const n = d.lastId - known;
    beep();
    startFlash(n);
    toast(n === 1 ? `Novo pedido! #${d.lastNumber}` : `${n} novos pedidos!`, { icon: '🔔', duration: 6000 });
  }
  known = d.lastId;

  if (!data.orders.length) {
    replace(listEl, h('div', { class: 'empty', style: { gridColumn: '1/-1' } }, h('b', {}, '🍇'), f.status === 'ATIVOS' ? 'Nenhum pedido em andamento agora.' : 'Nenhum pedido encontrado com esses filtros.'));
    return;
  }
  replace(listEl, data.orders.map((o) => orderCard(o, fresh.some((x) => x.id === o.id))));
}

const kpi = (label, value) => h('div', { class: 'kpi' }, h('span', {}, label), h('b', {}, value));
const stPill = (s) => h('span', { class: `st st--${s}` }, `${STATUS[s]?.emoji} ${STATUS[s]?.label}`);
const nextOf = (o) => { const i = o.flow.indexOf(o.status); return i >= 0 && i < o.flow.length - 1 ? o.flow[i + 1] : null; };
const minutesAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

function orderCard(o, isNew) {
  const next = nextOf(o);
  const ago = minutesAgo(o.created_at);
  const card = h('article', { class: `ocard ocard--${o.status} ${isNew ? 'is-new' : ''}`, 'aria-label': `Pedido ${o.number}` },
    h('div', { class: 'ocard__top' },
      h('span', { class: 'ocard__num' }, `#${o.number}`), stPill(o.status),
      h('span', { class: 'ocard__time' }, timeOf(o.created_at), h('br'), ago < 1 ? 'agora' : ago < 120 ? `há ${ago} min` : '')),
    o.scheduled_for && h('div', { class: 'sched' }, `📅 Agendado: ${o.scheduled_for}`),
    h('div', { class: 'ocard__who' },
      h('b', {}, o.customer_name),
      h('span', {}, o.fulfillment === 'delivery' ? `🛵 ${o.address.street}, ${o.address.number} — ${o.zone_name}` : '🏪 Retirada no balcão')),
    h('ul', { class: 'ocard__items' }, o.items.map((it) => h('li', {},
      h('b', {}, `${it.qty}x ${it.name}${it.flavor ? ` (${it.flavor})` : ''}`),
      it.details?.length > 0 && h('small', {}, ` — ${it.details.map((x) => x.name).join(', ')}`),
      it.note && h('small', { style: { display: 'block', color: 'var(--acai-3)' } }, `📝 ${it.note}`)))),
    o.notes && h('p', { style: { fontSize: '.88rem' } }, h('b', {}, 'Obs.: '), o.notes),
    h('div', { class: 'ocard__money' },
      h('span', {}, `💳 ${PAY[o.payment_method]}${o.payment_method === 'cash' && o.change_for_cents ? ` · troco p/ ${brl(o.change_for_cents)}` : ''}`),
      h('b', {}, brl(o.total_cents))),
    h('div', { class: 'ocard__actions' },
      next ? h('button', { class: 'btn btn--grape', type: 'button', onclick: (e) => change(o, next, e.currentTarget) }, `${STATUS[next].emoji} ${NEXT_LABEL[next] || STATUS[next].label}`)
        : h('span', { class: 'muted', style: { alignSelf: 'center', fontWeight: 600 } }, o.status === 'CANCELADO' ? 'Pedido cancelado' : 'Pedido finalizado'),
      h('a', { class: 'icon-btn', href: o.customerWhatsappUrl, target: '_blank', rel: 'noopener', 'aria-label': `Avisar ${o.customer_name} no WhatsApp`, title: 'Avisar cliente no WhatsApp' }, '💬'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Detalhes do pedido ${o.number}`, title: 'Detalhes', onclick: () => openDetails(o.id) }, '⋯')));
  return card;
}

async function change(o, status, btn) {
  if (status === 'CANCELADO' && !confirm(`Cancelar o pedido #${o.number}?`)) return false;
  btn?.classList.add('is-busy');
  try {
    const u = await api.setStatus(o.id, status);
    toast(`Pedido #${u.number}: ${STATUS[status].label}`, { icon: STATUS[status].emoji });
    await load({ quiet: true });
    return u;
  } catch (e) {
    toast(e.message, { type: 'error' });
    return false;
  } finally { btn?.classList.remove('is-busy'); }
}

async function openDetails(id) {
  let o;
  try { o = await api.order(id); } catch (e) { return toast(e.message, { type: 'error' }); }
  const body = h('div', { class: 'panel__body' });
  const panel = h('aside', { class: 'panel panel--side' },
    h('div', { class: 'panel__head' }, h('h2', {}, `Pedido #${o.number}`), h('button', { class: 'icon-btn', 'aria-label': 'Fechar', html: icons.close, onclick: () => close() })),
    body);
  const draw = () => {
    const admin = session.user.role === 'admin';
    const final = ['ENTREGUE', 'CANCELADO'].includes(o.status);
    const a = o.address || {};
    replace(body, h('div', { class: 'form' },
      h('div', {}, stPill(o.status), o.scheduled_for && h('span', { class: 'sched', style: { marginLeft: '8px' } }, `📅 ${o.scheduled_for}`)),
      h('section', { class: 'card' },
        h('h2', {}, 'Mudar status'),
        final && !admin ? h('p', { class: 'muted' }, 'Pedido finalizado. Só o administrador pode reabrir.') :
          h('div', { class: 'status-grid' }, [...o.flow, 'CANCELADO'].map((s) => h('button', {
            class: `btn btn--sm ${s === 'CANCELADO' ? 'btn--danger' : 'btn--line'}`, type: 'button', 'aria-current': s === o.status ? 'true' : 'false',
            onclick: async (e) => { if (s === o.status) return; const u = await change(o, s, e.currentTarget); if (u) { o = u; draw(); } },
          }, `${STATUS[s].emoji} ${STATUS[s].label}`)))),
      h('section', { class: 'card' },
        h('h2', {}, 'Cliente'),
        h('dl', { class: 'kv' },
          h('dt', {}, 'Nome'), h('dd', {}, o.customer_name),
          h('dt', {}, 'WhatsApp'), h('dd', {}, o.customer_phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')),
          h('dt', {}, 'Entrega'), h('dd', {}, o.fulfillment === 'delivery' ? 'Delivery' : 'Retirada'),
          o.fulfillment === 'delivery' && [h('dt', {}, 'Endereço'), h('dd', {}, `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''}`, h('br'), a.district, a.reference && [h('br'), `Ref.: ${a.reference}`])],
          h('dt', {}, 'Pagamento'), h('dd', {}, `${PAY[o.payment_method]}${o.payment_method === 'cash' ? (o.change_for_cents ? ` — troco para ${brl(o.change_for_cents)}` : ' — sem troco') : ''}`),
          h('dt', {}, 'Total'), h('dd', {}, h('b', {}, brl(o.total_cents)))),
        h('a', { class: 'btn btn--block', href: o.customerWhatsappUrl, target: '_blank', rel: 'noopener', style: { marginTop: '14px' } }, `💬 Avisar cliente: ${STATUS[o.status].label}`)),
      h('section', { class: 'card' },
        h('h2', {}, 'Mensagem de produção'),
        h('pre', { class: 'msg' }, o.productionMessage),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn--sm btn--line', type: 'button', onclick: () => copy(o.productionMessage) }, '📋 Copiar'),
          h('button', { class: 'btn btn--sm btn--line', type: 'button', onclick: () => printMsg(o) }, '🖨️ Imprimir'))),
      h('section', { class: 'card' },
        h('h2', {}, 'Histórico'),
        h('ul', { class: 'hist' }, o.history.map((x) => h('li', {}, h('span', {}, `${STATUS[x.status]?.emoji} ${STATUS[x.status]?.label}`), h('time', { class: 'muted' }, new Date(x.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))))),
        h('p', { class: 'muted', style: { marginTop: '10px', fontSize: '.85rem' } }, 'Link de acompanhamento do cliente: ', h('a', { href: o.tracking_url, target: '_blank', rel: 'noopener' }, 'abrir')))));
  };
  draw();
  const close = openPanel({ panel, label: `Pedido ${o.number}` });
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Mensagem copiada!', { icon: '📋' }); }
  catch { toast('Não foi possível copiar. Selecione o texto manualmente.', { type: 'error' }); }
}

/** Impressão simples (cupom) — preparada para trocar por impressora térmica no futuro. */
function printMsg(o) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return toast('Permita pop-ups para imprimir.', { type: 'error' });
  const pre = w.document.createElement('pre');
  pre.textContent = o.productionMessage;
  pre.style.cssText = 'font: 13px/1.4 monospace; white-space: pre-wrap; margin: 0;';
  w.document.title = `Pedido #${o.number}`;
  w.document.body.append(pre);
  w.focus();
  w.print();
}

/* ── Aviso de pedido novo: bip + título piscando ── */
let ctx;
function unlockAudio() { try { ctx ||= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); } catch { /* sem áudio */ } }
document.addEventListener('pointerdown', unlockAudio, { once: true });
function beep() {
  try {
    unlockAudio();
    const t = ctx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.value = [880, 1175, 1568][i];
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
      osc.connect(g).connect(ctx.destination);
      osc.start(t + d); osc.stop(t + d + 0.22);
    });
  } catch { /* sem áudio */ }
}
function startFlash(n) {
  stopFlash();
  let on = false;
  flash = setInterval(() => { on = !on; document.title = on ? `🔔 (${n}) Pedido novo!` : baseTitle; }, 900);
  const stop = () => { if (!document.hidden) { stopFlash(); window.removeEventListener('focus', stop); document.removeEventListener('pointerdown', stop); } };
  window.addEventListener('focus', stop);
  document.addEventListener('pointerdown', stop);
}
function stopFlash() { clearInterval(flash); flash = null; document.title = baseTitle; }
