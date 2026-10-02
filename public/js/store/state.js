/** Estado global simples + barramento de eventos. */
export const state = {
  catalog: null,   // categorias, produtos, builder, promoções, bairros, galeria
  settings: null,  // configurações públicas da loja
  store: null,     // { open, label, slots, hours }
};

const bus = new EventTarget();
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

/** Índices para buscas rápidas. */
export function indexCatalog(c) {
  c.productById = new Map(c.products.map((p) => [p.id, p]));
  c.sizeById = new Map(c.builder.sizes.map((s) => [s.id, s]));
  c.addonById = new Map();
  for (const g of c.builder.groups) for (const a of g.addons) c.addonById.set(a.id, { ...a, groupId: g.id, groupName: g.name, counts_as_free: g.counts_as_free });
  return c;
}
