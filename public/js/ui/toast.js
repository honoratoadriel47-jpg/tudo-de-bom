import { h } from './dom.js';

export function toast(message, { type = 'ok', icon = type === 'error' ? '⚠️' : '💜', duration = 2600 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), h('span', {}, message));
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { el.classList.add('is-leaving'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, duration);
}
