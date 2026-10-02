/**
 * DADOS DE EXEMPLO — produtos, preços e fotos FICTÍCIOS.
 * Substitua pelo painel (/admin) ou edite este arquivo e rode `npm run seed` (apaga tudo e recria).
 * As imagens em /assets/img/produtos/*.svg são ilustrações provisórias: troque pelas fotos reais.
 */
import { db, tx } from './database.js';
import { saveSettings, DEFAULT_SETTINGS } from '../services/settings.service.js';
import { slugify } from '../lib/validate.js';

const img = (n) => `/assets/img/produtos/${n}.svg`;
const R = (reais) => Math.round(reais * 100);

const CATEGORIES = [
  { name: 'Açaí da casa', description: 'Copos e tigelas já montados com as combinações que mais saem.' },
  { name: 'Picolés', description: 'Feitos com fruta de verdade e cremes artesanais.' },
  { name: 'Baldes de sorvete', description: 'Para dividir (ou não). Escolha o sabor.' },
  { name: 'Milk-shakes', description: 'Batidos na hora, bem cremosos.' },
  { name: 'Sorvetes', description: 'Casquinhas, taças e clássicos de sorveteria.' },
  { name: 'Sobremesas', description: 'Para quem quer um docinho a mais.' },
  { name: 'Combos', description: 'Mais sabor por menos.' },
];

const BALDE_FLAVORS = ['Chocolate', 'Morango', 'Flocos', 'Napolitano', 'Ninho', 'Creme', 'Maracujá', 'Açaí', 'Coco'];
const SHAKE_FLAVORS = ['Ovomaltine', 'Ninho com Nutella', 'Morango', 'Chocolate', 'Açaí com banana'];
const SORVETE_FLAVORS = ['Chocolate', 'Morango', 'Flocos', 'Ninho', 'Creme', 'Maracujá'];

// [categoria, nome, descrição, preço, imagem, selo, destaque, sabores]
const PRODUCTS = [
  [0, 'Açaí 300ml Tradicional', 'Açaí cremoso com banana, granola crocante e leite condensado.', 15.9, 'acai-copo', '', 0],
  [0, 'Açaí 500ml Tropical', 'Morango, kiwi, manga, granola e um fio de mel.', 24.9, 'acai-morango', 'Favorito', 1],
  [0, 'Especial da Casa 700ml', 'Camadas de Nutella, morango, leite em pó, paçoca e KitKat. O nosso orgulho.', 34.9, 'acai-especial', 'Mais pedido', 1],
  [0, 'Açaí na Tigela 500g', 'Servido na tigela com banana, morango, granola e mel. Para comer de colher, sem pressa.', 26.9, 'acai-tigela', '', 1],
  [0, 'Açaí Família 1L', 'Açaí puro para montar em casa, com 4 acompanhamentos à parte.', 42.9, 'acai-familia', '', 0],
  [0, 'Roxinho Zero 400ml', 'Açaí zero açúcar com morango, kiwi e granola sem açúcar.', 21.9, 'acai-zero', 'Novidade', 0],
  [1, 'Picolé de Morango ao Leite', 'Pedaços de morango em creme de leite.', 5.5, 'picole-morango', '', 0],
  [1, 'Picolé Chocolate Belga', 'Chocolate intenso com casquinha crocante.', 6.5, 'picole-chocolate', '', 0],
  [1, 'Picolé de Coco Queimado', 'Coco fresco caramelizado.', 5.0, 'picole-coco', '', 0],
  [1, 'Picolé de Maracujá', 'Azedinho na medida, feito com polpa da fruta.', 4.5, 'picole-maracuja', '', 0],
  [1, 'Picolé de Açaí com Banana', 'O nosso açaí em versão palito.', 6.0, 'picole-acai', '', 0],
  [1, 'Picolé Ninho Trufado', 'Creme de leite Ninho com recheio trufado de chocolate.', 7.5, 'picole-ninho', 'Novidade', 1],
  [2, 'Balde 1L', 'Um litro do sabor que você escolher.', 24.9, 'balde-1l', '', 0, BALDE_FLAVORS],
  [2, 'Balde 2L', 'Para a família toda. Escolha o sabor.', 42.9, 'balde-2l', 'Favorito', 0, BALDE_FLAVORS],
  [2, 'Balde 5L', 'Para festas e encontros.', 89.9, 'balde-5l', '', 0, BALDE_FLAVORS],
  [2, 'Balde Premium 2L', 'Sabores especiais com pedaços e calda.', 54.9, 'balde-premium', '', 0, ['Ninho com Nutella', 'Ferrero', 'Pistache', 'Doce de leite com nozes']],
  [3, 'Milk-shake 400ml', 'Sorvete batido com leite e calda.', 17.9, 'shake-ovomaltine', '', 0, SHAKE_FLAVORS],
  [3, 'Milk-shake 500ml', 'O mesmo shake, mais generoso, com chantilly.', 21.9, 'shake-morango', 'Mais pedido', 1, SHAKE_FLAVORS],
  [4, 'Casquinha 2 bolas', 'Duas bolas na casquinha crocante.', 9.9, 'casquinha', '', 0, SORVETE_FLAVORS],
  [4, 'Taça Sundae', 'Três bolas, calda, chantilly e cereja.', 16.9, 'sundae', '', 0, SORVETE_FLAVORS],
  [4, 'Banana Split', 'Banana, três sabores de sorvete, caldas e farofa crocante.', 22.9, 'banana-split', '', 0],
  [5, 'Brownie com Sorvete', 'Brownie quentinho com bola de creme e calda de chocolate.', 18.9, 'brownie', '', 0],
  [5, 'Petit Gâteau', 'Bolinho de chocolate com recheio cremoso e sorvete.', 21.9, 'petit-gateau', '', 0],
  [5, 'Mousse de Açaí', 'Mousse aerada de açaí com raspas de chocolate branco.', 12.9, 'mousse-acai', '', 0],
  [6, 'Combo Casal', '2 açaís de 400ml com 3 acompanhamentos cada + 2 picolés.', 44.9, 'combo-casal', 'Combo', 1],
  [6, 'Combo Família', 'Açaí 1L + Balde de sorvete 1L + 4 acompanhamentos.', 59.9, 'combo-familia', 'Combo', 0],
];

// [nome, ml, descrição, preço, grátis inclusos]
const SIZES = [
  ['300ml', 300, 'Para matar a vontade', 13.9, 2],
  ['400ml', 400, 'O tamanho certo', 16.9, 3],
  ['500ml', 500, 'O mais pedido', 19.9, 3],
  ['700ml', 700, 'Para quem leva a sério', 26.9, 4],
  ['1 litro', 1000, 'Para dividir', 35.9, 5],
  ['Tigela 500g', 500, 'Servido na tigela', 23.9, 4],
];

// grupos: [nome, instrução, mín, máx, entra na cota grátis, itens: [nome, preço, sempre grátis, cor]]
const GROUPS = [
  ['Base', 'Escolha a base do seu açaí.', 1, 1, 0, [
    ['Açaí tradicional', 0, 1, '#5B1A7A'], ['Açaí com banana', 0, 1, '#7A3C8C'], ['Açaí zero açúcar', 2, 0, '#4A1466'],
    ['Cupuaçu', 0, 1, '#E9D8B4'], ['Meio açaí, meio cupuaçu', 1, 0, '#9C6FA8'],
  ]],
  ['Complementos', 'Crocantes e farofinhas.', 0, 6, 1, [
    ['Granola', 2, 0, '#C68B3E'], ['Leite em pó', 2, 0, '#FFF4DE'], ['Paçoca', 2.5, 0, '#D9A464'], ['Coco ralado', 2, 0, '#FFFFFF'],
    ['Confete', 2.5, 0, '#F25F8C'], ['Amendoim', 2, 0, '#B9773A'], ['Sucrilhos', 2, 0, '#F2B33D'], ['Ovomaltine', 3, 0, '#6B3E1E'],
  ]],
  ['Frutas', 'Fresquinhas, cortadas na hora.', 0, 4, 1, [
    ['Morango', 3, 0, '#E5405E'], ['Banana', 2, 0, '#F7D85A'], ['Kiwi', 3.5, 0, '#7CB342'], ['Uva', 3, 0, '#6A2C91'],
    ['Manga', 3, 0, '#FFB238'], ['Abacaxi', 2.5, 0, '#F9CF3A'],
  ]],
  ['Recheios', 'Vão no meio, entre as camadas.', 0, 3, 1, [
    ['Leite condensado', 2.5, 0, '#F6E7C1'], ['Doce de leite', 3, 0, '#C98A3D'], ['Creme de avelã', 4, 0, '#7B4A2A'],
    ['Brigadeiro', 3.5, 0, '#4E2A1A'], ['Creme de Ninho', 4, 0, '#FFF7E6'], ['Mousse de maracujá', 3.5, 0, '#F4C430'],
  ]],
  ['Coberturas', 'A calda por cima de tudo.', 0, 2, 1, [
    ['Calda de chocolate', 2, 0, '#5A2E1B'], ['Calda de morango', 2, 0, '#D7263D'], ['Caramelo', 2, 0, '#C87F2A'],
    ['Leite condensado', 2, 0, '#F6E7C1'], ['Chocolate branco', 2.5, 0, '#FFF1D6'], ['Creme de avelã', 3, 0, '#7B4A2A'],
  ]],
  ['Adicionais premium', 'Fora da cota grátis — vale cada centavo.', 0, 5, 0, [
    ['Nutella', 6, 0, '#5B3216'], ["M&M's", 4.5, 0, '#2F6FDE'], ['Bis', 4, 0, '#3B2314'], ['KitKat', 5, 0, '#C8102E'],
    ['Kinder Bueno', 6.5, 0, '#E36414'], ['Sonho de Valsa', 3.5, 0, '#B5174B'], ['Chantilly', 3, 0, '#FFFFFF'],
  ]],
];

const PROMOS = [
  { title: 'Terça Roxa', subtitle: 'Toda terça, 15% de desconto em pedidos a partir de R$ 40.', badge: 'Só às terças', percent_off: 15, min_subtotal_cents: R(40), weekdays: [2], theme: 'roxo' },
  { title: 'R$ 5 de desconto', subtitle: 'Em qualquer pedido acima de R$ 60. Aplicado automaticamente no carrinho.', badge: 'HOJE TEM PROMO!', amount_off_cents: R(5), min_subtotal_cents: R(60), theme: 'dourado' },
  { title: 'Frete grátis', subtitle: 'Pedidos acima de R$ 80 não pagam entrega.', badge: 'Delivery', theme: 'morango' },
];

const ZONES = [['Centro', 4], ['Jardim das Flores', 5], ['Vila Nova', 5], ['Bela Vista', 6], ['Santa Cruz', 7], ['Parque Industrial', 8]];

const GALLERY = [
  ['acai-especial', 'Especial da Casa', 'alto'], ['acai-tigela', 'Açaí na tigela', 'largo'], ['picole-ninho', 'Picolé Ninho Trufado', 'normal'],
  ['shake-morango', 'Milk-shake de morango', 'normal'], ['acai-morango', 'Açaí Tropical', 'normal'], ['balde-premium', 'Baldes premium', 'alto'],
  ['sundae', 'Taça Sundae', 'normal'], ['combo-casal', 'Combo Casal', 'largo'],
];

/**
 * reset: recria só o CARDÁPIO (mantém pedidos, clientes, usuários e configurações).
 * all:   apaga também pedidos, clientes e configurações (volta ao estado de fábrica).
 */
export function seed({ reset = false, all = false } = {}) {
  const hadSettings = db.prepare('SELECT COUNT(*) n FROM settings').get().n > 0;
  tx(() => {
    if (all) for (const t of ['order_status_history', 'order_items', 'orders', 'customers', 'settings']) db.exec(`DELETE FROM ${t}`);
    if (reset || all) for (const t of ['products', 'categories', 'addons', 'addon_groups', 'builder_sizes', 'promotions', 'delivery_zones', 'gallery']) db.exec(`DELETE FROM ${t}`);
    const cat = db.prepare('INSERT INTO categories (slug, name, description, sort) VALUES (?, ?, ?, ?)');
    const catIds = CATEGORIES.map((c, i) => Number(cat.run(slugify(c.name), c.name, c.description, i).lastInsertRowid));
    const prod = db.prepare('INSERT INTO products (category_id, slug, name, description, price_cents, image, badge, featured, flavors, sort) VALUES (?,?,?,?,?,?,?,?,?,?)');
    PRODUCTS.forEach(([c, name, desc, price, image, badge, featured, flavors = []], i) =>
      prod.run(catIds[c], slugify(name), name, desc, R(price), img(image), badge, featured, JSON.stringify(flavors), i));
    const size = db.prepare('INSERT INTO builder_sizes (name, ml, description, price_cents, free_items, image, sort) VALUES (?,?,?,?,?,?,?)');
    SIZES.forEach(([n, ml, d, p, free], i) => size.run(n, ml, d, R(p), free, img(n.startsWith('Tigela') ? 'acai-tigela' : 'acai-copo'), i));
    const grp = db.prepare('INSERT INTO addon_groups (slug, name, description, min_select, max_select, counts_as_free, sort) VALUES (?,?,?,?,?,?,?)');
    const add = db.prepare('INSERT INTO addons (group_id, name, price_cents, is_free, color, sort) VALUES (?,?,?,?,?,?)');
    GROUPS.forEach(([name, desc, min, max, counts, items], gi) => {
      const gid = Number(grp.run(slugify(name), name, desc, min, max, counts, gi).lastInsertRowid);
      items.forEach(([n, p, free, color], i) => add.run(gid, n, R(p), free, color, i));
    });
    const promo = db.prepare('INSERT INTO promotions (title, subtitle, badge, percent_off, amount_off_cents, min_subtotal_cents, weekdays, theme, sort) VALUES (?,?,?,?,?,?,?,?,?)');
    PROMOS.forEach((p, i) => promo.run(p.title, p.subtitle, p.badge, p.percent_off || 0, p.amount_off_cents || 0, p.min_subtotal_cents || 0, JSON.stringify(p.weekdays || []), p.theme, i));
    const zone = db.prepare('INSERT INTO delivery_zones (name, fee_cents, sort) VALUES (?,?,?)');
    ZONES.forEach(([n, f], i) => zone.run(n, R(f), i));
    const gal = db.prepare('INSERT INTO gallery (image, caption, layout, sort) VALUES (?,?,?,?)');
    GALLERY.forEach(([im, cap, lay], i) => gal.run(img(im), cap, lay, i));
  });
  if (all || !hadSettings) saveSettings(DEFAULT_SETTINGS);
  console.log('[seed] dados de exemplo criados.');
}

if (process.argv[1]?.endsWith('seed.js')) seed({ reset: process.argv.includes('--reset'), all: process.argv.includes('--all') });
