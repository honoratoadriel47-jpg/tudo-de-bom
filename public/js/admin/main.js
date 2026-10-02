import { h, replace } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { closeAll } from '../ui/overlay.js';
import { centerIn } from '../ui/motion.js';
import { api, setUnauthorizedHandler } from './api.js';
import { renderOrders, stopOrders } from './orders.js';
import { renderResource } from './crud.js';
import { renderSettings } from './settings.js';
import { renderUsers, renderPassword } from './users.js';

/** Painel: login, menu lateral e rotas por hash (#/pedidos, #/r/products, #/config…). */
const app = document.getElementById('app');
export const session = { user: null, schema: null };

const NAV = [
  { href: '#/pedidos', label: '🧾 Pedidos', roles: ['admin', 'staff'], count: true },
  { sep: 'Cardápio', roles: ['admin'] },
  { href: '#/r/products', label: '🍨 Produtos', roles: ['admin'] },
  { href: '#/r/categories', label: '🗂️ Categorias', roles: ['admin'] },
  { href: '#/r/promotions', label: '🏷️ Promoções', roles: ['admin'] },
  { sep: 'Monte seu açaí', roles: ['admin'] },
  { href: '#/r/sizes', label: '🥤 Tamanhos', roles: ['admin'] },
  { href: '#/r/addon_groups', label: '🧩 Etapas', roles: ['admin'] },
  { href: '#/r/addons', label: '🍓 Ingredientes', roles: ['admin'] },
  { sep: 'Loja', roles: ['admin'] },
  { href: '#/r/zones', label: '🛵 Bairros e taxas', roles: ['admin'] },
  { href: '#/r/gallery', label: '📸 Galeria', roles: ['admin'] },
  { href: '#/config', label: '⚙️ Configurações', roles: ['admin'] },
  { href: '#/usuarios', label: '👥 Usuários', roles: ['admin'] },
  { href: '#/senha', label: '🔑 Minha senha', roles: ['admin', 'staff'] },
];

function renderLogin(message) {
  stopOrders();
  closeAll();
  const err = h('p', { class: 'form-error', role: 'alert', hidden: !message }, message || '');
  const email = h('input', { class: 'input', type: 'email', id: 'l-email', autocomplete: 'username', required: true, autofocus: true });
  const pass = h('input', { class: 'input', type: 'password', id: 'l-pass', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'btn btn--grape btn--block', type: 'submit' }, 'Entrar');
  const form = h('form', { class: 'login__card', novalidate: true },
    h('img', { src: '/assets/brand/logo.webp', alt: 'TUDO DE BOM Açaiteria', width: 150, height: 129 }),
    h('h1', {}, 'Painel da loja'),
    h('label', { class: 'field', for: 'l-email' }, h('span', {}, 'E-mail'), email),
    h('label', { class: 'field', for: 'l-pass' }, h('span', {}, 'Senha'), pass),
    err, btn,
    h('p', { class: 'muted', style: { textAlign: 'center', fontSize: '.85rem' } }, h('a', { href: '/' }, '← Voltar para a loja')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    btn.classList.add('is-busy');
    try {
      const { user } = await api.login(email.value, pass.value);
      session.user = user;
      start();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      pass.select();
    } finally { btn.classList.remove('is-busy'); }
  });
  replace(app, h('main', { class: 'login' }, form));
  document.title = 'Entrar — Painel TUDO DE BOM';
  email.focus();
}

let main;
function renderShell() {
  const u = session.user;
  const nav = h('nav', { 'aria-label': 'Menu do painel' },
    NAV.filter((n) => n.roles.includes(u.role)).map((n) => n.sep
      ? h('span', { class: 'sep' }, n.sep)
      : h('a', { href: n.href }, n.label, n.count && h('span', { class: 'count', 'data-new-count': '', hidden: true }))),
    h('a', { href: '/', target: '_blank', rel: 'noopener' }, '🛍️ Ver loja'),
    h('button', { type: 'button', onclick: logout }, '🚪 Sair'));
  main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  replace(app, h('div', { class: 'shell' },
    h('aside', { class: 'side' },
      h('div', { class: 'side__brand' }, h('img', { src: '/assets/brand/logo-sm.webp', alt: '', width: 52, height: 45 }),
        h('div', {}, h('b', {}, 'TUDO DE BOM'), h('small', {}, 'Painel da loja'))),
      nav,
      h('div', { class: 'side__foot' }, h('b', {}, u.name), h('span', {}, u.role === 'admin' ? 'Perfil: administrador' : 'Perfil: funcionário'), h('span', {}, u.email))),
    main));
}

async function logout() {
  try { await api.logout(); } catch { /* ok */ }
  session.user = null;
  location.hash = '';
  renderLogin();
}

async function route() {
  if (!session.user) return;
  closeAll();
  const hash = location.hash || '#/pedidos';
  document.querySelectorAll('.side nav a').forEach((a) => a.setAttribute('aria-current', hash.startsWith(a.getAttribute('href')) ? 'page' : 'false'));
  const cur = document.querySelector('.side nav a[aria-current="page"]');
  if (cur && innerWidth < 960) centerIn(cur.parentElement, cur);
  const admin = session.user.role === 'admin';
  if (!hash.startsWith('#/pedidos')) stopOrders();
  replace(main);
  try {
    if (hash.startsWith('#/r/') && admin) {
      session.schema ||= await api.schema();
      await renderResource(main, hash.slice(4));
    } else if (hash === '#/config' && admin) await renderSettings(main);
    else if (hash === '#/usuarios' && admin) await renderUsers(main);
    else if (hash === '#/senha') renderPassword(main);
    else { if (hash !== '#/pedidos') history.replaceState(null, '', '#/pedidos'); await renderOrders(main); }
  } catch (e) {
    if (e.status !== 401) toast(e.message, { type: 'error' });
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function start() {
  renderShell();
  route();
}

setUnauthorizedHandler(() => { if (session.user) { session.user = null; renderLogin('Sua sessão expirou. Entre novamente.'); } });
window.addEventListener('hashchange', route);

(async () => {
  try {
    const { user } = await api.me();
    session.user = user;
    start();
  } catch {
    renderLogin();
  }
})();
