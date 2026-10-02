import { db, rows } from '../db/database.js';

const active = (table, order = 'sort, id', json = []) =>
  rows(db.prepare(`SELECT * FROM ${table} WHERE active = 1 ORDER BY ${order}`).all(), json);

/** Catálogo público completo (somente itens ativos). */
export function getCatalog() {
  const categories = active('categories');
  const catIds = new Set(categories.map((c) => c.id));
  const products = active('products', 'sort, id', ['flavors']).filter((p) => catIds.has(p.category_id));
  const groups = active('addon_groups');
  const addons = active('addons');
  return {
    categories,
    products,
    builder: {
      sizes: active('builder_sizes'),
      groups: groups
        .map((g) => ({ ...g, addons: addons.filter((a) => a.group_id === g.id) }))
        .filter((g) => g.addons.length),
    },
    promotions: active('promotions', 'sort, id', ['weekdays']),
    zones: active('delivery_zones', 'sort, name'),
    gallery: active('gallery'),
  };
}

/** Lookups usados pelo cálculo de preço no servidor. */
export function loadPricingData() {
  const products = new Map(
    rows(db.prepare(`SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 AND c.active = 1`).all(), ['flavors'])
      .map((p) => [p.id, p]),
  );
  const sizes = new Map(rows(db.prepare('SELECT * FROM builder_sizes WHERE active = 1').all()).map((s) => [s.id, s]));
  const groups = new Map(rows(db.prepare('SELECT * FROM addon_groups WHERE active = 1 ORDER BY sort, id').all()).map((g) => [g.id, g]));
  const addons = new Map(rows(db.prepare('SELECT * FROM addons WHERE active = 1').all()).filter((a) => groups.has(a.group_id)).map((a) => [a.id, a]));
  const zones = new Map(rows(db.prepare('SELECT * FROM delivery_zones WHERE active = 1').all()).map((z) => [z.id, z]));
  const promotions = rows(db.prepare('SELECT * FROM promotions WHERE active = 1').all(), ['weekdays']);
  return { products, sizes, groups, addons, zones, promotions };
}
