export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Uma "bolinha" do produto voa até o carrinho. Usa só transform/opacity (performático). */
export function flyToCart(fromEl, imgSrc) {
  const target = [document.getElementById('cart-bar'), document.getElementById('cart-open')]
    .find((el) => el && el.offsetParent !== null && getComputedStyle(el).transform === 'none') || document.getElementById('cart-open');
  if (!fromEl || !target || reducedMotion()) return Promise.resolve();
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'flyer';
  if (imgSrc) { const i = new Image(); i.src = imgSrc; i.alt = ''; fly.append(i); }
  fly.style.left = `${a.left + a.width / 2 - 32}px`;
  fly.style.top = `${a.top + a.height / 2 - 32}px`;
  document.body.append(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = fly.animate([
    { transform: 'translate(0,0) scale(.6)', opacity: 0 },
    { transform: `translate(${dx * 0.35}px, ${dy * 0.1 - 120}px) scale(1.1)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: 0.6 },
  ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' });
  return anim.finished.then(() => fly.remove(), () => fly.remove());
}

export function bump(el, cls = 'bump') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Contador animado para valores em dinheiro. */
const running = new WeakMap();
export function animateNumber(el, to, format) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (reducedMotion() || from === to) { el.textContent = format(to); return; }
  cancelAnimationFrame(running.get(el));
  const start = performance.now(), dur = 450;
  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(from + (to - from) * e));
    if (p < 1) running.set(el, requestAnimationFrame(tick));
  };
  running.set(el, requestAnimationFrame(tick));
}

/** Revelação ao rolar — um único observer para a página toda. */
let io;
export function observeReveal(root = document) {
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    root.querySelectorAll('[data-reveal], .gallery__item').forEach((el) => el.classList.add('is-in'));
    return;
  }
  io ||= new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  root.querySelectorAll('[data-reveal]:not(.is-in), .gallery__item:not(.is-in)').forEach((el) => io.observe(el));
}

export function confetti() {
  if (reducedMotion()) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#F8BE1C', '#B865F0', '#E5405E', '#5DBB46', '#FFF4E0'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    c.style.setProperty('--r', `${Math.random() * 900 - 450}deg`);
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3400);
}

/** Centraliza um item numa faixa com rolagem horizontal sem mover a página. */
export function centerIn(strip, item, smooth = false) {
  if (!strip || !item) return;
  const a = strip.getBoundingClientRect(), b = item.getBoundingClientRect();
  const left = strip.scrollLeft + (b.left - a.left) - (a.width - b.width) / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}
