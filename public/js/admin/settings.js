import { h, replace } from '../ui/dom.js';
import { parseMoney, maskPhone } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { api } from './api.js';

/** Configurações gerais: loja, WhatsApp, endereço, horários, tempos, entrega, pagamentos e agendamento. */
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function renderSettings(root) {
  document.title = 'Configurações — Painel TUDO DE BOM';
  const s = await api.settings();
  const errs = {};
  const err = (k) => (errs[k] = h('span', { class: 'error' }));
  const text = (id, label, value, attrs = {}, hint) => {
    const input = h('input', { class: 'input', id, value: value ?? '', ...attrs });
    return { input, el: h('div', { class: 'field' }, h('label', { for: id }, h('span', { style: { fontWeight: 700, fontSize: '.92rem' } }, label)), input, hint && h('small', {}, hint), err(id)) };
  };
  const money = (id, label, cents, hint) => text(id, label, cents ? (cents / 100).toFixed(2).replace('.', ',') : '0,00', { inputmode: 'decimal' }, hint);
  const num = (id, label, v) => text(id, label, v, { type: 'number', min: 0, inputmode: 'numeric' });
  const sw = (id, label, on) => {
    const input = h('input', { type: 'checkbox', id, checked: !!on });
    return { input, el: h('label', { class: 'switch', for: id }, input, h('i'), label) };
  };

  // Loja
  const storeName = text('storeName', 'Nome da loja', s.storeName, { maxlength: 40 });
  const tagline = text('tagline', 'Frase de destaque', s.tagline, { maxlength: 120 });
  const whatsapp = text('whatsapp', 'WhatsApp da loja (recebe os pedidos)', maskPhone(String(s.whatsapp).replace(/^55/, '')), { type: 'tel', inputmode: 'tel' }, 'Com DDD. É para este número que os pedidos são enviados.');
  whatsapp.input.addEventListener('input', () => { whatsapp.input.value = maskPhone(whatsapp.input.value); });
  const instagram = text('instagram', 'Instagram (sem @)', s.instagram, { maxlength: 40 });
  const pixKey = text('pixKey', 'Chave PIX', s.pixKey, { maxlength: 100 }, 'Mostrada ao cliente que escolher PIX.');
  const mapsUrl = text('mapsUrl', 'Link do Google Maps', s.mapsUrl, { type: 'url', placeholder: 'https://maps.app.goo.gl/…' });
  let logo = s.logo;
  const logoImg = h('img', { src: logo, alt: 'Logo atual', style: { width: '120px', height: 'auto', objectFit: 'contain', background: 'var(--acai)', padding: '8px', borderRadius: '14px' } });
  const logoFile = h('input', { type: 'file', accept: 'image/png,image/webp,image/jpeg', id: 'logo-file', class: 'sr-only' });
  logoFile.addEventListener('change', async () => {
    const f = logoFile.files[0]; if (!f) return;
    try { logo = (await api.upload(f)).url; logoImg.src = logo; toast('Logo enviada. Clique em Salvar para aplicar.', { icon: '🖼️' }); }
    catch (e) { toast(e.message, { type: 'error' }); }
  });

  // Endereço
  const a = s.address || {};
  const street = text('address.street', 'Rua', a.street), number = text('address.number', 'Número', a.number),
    district = text('address.district', 'Bairro', a.district), city = text('address.city', 'Cidade', a.city), reference = text('address.reference', 'Referência', a.reference);

  // Status manual
  const statusRow = h('div', { class: 'radio-row', role: 'radiogroup', 'aria-label': 'Status da loja' },
    [['auto', '🕒 Automático (pelo horário)'], ['open', '🟢 Forçar ABERTO'], ['closed', '🔴 Forçar FECHADO']].map(([v, l]) =>
      h('label', {}, h('input', { type: 'radio', name: 'manualStatus', value: v, checked: s.manualStatus === v }), h('span', {}, l))));

  // Horários
  const hourRows = s.hours.map((d, i) => {
    const closed = h('input', { type: 'checkbox', checked: !d.closed, 'aria-label': `${DAYS[i]} aberto` });
    const open = h('input', { class: 'input', type: 'time', value: d.open, 'aria-label': `${DAYS[i]} abre às` });
    const close = h('input', { class: 'input', type: 'time', value: d.close, 'aria-label': `${DAYS[i]} fecha às` });
    const sync = () => { open.disabled = close.disabled = !closed.checked; };
    closed.addEventListener('change', sync); sync();
    return { closed, open, close, el: h('div', { class: 'row' }, h('b', {}, DAYS[i]), h('label', { class: 'switch' }, closed, h('i')), open, close) };
  });

  // Tempos, entrega, pagamentos, agendamento
  const p = s.prep;
  const pickupMin = num('prep.pickupMin', 'Retirada: mínimo (min)', p.pickupMin), pickupMax = num('prep.pickupMax', 'Retirada: máximo (min)', p.pickupMax),
    deliveryMin = num('prep.deliveryMin', 'Delivery: mínimo (min)', p.deliveryMin), deliveryMax = num('prep.deliveryMax', 'Delivery: máximo (min)', p.deliveryMax);
  const dl = s.delivery;
  const delOn = sw('del-on', 'Delivery ativo', dl.enabled), pickOn = sw('pick-on', 'Retirada no balcão ativa', dl.pickupEnabled);
  const minOrder = money('delivery.minOrderCents', 'Pedido mínimo para delivery', dl.minOrderCents);
  const freeAbove = money('delivery.freeAboveCents', 'Frete grátis acima de', dl.freeAboveCents, 'Use 0 para desativar o frete grátis.');
  const pays = { pix: sw('pay-pix', 'PIX', s.payments.pix), cash: sw('pay-cash', 'Dinheiro', s.payments.cash), credit: sw('pay-credit', 'Cartão de crédito', s.payments.credit), debit: sw('pay-debit', 'Cartão de débito', s.payments.debit) };
  const sched = sw('sched-on', 'Aceitar pedidos agendados quando a loja estiver fechada', s.scheduling.allowWhenClosed);
  const slot = num('scheduling.slotMinutes', 'Intervalo entre horários (min)', s.scheduling.slotMinutes);

  const formErr = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn--grape', type: 'submit' }, 'Salvar configurações');
  const card = (title, ...c) => h('section', { class: 'card' }, h('h2', {}, title), ...c);

  const form = h('form', { class: 'form', novalidate: true },
    card('Loja',
      h('div', { class: 'form-grid' }, storeName.el, whatsapp.el, instagram.el, pixKey.el),
      h('div', { class: 'form-grid', style: { marginTop: '14px' } }, tagline.el, mapsUrl.el),
      h('div', { class: 'field', style: { marginTop: '14px' } }, h('span', { style: { fontWeight: 700 } }, 'Logo'),
        h('div', { class: 'img-field' }, logoImg, h('div', { style: { display: 'grid', gap: '6px' } },
          h('label', { class: 'btn btn--sm btn--line', for: 'logo-file', tabindex: 0 }, '🖼️ Trocar logo'),
          h('button', { class: 'btn btn--sm btn--line', type: 'button', onclick: () => { logo = '/assets/brand/logo.webp'; logoImg.src = logo; } }, 'Usar logo original'),
          h('small', { class: 'muted' }, 'PNG ou WEBP com fundo transparente fica melhor.')), logoFile), err('logo'))),
    card('Status da loja', h('p', { class: 'muted', style: { marginBottom: '10px' } }, 'No automático, o site abre e fecha sozinho de acordo com os horários abaixo.'), statusRow),
    card('Horário de funcionamento', h('div', { class: 'hours-edit' }, hourRows.map((r) => r.el)), err('hours')),
    card('Endereço da loja', h('div', { class: 'form-grid' }, street.el, number.el, district.el, city.el, reference.el)),
    card('Tempo de preparo', h('div', { class: 'form-grid' }, pickupMin.el, pickupMax.el, deliveryMin.el, deliveryMax.el), err('prep')),
    card('Entrega', h('div', { style: { display: 'grid', gap: '12px' } }, delOn.el, pickOn.el, h('div', { class: 'form-grid' }, minOrder.el, freeAbove.el)), err('delivery'),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, 'As taxas por bairro ficam em ', h('a', { href: '#/r/zones' }, 'Bairros e taxas'), '.')),
    card('Formas de pagamento', h('div', { style: { display: 'grid', gap: '12px' } }, Object.values(pays).map((x) => x.el)), err('payments')),
    card('Pedidos agendados', h('div', { style: { display: 'grid', gap: '12px' } }, sched.el, h('div', { class: 'form-grid' }, slot.el))),
    formErr,
    h('div', { class: 'save-bar' }, save));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.values(errs).forEach((x) => (x.textContent = ''));
    formErr.hidden = true;
    const data = {
      storeName: storeName.input.value, tagline: tagline.input.value, whatsapp: whatsapp.input.value, instagram: instagram.input.value,
      pixKey: pixKey.input.value, mapsUrl: mapsUrl.input.value, logo,
      manualStatus: form.querySelector('input[name="manualStatus"]:checked')?.value || 'auto',
      address: { street: street.input.value, number: number.input.value, district: district.input.value, city: city.input.value, reference: reference.input.value },
      hours: hourRows.map((r) => ({ closed: !r.closed.checked, open: r.open.value, close: r.close.value })),
      prep: { pickupMin: Number(pickupMin.input.value), pickupMax: Number(pickupMax.input.value), deliveryMin: Number(deliveryMin.input.value), deliveryMax: Number(deliveryMax.input.value) },
      delivery: { enabled: delOn.input.checked, pickupEnabled: pickOn.input.checked, minOrderCents: parseMoney(minOrder.input.value) ?? 0, freeAboveCents: parseMoney(freeAbove.input.value) ?? 0 },
      payments: Object.fromEntries(Object.entries(pays).map(([k, x]) => [k, x.input.checked])),
      scheduling: { allowWhenClosed: sched.input.checked, slotMinutes: Number(slot.input.value) || 30 },
    };
    save.classList.add('is-busy');
    try {
      await api.saveSettings(data);
      toast('Configurações salvas! O site já foi atualizado.', { icon: '💾' });
    } catch (ex) {
      for (const [k, m] of Object.entries(ex.details || {})) {
        const key = errs[k] ? k : k.split('.')[0];
        if (errs[key]) errs[key].textContent = m;
      }
      formErr.textContent = ex.message;
      formErr.hidden = false;
      formErr.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally { save.classList.remove('is-busy'); }
  });

  replace(root, h('div', { class: 'page-head' }, h('h1', {}, 'Configurações')), form);
}
