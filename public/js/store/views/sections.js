import { h, replace, icons } from '../../ui/dom.js';
import { brl } from '../../ui/format.js';
import { observeReveal, centerIn } from '../../ui/motion.js';
import { state } from '../state.js';
import { productCard } from './products.js';

export function renderFeatured() {
  const el = document.getElementById('featured');
  const list = state.catalog.products.filter((p) => p.featured);
  replace(el, (list.length ? list : state.catalog.products).slice(0, 5).map(productCard));
  el.removeAttribute('aria-busy');
}

export function renderPromos() {
  const el = document.getElementById('promos');
  const promos = state.catalog.promotions;
  document.getElementById('promocoes').hidden = !promos.length;
  replace(el, promos.map((p, i) => {
    const big = p.percent_off ? `${p.percent_off}%` : p.amount_off_cents ? `R$${Math.round(p.amount_off_cents / 100)}` : '★';
    return h('article', { class: `promo promo--${p.theme}`, 'data-reveal': '', style: { transitionDelay: `${i * 0.08}s` } },
      h('span', { class: 'promo__big', 'aria-hidden': 'true' }, big),
      p.badge && h('span', { class: 'badge' }, p.badge),
      h('h3', {}, p.title),
      p.subtitle && h('p', {}, p.subtitle));
  }));
}

export function renderMenu() {
  const { categories, products } = state.catalog;
  const el = document.getElementById('menu');
  const cats = categories.filter((c) => products.some((p) => p.category_id === c.id));
  const tabs = h('div', { class: 'menu-tabs', role: 'tablist', 'aria-label': 'Categorias do cardápio' },
    cats.map((c, i) => h('button', {
      class: 'menu-tab', role: 'tab', type: 'button', 'aria-selected': i === 0 ? 'true' : 'false', 'data-cat': c.slug,
      onclick: () => document.getElementById(`cat-${c.slug}`).scrollIntoView({ behavior: 'smooth', block: 'start' }),
    }, c.name)));
  const sections = cats.map((c, i) => h('section', { class: 'menu-cat', id: `cat-${c.slug}`, 'aria-labelledby': `cat-t-${c.slug}`, style: { scrollMarginTop: 'calc(var(--header-h) + 80px)' } },
    h('div', { class: 'menu-cat__head' }, h('h3', { id: `cat-t-${c.slug}` }, c.name), c.description && h('p', {}, c.description)),
    i === 0 && h('div', { class: 'builder-cta' },
      h('p', {}, h('b', {}, 'Quer do seu jeito?'), 'Escolha tamanho, base, frutas, recheios e coberturas.'),
      h('a', { class: 'btn btn--sm', href: '/monte-seu-acai', 'data-nav': 'monte-seu-acai' }, 'Monte seu açaí')),
    h('div', { class: 'grid' }, products.filter((p) => p.category_id === c.id).map(productCard))));
  replace(el, tabs, sections);

  // Destaca a categoria visível
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const slug = e.target.id.replace('cat-', '');
      tabs.querySelectorAll('.menu-tab').forEach((t) => {
        const on = t.dataset.cat === slug;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) centerIn(tabs, t, true);
      });
    }), { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach((s) => io.observe(s));
  }
}

export function renderGallery() {
  const el = document.getElementById('gallery');
  const items = state.catalog.gallery;
  document.getElementById('galeria').hidden = !items.length;
  replace(el, items.map((g, i) => h('button', {
    class: `gallery__item gallery__item--${g.layout}`, type: 'button', style: { transitionDelay: `${(i % 4) * 0.07}s` },
    'aria-label': `Ampliar foto: ${g.caption || 'produto'}`, onclick: () => openLightbox(i),
  }, h('figure', { style: { margin: 0, height: '100%' } },
    h('img', { src: g.image, alt: g.caption || 'Produto TUDO DE BOM', loading: 'lazy', decoding: 'async' }),
    g.caption && h('figcaption', {}, g.caption)))));
  observeReveal(el);
}

function openLightbox(start) {
  const items = state.catalog.gallery;
  let i = start;
  const img = h('img', { alt: '' });
  const cap = h('figcaption', { style: { color: 'var(--lilac-2)', fontWeight: 700 } });
  const show = () => { img.src = items[i].image; img.alt = items[i].caption || ''; cap.textContent = items[i].caption || ''; };
  const opener = document.activeElement;
  const close = () => { box.remove(); document.removeEventListener('keydown', key); document.body.classList.remove('is-locked'); opener?.focus(); };
  const nav = (d) => { i = (i + d + items.length) % items.length; show(); };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') nav(1); if (e.key === 'ArrowLeft') nav(-1); };
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Galeria de fotos', onclick: (e) => { if (e.target === box) close(); } },
    h('figure', {}, img, cap),
    h('button', { class: 'icon-btn lb-close', 'aria-label': 'Fechar', html: icons.close, onclick: close }),
    items.length > 1 && h('button', { class: 'icon-btn lb-prev', 'aria-label': 'Foto anterior', html: icons.left, onclick: () => nav(-1) }),
    items.length > 1 && h('button', { class: 'icon-btn lb-next', 'aria-label': 'Próxima foto', html: icons.right, onclick: () => nav(1) }));
  show();
  document.body.append(box);
  document.body.classList.add('is-locked');
  document.addEventListener('keydown', key);
  box.querySelector('.lb-close').focus();
}

export function renderInfo() {
  const s = state.settings, st = state.store;
  const a = s.address;
  const today = new Date().getDay();
  const wa = `https://wa.me/${s.whatsapp}`;
  const phone = s.whatsapp.replace(/^55/, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  replace(document.getElementById('info'),
    h('div', {},
      h('h3', {}, 'Onde estamos'),
      h('p', {}, `${a.street}, ${a.number}`), h('p', {}, `${a.district} — ${a.city}`), a.reference && h('p', { style: { color: 'var(--lilac)' } }, a.reference),
      s.mapsUrl && h('p', { style: { marginTop: '12px' } }, h('a', { href: s.mapsUrl, target: '_blank', rel: 'noopener' }, 'Abrir no mapa'))),
    h('div', {},
      h('h3', {}, 'Horário'),
      h('dl', { class: 'hours' }, st.hours.map((d, i) => h('div', { class: i === today ? 'is-today' : '' }, h('dt', {}, d.day), h('dd', {}, d.text))))),
    h('div', {},
      h('h3', {}, 'Fale com a gente'),
      h('p', {}, h('a', { href: wa, target: '_blank', rel: 'noopener' }, `WhatsApp ${phone}`)),
      s.instagram && h('p', {}, h('a', { href: `https://instagram.com/${s.instagram}`, target: '_blank', rel: 'noopener' }, `Instagram @${s.instagram}`)),
      h('p', { style: { marginTop: '14px' } }, h('span', { class: `status-pill ${st.open ? 'is-open' : 'is-closed'}` }, st.open ? `Estamos abertos — ${st.label.toLowerCase()}` : `Estamos fechados — ${st.label.toLowerCase()}`))));
}

export function renderStatus() {
  const st = state.store;
  document.querySelectorAll('[data-status]').forEach((el) => {
    el.className = `status-pill ${st.open ? 'is-open' : 'is-closed'}`;
    el.textContent = st.open ? `Estamos abertos — ${st.label.toLowerCase()}` : `Estamos fechados — ${st.label.toLowerCase()}`;
  });
}

export function renderHeroBits() {
  const s = state.settings;
  const min = Math.min(...state.catalog.builder.sizes.map((x) => x.price_cents));
  const sticker = document.querySelector('[data-hero-price]');
  if (Number.isFinite(min)) replace(sticker, 'Açaí a partir de', h('b', {}, brl(min)));
  else sticker.hidden = true;
  const facts = [];
  if (s.delivery.enabled) facts.push(`🛵 Entrega em ${s.prep.deliveryMin}–${s.prep.deliveryMax} min`);
  if (s.delivery.pickupEnabled) facts.push(`🏪 Retirada em ${s.prep.pickupMin}–${s.prep.pickupMax} min`);
  if (s.delivery.freeAboveCents) facts.push(`💜 Frete grátis acima de ${brl(s.delivery.freeAboveCents)}`);
  replace(document.querySelector('[data-hero-facts]'), facts.map((f) => h('span', {}, f)));
  document.querySelector('[data-footer-name]').textContent = `© ${new Date().getFullYear()} ${s.storeName} — Açaiteria`;
  if (s.logo && !s.logo.startsWith('/assets/brand/')) document.querySelectorAll('[data-logo]').forEach((img) => { img.closest('picture')?.querySelector('source')?.remove(); img.src = s.logo; });
}
