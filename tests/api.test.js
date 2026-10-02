import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Sobe o servidor real num banco temporário e testa a API de ponta a ponta. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdb-test-'));
const PORT = 4100 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
let proc;
const jar = { admin: '', staff: '' };

before(async () => {
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(dir, 'test.db'), UPLOAD_DIR: path.join(dir, 'up'), ADMIN_EMAIL: 'admin@teste.com', ADMIN_PASSWORD: 'senha-admin-123', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('servidor não subiu')), 10000);
    proc.stdout.on('data', (d) => { if (String(d).includes('rodando')) { clearTimeout(t); resolve(); } });
    proc.on('exit', (c) => reject(new Error(`servidor saiu (${c})`)));
  });
  jar.admin = await login('admin@teste.com', 'senha-admin-123');
  // Garante loja aberta independentemente do horário em que o teste roda
  const r = await call('PUT', '/api/admin/settings', { manualStatus: 'open' }, jar.admin);
  assert.equal(r.status, 200);
});

after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

async function call(method, url, body, cookie, { csrf = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers['X-TDB-Request'] = '1';
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}
async function login(email, password) {
  const r = await call('POST', '/api/admin/login', { email, password });
  assert.equal(r.status, 200, r.data.error);
  return r.headers.get('set-cookie').split(';')[0];
}

let catalog;
const pickCustom = () => {
  const size = catalog.builder.sizes.find((s) => s.ml === 500) || catalog.builder.sizes[0];
  const addonIds = [];
  for (const g of catalog.builder.groups) {
    const n = Math.max(g.min_select, Math.min(2, g.max_select));
    addonIds.push(...g.addons.slice(0, n).map((a) => a.id));
  }
  return { kind: 'custom', sizeId: size.id, addonIds, qty: 1 };
};
const simpleProduct = () => catalog.products.find((p) => !p.flavors?.length);
const baseOrder = () => ({
  items: [pickCustom(), { kind: 'product', productId: simpleProduct().id, qty: 2 }],
  customer: { name: 'Cliente Teste', phone: '(27) 99999-1234' },
  fulfillment: 'delivery', zoneId: catalog.zones[0].id,
  address: { street: 'Rua Teste', number: '10', complement: '', reference: '' },
  payment: { method: 'pix' }, notes: 'sem pressa',
});

test('catálogo público', async () => {
  const r = await call('GET', '/api/catalog');
  assert.equal(r.status, 200);
  catalog = r.data;
  assert.ok(catalog.products.length >= 10);
  assert.ok(catalog.builder.sizes.length >= 4);
  assert.ok(catalog.builder.groups.length >= 5);
  assert.equal(catalog.store.open, true);
  assert.ok(!('password_hash' in catalog));
});

test('preços enviados pelo cliente são ignorados (recalculados no servidor)', async () => {
  const p = simpleProduct();
  const r = await call('POST', '/api/orders/quote', { items: [{ kind: 'product', productId: p.id, qty: 3, price_cents: 1, unit_price_cents: 1, total_cents: 1 }], fulfillment: 'pickup', total_cents: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.data.subtotal_cents, p.price_cents * 3);
});

test('validação: dados obrigatórios e itens inválidos', async () => {
  const o = baseOrder();
  o.customer = { name: '', phone: '123' };
  o.address = {};
  o.payment = { method: 'bitcoin' };
  const r = await call('POST', '/api/orders', o);
  assert.equal(r.status, 422);
  for (const k of ['customer.name', 'customer.phone', 'address.street', 'address.number', 'payment.method']) assert.ok(r.data.details[k], `faltou erro em ${k}`);

  const bad = await call('POST', '/api/orders/quote', { items: [{ kind: 'product', productId: 999999, qty: 1 }] });
  assert.equal(bad.status, 422);
  const empty = await call('POST', '/api/orders/quote', { items: [] });
  assert.equal(empty.status, 422);
  const g = catalog.builder.groups.find((x) => x.max_select < x.addons.length);
  const tooMany = { kind: 'custom', sizeId: catalog.builder.sizes[0].id, addonIds: [...pickCustom().addonIds.filter((id) => !g.addons.some((a) => a.id === id)), ...g.addons.map((a) => a.id)], qty: 1 };
  const r2 = await call('POST', '/api/orders/quote', { items: [tooMany], fulfillment: 'pickup' });
  assert.equal(r2.status, 422);
  assert.match(r2.data.error, /máximo/);
});

test('troco precisa ser maior que o total', async () => {
  const o = baseOrder();
  o.payment = { method: 'cash', needsChange: true, changeFor: 100 };
  const r = await call('POST', '/api/orders', o);
  assert.equal(r.status, 422);
  assert.ok(r.data.details['payment.changeFor']);
});

let order;
test('cria pedido completo com mensagem para o WhatsApp', async () => {
  const o = baseOrder();
  const q = await call('POST', '/api/orders/quote', o);
  const r = await call('POST', '/api/orders', o);
  assert.equal(r.status, 201, r.data.error);
  order = r.data;
  assert.equal(order.status, 'NOVO');
  assert.ok(order.number > 1000);
  assert.equal(order.total_cents, q.data.total_cents);
  assert.match(order.whatsappUrl, /^https:\/\/wa\.me\/\d+\?text=/);
  const msg = decodeURIComponent(order.whatsappUrl.split('text=')[1]);
  for (const s of [`NOVO PEDIDO #${order.number}`, 'Cliente Teste', '(27) 99999-1234', 'Rua Teste, nº 10', 'PIX', 'Tempo estimado']) assert.ok(msg.includes(s), `mensagem sem "${s}"`);
});

test('acompanhamento público por token', async () => {
  const r = await call('GET', `/api/orders/${order.token}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.number, order.number);
  assert.ok(!('customer_phone' in r.data), 'não expõe o telefone');
  assert.equal((await call('GET', '/api/orders/token-que-nao-existe')).status, 404);
});

test('painel exige login e cabeçalho anti-CSRF', async () => {
  assert.equal((await call('GET', '/api/admin/orders')).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { email: 'admin@teste.com', password: 'errada' })).status, 401);
  const r = await call('PATCH', `/api/admin/orders/1/status`, { status: 'PRONTO' }, jar.admin, { csrf: false });
  assert.equal(r.status, 403);
});

test('fluxo de status NOVO → EM PREPARAÇÃO → PRONTO → SAIU PARA ENTREGA → ENTREGUE', async () => {
  const list = await call('GET', '/api/admin/orders?status=ATIVOS', undefined, jar.admin);
  assert.equal(list.status, 200);
  const o = list.data.orders.find((x) => x.number === order.number);
  assert.ok(o, 'pedido aparece no painel');
  assert.ok(o.productionMessage.includes(`NOVO PEDIDO #${order.number}`));
  for (const s of ['EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE']) {
    const r = await call('PATCH', `/api/admin/orders/${o.id}/status`, { status: s }, jar.admin);
    assert.equal(r.status, 200, r.data.error);
    assert.equal(r.data.status, s);
  }
  const pub = await call('GET', `/api/orders/${order.token}`);
  assert.equal(pub.data.status, 'ENTREGUE');
  assert.equal(pub.data.history.length, 5);
  const bad = await call('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'INVENTADO' }, jar.admin);
  assert.equal(bad.status, 422);
});

test('retirada não tem etapa "saiu para entrega"', async () => {
  const o = { ...baseOrder(), fulfillment: 'pickup', zoneId: undefined, address: undefined };
  const r = await call('POST', '/api/orders', o);
  assert.equal(r.status, 201, r.data.error);
  assert.equal(r.data.delivery_fee_cents, 0);
  assert.deepEqual(r.data.flow, ['NOVO', 'EM_PREPARACAO', 'PRONTO', 'ENTREGUE']);
  const list = await call('GET', `/api/admin/orders?q=${r.data.number}`, undefined, jar.admin);
  const id = list.data.orders[0].id;
  assert.equal((await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'SAIU_PARA_ENTREGA' }, jar.admin)).status, 422);
});

test('permissões: funcionário só mexe em pedidos', async () => {
  const c = await call('POST', '/api/admin/users', { name: 'Ana', email: 'ana@teste.com', password: 'senha-ana-123', role: 'staff' }, jar.admin);
  assert.equal(c.status, 201, c.data.error);
  jar.staff = await login('ana@teste.com', 'senha-ana-123');
  assert.equal((await call('GET', '/api/admin/settings', undefined, jar.staff)).status, 403);
  assert.equal((await call('GET', '/api/admin/r/products', undefined, jar.staff)).status, 403);
  assert.equal((await call('GET', '/api/admin/orders', undefined, jar.staff)).status, 200);
  // Pedido finalizado só pode ser reaberto pelo admin
  const list = await call('GET', `/api/admin/orders?q=${order.number}`, undefined, jar.staff);
  const id = list.data.orders[0].id;
  assert.equal((await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'PRONTO' }, jar.staff)).status, 403);
});

test('cadastros: alterar preço reflete no cardápio e nos pedidos', async () => {
  const p = simpleProduct();
  const u = await call('PUT', `/api/admin/r/products/${p.id}`, { price_cents: 1234 }, jar.admin);
  assert.equal(u.status, 200, u.data.error);
  const q = await call('POST', '/api/orders/quote', { items: [{ kind: 'product', productId: p.id, qty: 1 }], fulfillment: 'pickup' });
  assert.equal(q.data.subtotal_cents, 1234);
  const off = await call('PUT', `/api/admin/r/products/${p.id}`, { active: false }, jar.admin);
  assert.equal(off.status, 200);
  const q2 = await call('POST', '/api/orders/quote', { items: [{ kind: 'product', productId: p.id, qty: 1 }], fulfillment: 'pickup' });
  assert.equal(q2.status, 422, 'produto desativado não pode ser pedido');
  const bad = await call('POST', '/api/admin/r/products', { name: '<b>x</b>', price_cents: -5, category_id: 9999 }, jar.admin);
  assert.equal(bad.status, 422);
});

test('upload só aceita imagem de verdade', async () => {
  const res = await fetch(`${BASE}/api/admin/uploads`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-TDB-Request': '1', Cookie: jar.admin }, body: Buffer.from('não sou png') });
  assert.equal(res.status, 415);
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const ok = await fetch(`${BASE}/api/admin/uploads`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-TDB-Request': '1', Cookie: jar.admin }, body: png });
  assert.equal(ok.status, 201);
  assert.match((await ok.json()).url, /^\/uploads\/[\w-]+\.png$/);
});

test('loja fechada manualmente recusa pedidos', async () => {
  await call('PUT', '/api/admin/settings', { manualStatus: 'closed' }, jar.admin);
  const st = await call('GET', '/api/store');
  assert.equal(st.data.open, false);
  const r = await call('POST', '/api/orders', { ...baseOrder(), items: [pickCustom()] });
  assert.equal(r.status, 409, r.data.error);
  await call('PUT', '/api/admin/settings', { manualStatus: 'open' }, jar.admin);
});

test('páginas e SEO', async () => {
  for (const p of ['/', '/cardapio', '/monte-seu-acai', `/pedido/${order.token}`]) {
    const res = await fetch(BASE + p);
    assert.equal(res.status, 200, p);
    const html = await res.text();
    assert.match(html, /<title>TUDO DE BOM — Açaiteria/);
    assert.match(html, /application\/ld\+json/);
  }
  const nf = await fetch(`${BASE}/nao-existe`);
  assert.equal(nf.status, 404);
  const res = await fetch(`${BASE}/`);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
