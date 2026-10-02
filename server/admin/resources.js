import { db, row, rows } from '../db/database.js';
import { HttpError } from '../lib/http.js';
import { Validator, slugify } from '../lib/validate.js';

/**
 * Definição ÚNICA dos cadastros do painel. O servidor valida com ela e o painel
 * monta formulários e tabelas a partir dela (GET /api/admin/schema).
 * Para adicionar um campo: crie a coluna no schema.sql e acrescente aqui.
 */
export const RESOURCES = {
  products: {
    table: 'products', label: 'Produtos', singular: 'produto', order: 'category_id, sort, id',
    columns: ['image', 'name', 'category_id', 'price_cents', 'active'],
    fields: {
      name: { type: 'text', label: 'Nome', required: true, max: 80 },
      category_id: { type: 'ref', label: 'Categoria', ref: 'categories', required: true },
      description: { type: 'textarea', label: 'Descrição', max: 300 },
      price_cents: { type: 'money', label: 'Preço', required: true },
      image: { type: 'image', label: 'Foto' },
      badge: { type: 'select', label: 'Selo', options: ['', 'Mais pedido', 'Novidade', 'Favorito', 'Promo', 'Combo'] },
      featured: { type: 'bool', label: 'Aparece em "Os queridinhos"' },
      flavors: { type: 'list', label: 'Sabores para escolher', hint: 'Separe por vírgula. Deixe vazio se não houver escolha de sabor.' },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Disponível', default: true },
      slug: { type: 'slug', from: 'name', hidden: true },
    },
  },
  categories: {
    table: 'categories', label: 'Categorias', singular: 'categoria', order: 'sort, id',
    columns: ['name', 'description', 'sort', 'active'],
    fields: {
      name: { type: 'text', label: 'Nome', required: true, max: 40 },
      description: { type: 'textarea', label: 'Descrição', max: 200 },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Visível no cardápio', default: true },
      slug: { type: 'slug', from: 'name', hidden: true },
    },
  },
  sizes: {
    table: 'builder_sizes', label: 'Tamanhos (Monte seu açaí)', singular: 'tamanho', order: 'sort, id',
    columns: ['name', 'price_cents', 'free_items', 'active'],
    fields: {
      name: { type: 'text', label: 'Nome', required: true, max: 30, hint: 'Ex.: 500ml, Tigela 500g' },
      ml: { type: 'int', label: 'Volume (ml)', default: 0 },
      description: { type: 'text', label: 'Descrição curta', max: 80 },
      price_cents: { type: 'money', label: 'Preço base', required: true },
      free_items: { type: 'int', label: 'Ingredientes grátis inclusos', default: 0, min: 0, max: 20 },
      image: { type: 'image', label: 'Foto' },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Disponível', default: true },
    },
  },
  addon_groups: {
    table: 'addon_groups', label: 'Etapas (grupos)', singular: 'etapa', order: 'sort, id',
    columns: ['name', 'min_select', 'max_select', 'counts_as_free', 'active'],
    fields: {
      name: { type: 'text', label: 'Nome da etapa', required: true, max: 40 },
      description: { type: 'text', label: 'Instrução para o cliente', max: 120 },
      min_select: { type: 'int', label: 'Mínimo de escolhas', default: 0, min: 0, max: 20 },
      max_select: { type: 'int', label: 'Máximo de escolhas', default: 5, min: 1, max: 30 },
      counts_as_free: { type: 'bool', label: 'Entra na cota de grátis do tamanho', default: true },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Ativa', default: true },
      slug: { type: 'slug', from: 'name', hidden: true },
    },
  },
  addons: {
    table: 'addons', label: 'Ingredientes', singular: 'ingrediente', order: 'group_id, sort, id',
    columns: ['name', 'group_id', 'price_cents', 'is_free', 'active'],
    fields: {
      name: { type: 'text', label: 'Nome', required: true, max: 40 },
      group_id: { type: 'ref', label: 'Etapa', ref: 'addon_groups', required: true },
      price_cents: { type: 'money', label: 'Preço', default: 0 },
      is_free: { type: 'bool', label: 'Sempre grátis' },
      color: { type: 'color', label: 'Cor do ícone', default: '#8B2FC9' },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Disponível', default: true },
    },
  },
  promotions: {
    table: 'promotions', label: 'Promoções', singular: 'promoção', order: 'sort, id',
    columns: ['title', 'percent_off', 'amount_off_cents', 'min_subtotal_cents', 'active'],
    fields: {
      title: { type: 'text', label: 'Título', required: true, max: 60 },
      subtitle: { type: 'textarea', label: 'Texto', max: 200 },
      badge: { type: 'text', label: 'Selo', max: 20 },
      percent_off: { type: 'int', label: 'Desconto (%)', default: 0, min: 0, max: 90 },
      amount_off_cents: { type: 'money', label: 'Desconto (R$)', default: 0 },
      min_subtotal_cents: { type: 'money', label: 'Pedido mínimo para valer', default: 0 },
      weekdays: { type: 'weekdays', label: 'Dias da semana', hint: 'Nenhum marcado = todos os dias' },
      starts_at: { type: 'date', label: 'Começa em' },
      ends_at: { type: 'date', label: 'Termina em' },
      theme: { type: 'select', label: 'Cor do banner', options: ['roxo', 'dourado', 'morango'] },
      image: { type: 'image', label: 'Imagem' },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Ativa', default: true },
    },
  },
  zones: {
    table: 'delivery_zones', label: 'Bairros e taxas', singular: 'bairro', order: 'sort, name',
    columns: ['name', 'fee_cents', 'extra_minutes', 'active'],
    fields: {
      name: { type: 'text', label: 'Bairro', required: true, max: 60 },
      fee_cents: { type: 'money', label: 'Taxa de entrega', default: 0 },
      extra_minutes: { type: 'int', label: 'Minutos extras no prazo', default: 0, min: 0, max: 120 },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Atende', default: true },
    },
  },
  gallery: {
    table: 'gallery', label: 'Galeria', singular: 'foto', order: 'sort, id',
    columns: ['image', 'caption', 'layout', 'active'],
    fields: {
      image: { type: 'image', label: 'Foto', required: true },
      caption: { type: 'text', label: 'Legenda', max: 80 },
      layout: { type: 'select', label: 'Formato no grid', options: ['normal', 'alto', 'largo'] },
      sort: { type: 'int', label: 'Ordem', default: 0 },
      active: { type: 'bool', label: 'Visível', default: true },
    },
  },
};

const JSON_FIELDS = (def) => Object.entries(def.fields).filter(([, f]) => f.type === 'list' || f.type === 'weekdays').map(([k]) => k);

export function getResource(name) {
  const def = RESOURCES[name];
  if (!def) throw new HttpError(404, 'Cadastro não encontrado.');
  return def;
}

export function listResource(name) {
  const def = getResource(name);
  return rows(db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.order}`).all(), JSON_FIELDS(def));
}

function validate(def, input, existing) {
  const v = new Validator();
  const out = {};
  for (const [k, f] of Object.entries(def.fields)) {
    let val = input[k];
    if (val === undefined && existing) continue; // atualização parcial
    if (val === undefined) val = f.default;
    switch (f.type) {
      case 'text': case 'textarea':
        out[k] = v.text(k, val, { required: f.required, max: f.max || 200, label: f.label.toLowerCase(), multiline: f.type === 'textarea' }) ?? '';
        break;
      case 'money': {
        const n = v.int(k, val === '' || val === undefined ? (f.required ? undefined : 0) : val, { required: f.required, min: 0, max: 10_000_000, label: f.label.toLowerCase() });
        out[k] = n ?? 0; break;
      }
      case 'int': out[k] = v.int(k, val ?? 0, { min: f.min ?? -100000, max: f.max ?? 100000, label: f.label.toLowerCase() }) ?? 0; break;
      case 'bool': out[k] = v.bool(val) ? 1 : 0; break;
      case 'select': out[k] = f.options.includes(val ?? '') ? (val ?? '') : (v.fail(k, `Opção inválida em ${f.label}.`), ''); break;
      case 'color': out[k] = /^#[0-9a-fA-F]{6}$/.test(val || '') ? val : f.default; break;
      case 'date': out[k] = val && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : ''; break;
      case 'image': {
        const s = String(val || '');
        if (s && !/^\/(uploads|assets)\/[\w\-./]+$/.test(s)) v.fail(k, 'Imagem inválida. Envie a foto pelo botão de upload.');
        if (!s && f.required) v.fail(k, `Envie ${f.label.toLowerCase()}.`);
        out[k] = s; break;
      }
      case 'list': {
        const arr = (Array.isArray(val) ? val : String(val || '').split(',')).map((x) => String(x).replace(/[<>]/g, '').trim()).filter(Boolean).slice(0, 40);
        out[k] = JSON.stringify([...new Set(arr)]); break;
      }
      case 'weekdays': {
        const arr = (Array.isArray(val) ? val : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        out[k] = JSON.stringify([...new Set(arr)].sort()); break;
      }
      case 'ref': {
        const id = Number(val);
        const target = RESOURCES[f.ref].table;
        if (!db.prepare(`SELECT id FROM ${target} WHERE id = ?`).get(id)) v.fail(k, `Escolha ${f.label.toLowerCase()}.`);
        out[k] = id; break;
      }
      case 'slug': {
        const base = slugify(input[f.from] ?? existing?.[f.from]) || 'item';
        let slug = base, i = 2;
        while (db.prepare(`SELECT id FROM ${def.table} WHERE slug = ? AND id != ?`).get(slug, existing?.id ?? -1)) slug = `${base}-${i++}`;
        out[k] = slug; break;
      }
    }
  }
  if (def.table === 'addon_groups') {
    const min = out.min_select ?? existing?.min_select, max = out.max_select ?? existing?.max_select;
    if (min > max) v.fail('min_select', 'O mínimo não pode ser maior que o máximo.');
  }
  v.assert();
  return out;
}

export function createResource(name, input) {
  const def = getResource(name);
  const data = validate(def, input, null);
  const keys = Object.keys(data);
  const info = db.prepare(`INSERT INTO ${def.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
  return row(db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(info.lastInsertRowid), JSON_FIELDS(def));
}

export function updateResource(name, id, input) {
  const def = getResource(name);
  const existing = db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(Number(id));
  if (!existing) throw new HttpError(404, 'Registro não encontrado.');
  const data = validate(def, input, existing);
  if (def.fields.slug && input[def.fields.slug.from] === undefined) delete data.slug;
  const keys = Object.keys(data);
  if (keys.length) db.prepare(`UPDATE ${def.table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => data[k]), existing.id);
  return row(db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(existing.id), JSON_FIELDS(def));
}

export function deleteResource(name, id) {
  const def = getResource(name);
  try {
    const r = db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(Number(id));
    if (!r.changes) throw new HttpError(404, 'Registro não encontrado.');
  } catch (e) {
    if (String(e.message).includes('FOREIGN KEY')) throw new HttpError(409, `Este ${def.singular} ainda tem itens ligados a ele. Mova ou exclua esses itens antes — ou apenas desative.`);
    throw e;
  }
}

/** Esquema enviado ao painel (sem nomes de tabela). */
export function publicSchema() {
  return Object.fromEntries(Object.entries(RESOURCES).map(([k, d]) => [k, { label: d.label, singular: d.singular, columns: d.columns, fields: d.fields }]));
}
