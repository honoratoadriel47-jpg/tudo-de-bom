import { h, replace, icons } from '../ui/dom.js';
import { brl, parseMoney } from '../ui/format.js';
import { openPanel } from '../ui/overlay.js';
import { toast } from '../ui/toast.js';
import { api } from './api.js';
import { session } from './main.js';

/**
 * Cadastros genéricos (produtos, categorias, tamanhos, etapas, ingredientes, promoções, bairros, galeria).
 * Tabela + formulário são montados a partir do esquema do servidor — um campo novo lá aparece aqui.
 */
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HELP = {
  products: 'Produtos prontos do cardápio. Desative em vez de excluir quando um item acabar.',
  categories: 'Seções do cardápio, na ordem em que aparecem.',
  sizes: 'Tamanhos do "Monte seu açaí". "Ingredientes grátis" define quantos acompanhamentos já vêm no preço.',
  addon_groups: 'Cada etapa vira um passo do "Monte seu açaí" (Base, Frutas, Coberturas…).',
  addons: 'Ingredientes de cada etapa. Preço 0 ou "Sempre grátis" = sem custo.',
  promotions: 'O melhor desconto aplicável entra sozinho no carrinho.',
  zones: 'Bairros atendidos no delivery, com a taxa de cada um.',
  gallery: 'Fotos da galeria do site. Formato "alto" ou "largo" ocupa mais espaço.',
};

const refCache = {};
async function refOptions(ref) {
  refCache[ref] ||= await api.list(ref);
  return refCache[ref];
}

export async function renderResource(root, name) {
  const def = session.schema[name];
  if (!def) throw new Error('Cadastro não encontrado.');
  document.title = `${def.label} — Painel TUDO DE BOM`;
  Object.keys(refCache).forEach((k) => delete refCache[k]);
  const tableBox = h('div', { class: 'table-wrap' }, h('div', { class: 'skeleton on-cream', style: { height: '240px' } }));
  replace(root,
    h('div', { class: 'page-head' }, h('h1', {}, def.label),
      h('button', { class: 'btn btn--sm btn--grape', type: 'button', onclick: () => openForm(name, null, reload) }, `+ Adicionar ${def.singular}`)),
    HELP[name] && h('p', { class: 'muted', style: { marginBottom: '14px' } }, HELP[name]),
    tableBox);

  async function reload() {
    const [items] = await Promise.all([api.list(name), ...Object.values(def.fields).filter((f) => f.type === 'ref').map((f) => refOptions(f.ref))]);
    replace(tableBox, table(name, def, items, reload));
  }
  await reload();
}

function cell(f, v, key, item, name, reload) {
  if (!f) return v;
  switch (f.type) {
    case 'image': return v ? h('img', { src: v, alt: '', loading: 'lazy' }) : '—';
    case 'money': return brl(v);
    case 'bool': {
      const input = h('input', { type: 'checkbox', checked: !!v, 'aria-label': f.label });
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('change', async () => {
        try { await api.update(name, item.id, { [key]: input.checked }); toast(input.checked ? `${f.label}: sim` : `${f.label}: não`, { icon: '✔️' }); reload(); }
        catch (e) { input.checked = !input.checked; toast(e.message, { type: 'error' }); }
      });
      return h('label', { class: 'switch', onclick: (e) => e.stopPropagation() }, input, h('i'));
    }
    case 'ref': return refCache[f.ref]?.find((r) => r.id === v)?.name || '—';
    case 'textarea': return String(v || '').slice(0, 60) + (String(v || '').length > 60 ? '…' : '');
    default: return v === '' || v === null || v === undefined ? '—' : String(v);
  }
}

function table(name, def, items, reload) {
  if (!items.length) return h('div', { class: 'empty' }, h('b', {}, '🫙'), 'Nada cadastrado ainda.');
  const cols = def.columns;
  const groupBy = name === 'products' ? 'category_id' : name === 'addons' ? 'group_id' : null;
  const rows = [];
  let lastGroup;
  for (const it of items) {
    if (groupBy && it[groupBy] !== lastGroup) {
      lastGroup = it[groupBy];
      rows.push(h('tr', { class: 'group-row' }, h('td', { colspan: cols.length }, cell(def.fields[groupBy], it[groupBy]))));
    }
    const tr = h('tr', { class: it.active === 0 ? 'is-off' : '', tabindex: 0, 'aria-label': `Editar ${it.name || it.title || it.caption || def.singular}` },
      cols.map((c) => h('td', { class: def.fields[c]?.type === 'money' ? 'num' : '' }, cell(def.fields[c], it[c], c, it, name, reload))));
    const open = () => openForm(name, it, reload);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    rows.push(tr);
  }
  return h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: def.fields[c]?.type === 'money' ? 'num' : '' }, def.fields[c]?.label || c)))),
    h('tbody', {}, rows));
}

async function openForm(name, item, reload) {
  const def = session.schema[name];
  const isNew = !item;
  const values = {};
  const controls = {};
  const errors = {};
  const fieldsEl = h('div', { class: 'form' });

  for (const [key, f] of Object.entries(def.fields)) {
    if (f.hidden) continue;
    const cur = item ? item[key] : f.default;
    const id = `f-${key}`;
    let control, getter;
    switch (f.type) {
      case 'textarea':
        control = h('textarea', { class: 'textarea', id, maxlength: f.max || 300 }, cur || '');
        getter = () => control.value; break;
      case 'money':
        control = h('input', { class: 'input', id, inputmode: 'decimal', value: cur ? (cur / 100).toFixed(2).replace('.', ',') : '', placeholder: '0,00' });
        getter = () => parseMoney(control.value) ?? 0; break;
      case 'int':
        control = h('input', { class: 'input', id, type: 'number', inputmode: 'numeric', value: cur ?? 0, min: f.min, max: f.max });
        getter = () => (control.value === '' ? 0 : Number(control.value)); break;
      case 'bool': {
        const input = h('input', { type: 'checkbox', id, checked: !!cur });
        control = h('label', { class: 'switch', for: id }, input, h('i'), f.label);
        getter = () => input.checked; break;
      }
      case 'select':
        control = h('select', { class: 'select', id }, f.options.map((o) => h('option', { value: o, selected: o === (cur ?? '') }, o || '— nenhum —')));
        getter = () => control.value; break;
      case 'ref': {
        const opts = await refOptions(f.ref);
        control = h('select', { class: 'select', id }, h('option', { value: '' }, 'Escolha…'), opts.map((o) => h('option', { value: o.id, selected: o.id === cur }, o.name)));
        getter = () => Number(control.value) || null; break;
      }
      case 'color':
        control = h('input', { class: 'input', id, type: 'color', value: cur || '#8B2FC9', style: { padding: '4px', width: '80px' } });
        getter = () => control.value; break;
      case 'date':
        control = h('input', { class: 'input', id, type: 'date', value: cur || '' });
        getter = () => control.value; break;
      case 'list':
        control = h('input', { class: 'input', id, value: Array.isArray(cur) ? cur.join(', ') : '' });
        getter = () => control.value.split(',').map((s) => s.trim()).filter(Boolean); break;
      case 'weekdays': {
        const set = new Set(Array.isArray(cur) ? cur : []);
        control = h('div', { class: 'days', role: 'group', 'aria-label': f.label }, WEEKDAYS.map((d, i) => h('label', {},
          h('input', { type: 'checkbox', value: i, checked: set.has(i) }), h('span', {}, d))));
        getter = () => [...control.querySelectorAll('input:checked')].map((x) => Number(x.value)); break;
      }
      case 'image': {
        let url = cur || '';
        const img = h('img', { src: url || '/assets/brand/icon-192.png', alt: 'Prévia' });
        const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id, class: 'sr-only' });
        const status = h('small', { class: 'muted' }, url ? url.split('/').pop() : 'Nenhuma imagem');
        file.addEventListener('change', async () => {
          const fl = file.files[0];
          if (!fl) return;
          if (fl.size > 5 * 1024 * 1024) return toast('Imagem acima de 5 MB. Reduza e tente de novo.', { type: 'error' });
          status.textContent = 'Enviando…';
          try { url = (await api.upload(fl)).url; img.src = url; status.textContent = 'Foto enviada ✔'; }
          catch (e) { status.textContent = e.message; toast(e.message, { type: 'error' }); }
          file.value = '';
        });
        control = h('div', { class: 'img-field' }, img,
          h('div', { style: { display: 'grid', gap: '6px' } },
            h('label', { class: 'btn btn--sm btn--line', for: id, tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, '📷 Enviar foto'),
            status, f.required ? null : h('button', { class: 'btn btn--sm btn--line', type: 'button', onclick: () => { url = ''; img.src = '/assets/brand/icon-192.png'; status.textContent = 'Sem imagem'; } }, 'Remover')), file);
        getter = () => url; break;
      }
      default:
        control = h('input', { class: 'input', id, value: cur ?? '', maxlength: f.max || 200 });
        getter = () => control.value;
    }
    controls[key] = getter;
    const err = h('span', { class: 'error' });
    errors[key] = err;
    fieldsEl.append(f.type === 'bool'
      ? h('div', { class: 'field' }, control, err)
      : h('div', { class: 'field' }, h('label', { for: id }, h('span', { style: { fontWeight: 700, fontSize: '.92rem' } }, f.label, f.required ? ' *' : '')), control, f.hint && h('small', {}, f.hint), err));
  }

  const formErr = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn--grape', type: 'submit', form: 'crud-form' }, isNew ? 'Adicionar' : 'Salvar');
  const del = !isNew && h('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
    if (!confirm(`Excluir este ${def.singular}? Esta ação não pode ser desfeita.`)) return;
    try { await api.remove(name, item.id); toast('Excluído.', { icon: '🗑️' }); close(); reload(); }
    catch (e) { formErr.textContent = e.message; formErr.hidden = false; }
  } }, 'Excluir');

  const form = h('form', { id: 'crud-form', novalidate: true }, fieldsEl, formErr);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.values(errors).forEach((x) => (x.textContent = ''));
    formErr.hidden = true;
    for (const [k, get] of Object.entries(controls)) values[k] = get();
    save.classList.add('is-busy');
    try {
      if (isNew) await api.create(name, values); else await api.update(name, item.id, values);
      toast(isNew ? `${cap(def.singular)} adicionado(a)!` : 'Alterações salvas!', { icon: '💾' });
      close();
      reload();
    } catch (ex) {
      for (const [k, m] of Object.entries(ex.details || {})) if (errors[k]) errors[k].textContent = m;
      formErr.textContent = ex.message;
      formErr.hidden = false;
    } finally { save.classList.remove('is-busy'); }
  });

  const panel = h('aside', { class: 'panel panel--side' },
    h('div', { class: 'panel__head' }, h('h2', {}, isNew ? `Novo ${def.singular}` : `Editar ${def.singular}`), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar', html: icons.close, onclick: () => close() })),
    h('div', { class: 'panel__body' }, form),
    h('div', { class: 'panel__foot', style: { display: 'flex', gap: '10px', justifyContent: 'space-between' } }, del || h('span'), save));
  const close = openPanel({ panel, label: isNew ? `Novo ${def.singular}` : `Editar ${def.singular}` });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
