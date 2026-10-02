import { $, $$ } from '../ui/dom.js';
import { brl, plural } from '../ui/format.js';
import { bump, observeReveal, reducedMotion } from '../ui/motion.js';
import { closeAll } from '../ui/overlay.js';
import { toast } from '../ui/toast.js';
import { api } from './api.js';
import { state, on, indexCatalog } from './state.js';
import { loadCart, count, subtotal } from './cart.js';
import { renderFeatured, renderPromos, renderMenu, renderGallery, renderInfo, renderStatus, renderHeroBits } from './views/sections.js';
import { renderBuilder } from './views/builder.js';
import { openCart } from './views/cartDrawer.js';
import { showTracking, closeOrderScreen } from './views/success.js';

/* ── Abertura com a logo (uma vez por sessão, nunca mais que ~2,4s) ── */
function runIntro(ready) {
  const intro = $('#intro');
  if (!intro) return;
  let seen = false;
  try { seen = sessionStorage.getItem('tdb-intro') === '1'; sessionStorage.setItem('tdb-intro', '1'); } catch { /* ok */ }
  const isOrderPage = location.pathname.startsWith('/pedido/');
  if (seen || reducedMotion() || isOrderPage) { intro.remove(); document.body.classList.add('is-ready'); return; }
  // Frutinhas de açaí "explodindo" ao redor da logo
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('span');
    b.className = 'intro__berry';
    const ang = (i / 14) * Math.PI * 2, dist = 140 + Math.random() * 120;
    b.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    b.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    b.style.left = 'calc(50% - 7px)'; b.style.top = 'calc(50% - 7px)';
    b.style.animationDelay = `${0.35 + Math.random() * 0.3}s`;
    const sz = 8 + Math.random() * 12; b.style.width = b.style.height = `${sz}px`;
    intro.append(b);
  }
  const minTime = new Promise((r) => setTimeout(r, 1900));
  const maxWait = new Promise((r) => setTimeout(r, 3200));
  Promise.race([Promise.all([minTime, ready]), maxWait]).then(() => {
    intro.classList.add('is-leaving');
    document.body.classList.add('is-ready');
    setTimeout(() => intro.remove(), 800);
  });
}

/* ── Navegação com URLs amigáveis ── */
const ROUTES = { cardapio: 'cardapio', 'monte-seu-acai': 'monte-seu-acai', promocoes: 'promocoes', galeria: 'galeria' };
function goTo(slug, { push = true, smooth = true } = {}) {
  const target = slug ? document.getElementById(ROUTES[slug]) : null;
  if (push) history.pushState({ slug }, '', slug ? `/${slug}` : '/');
  if (target && !target.hidden) target.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'start' });
  else if (!slug) window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  $$('.header__nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === slug));
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  closeAll();
  closeOrderScreen({ toHome: false });
  goTo(a.dataset.nav);
});

function routeFromPath({ initial = false } = {}) {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const m = path.match(/^\/pedido\/([\w-]{8,40})$/);
  if (m) return showTracking(m[1]);
  closeOrderScreen({ toHome: false });
  const slug = path.slice(1);
  if (ROUTES[slug]) setTimeout(() => goTo(slug, { push: false, smooth: !initial }), initial ? 60 : 0);
}
window.addEventListener('popstate', () => { closeAll(); routeFromPath(); });

/* ── Carrinho: contador do cabeçalho e barra flutuante ── */
function updateCartUi() {
  const n = count();
  const badge = $('[data-cart-count]');
  const changed = badge.textContent !== String(n);
  badge.textContent = n;
  badge.hidden = n === 0;
  $('#cart-open').setAttribute('aria-label', n ? `Abrir carrinho, ${plural(n, 'item', 'itens')}` : 'Abrir carrinho');
  const bar = $('#cart-bar');
  $('[data-bar-text]').textContent = `${plural(n, 'item', 'itens')} — ${brl(subtotal())}`;
  bar.classList.toggle('is-visible', n > 0);
  bar.setAttribute('aria-hidden', n ? 'false' : 'true');
  if (changed && n) { bump($('#cart-open')); bump(bar); }
}

/* ── Cabeçalho que ganha vidro ao rolar + parallax sutil no hero ── */
function setupScroll() {
  const header = $('#header');
  const art = $('#hero-art');
  const layers = art ? $$('[data-depth]', art) : [];
  let px = 0, py = 0, sy = 0, raf = 0;
  const apply = () => {
    raf = 0;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    if (reducedMotion()) return;
    for (const el of layers) {
      const d = Number(el.dataset.depth);
      el.style.transform = `translate3d(${px * d * 18}px, ${py * d * 18 - sy * d * 0.25}px, 0)`;
    }
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
  window.addEventListener('scroll', () => { sy = Math.min(window.scrollY, 900); queue(); }, { passive: true });
  if (matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      if (window.scrollY > 900) return;
      px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; queue();
    }, { passive: true });
  }
  apply();
}

/* ── Status aberto/fechado atualizado a cada minuto ── */
async function refreshStore() {
  try { state.store = await api.store(); renderStatus(); } catch { /* mantém o último */ }
}

async function boot() {
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  runIntro(ready);
  setupScroll();
  on('cart', updateCartUi);
  $('#cart-open').addEventListener('click', openCart);
  $('#cart-bar-open').addEventListener('click', openCart);

  try {
    const data = await api.catalog();
    state.catalog = indexCatalog(data);
    state.settings = data.settings;
    state.store = data.store;
  } catch (e) {
    resolveReady();
    toast('Não conseguimos carregar o cardápio. Recarregue a página.', { type: 'error', duration: 8000 });
    return;
  }
  renderStatus();
  renderHeroBits();
  renderFeatured();
  renderPromos();
  renderBuilder();
  renderMenu();
  renderGallery();
  renderInfo();
  const removed = loadCart();
  if (removed) toast('Alguns itens do seu carrinho não estão mais disponíveis e foram removidos.', { type: 'error' });
  observeReveal();
  resolveReady();
  routeFromPath({ initial: true });
  setInterval(refreshStore, 60_000);
}

boot();
