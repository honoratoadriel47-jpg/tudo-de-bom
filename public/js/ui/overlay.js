/**
 * Painéis/modais acessíveis: fundo escurecido, foco preso dentro, Esc fecha,
 * foco volta para quem abriu. Painéis empilháveis (ex.: carrinho → checkout).
 */
const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function openPanel({ panel, label, onClose }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.style.zIndex = 200 + stack.length * 20;
  panel.style.zIndex = 210 + stack.length * 20;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (label) panel.setAttribute('aria-label', label);
  document.body.append(scrim, panel);
  const entry = { panel, scrim, onClose, opener: document.activeElement };
  stack.push(entry);
  document.body.classList.add('is-locked');
  scrim.addEventListener('click', () => closeTop());
  requestAnimationFrame(() => requestAnimationFrame(() => {
    scrim.classList.add('is-open');
    panel.classList.add('is-open');
    (panel.querySelector('[autofocus]') || panel.querySelector(FOCUSABLE))?.focus({ preventScroll: true });
  }));
  return () => closePanel(entry);
}

function closePanel(entry) {
  const i = stack.indexOf(entry);
  if (i === -1) return;
  stack.splice(i, 1);
  entry.panel.classList.remove('is-open');
  entry.scrim.classList.remove('is-open');
  setTimeout(() => { entry.panel.remove(); entry.scrim.remove(); }, 450);
  if (!stack.length) document.body.classList.remove('is-locked');
  entry.opener?.focus?.({ preventScroll: true });
  entry.onClose?.();
}

export function closeTop() { if (stack.length) closePanel(stack[stack.length - 1]); }
export function closeAll() { while (stack.length) closePanel(stack[stack.length - 1]); }

document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); closeTop(); }
  if (e.key === 'Tab') {
    const f = [...top.panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
