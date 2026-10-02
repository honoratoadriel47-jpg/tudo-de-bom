import { h, replace } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { api } from './api.js';
import { session } from './main.js';

/** Usuários do painel (admin) e troca da própria senha (todos). */
export async function renderUsers(root) {
  document.title = 'Usuários — Painel TUDO DE BOM';
  const list = h('div', { class: 'table-wrap' });
  const draw = async () => {
    const users = await api.users();
    replace(list, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ['Nome', 'E-mail', 'Perfil', 'Ativo', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, users.map((u) => {
        const me = u.id === session.user.id;
        const active = h('input', { type: 'checkbox', checked: !!u.active, disabled: me, 'aria-label': `${u.name} ativo` });
        active.addEventListener('change', async () => {
          try { await api.updateUser(u.id, { active: active.checked }); toast(active.checked ? 'Usuário ativado' : 'Usuário desativado', { icon: '👥' }); }
          catch (e) { active.checked = !active.checked; toast(e.message, { type: 'error' }); }
        });
        const role = h('select', { class: 'select', disabled: me, style: { minHeight: '40px', width: 'auto' }, 'aria-label': `Perfil de ${u.name}` },
          h('option', { value: 'staff', selected: u.role === 'staff' }, 'Funcionário (só pedidos)'),
          h('option', { value: 'admin', selected: u.role === 'admin' }, 'Administrador'));
        role.addEventListener('change', async () => {
          try { await api.updateUser(u.id, { role: role.value }); toast('Perfil atualizado', { icon: '👥' }); }
          catch (e) { toast(e.message, { type: 'error' }); draw(); }
        });
        const reset = h('button', { class: 'btn btn--sm btn--line', type: 'button', onclick: async () => {
          const pw = prompt(`Nova senha para ${u.name} (mínimo 8 caracteres):`);
          if (!pw) return;
          try { await api.updateUser(u.id, { password: pw }); toast('Senha redefinida', { icon: '🔑' }); }
          catch (e) { toast(e.message, { type: 'error' }); }
        } }, 'Redefinir senha');
        return h('tr', { style: { cursor: 'default' } }, h('td', {}, u.name, me ? ' (você)' : ''), h('td', {}, u.email), h('td', {}, role),
          h('td', {}, h('label', { class: 'switch' }, active, h('i'))), h('td', {}, reset));
      }))));
  };

  const name = h('input', { class: 'input', id: 'nu-name', maxlength: 60 });
  const email = h('input', { class: 'input', id: 'nu-email', type: 'email', autocomplete: 'off' });
  const pass = h('input', { class: 'input', id: 'nu-pass', type: 'password', autocomplete: 'new-password', minlength: 8 });
  const role = h('select', { class: 'select', id: 'nu-role' }, h('option', { value: 'staff' }, 'Funcionário (só pedidos)'), h('option', { value: 'admin' }, 'Administrador'));
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const lbl = (id, t) => h('label', { for: id }, h('span', { style: { fontWeight: 700, fontSize: '.92rem' } }, t));
  const form = h('form', { class: 'card form', novalidate: true },
    h('h2', {}, 'Adicionar usuário'),
    h('div', { class: 'form-grid' },
      h('div', { class: 'field' }, lbl('nu-name', 'Nome'), name), h('div', { class: 'field' }, lbl('nu-email', 'E-mail'), email),
      h('div', { class: 'field' }, lbl('nu-pass', 'Senha inicial'), pass), h('div', { class: 'field' }, lbl('nu-role', 'Perfil'), role)),
    err, h('div', {}, h('button', { class: 'btn btn--sm btn--grape', type: 'submit' }, 'Adicionar')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    try {
      await api.createUser({ name: name.value, email: email.value, password: pass.value, role: role.value });
      toast('Usuário criado!', { icon: '👥' }); form.reset(); draw();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  replace(root, h('div', { class: 'page-head' }, h('h1', {}, 'Usuários')),
    h('p', { class: 'muted', style: { marginBottom: '14px' } }, 'Funcionários veem apenas os pedidos. Administradores acessam tudo.'),
    list, h('div', { style: { height: '16px' } }), form);
  await draw();
}

export function renderPassword(root) {
  document.title = 'Minha senha — Painel TUDO DE BOM';
  const cur = h('input', { class: 'input', id: 'pw-cur', type: 'password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', id: 'pw-new', type: 'password', autocomplete: 'new-password', minlength: 8 });
  const again = h('input', { class: 'input', id: 'pw-again', type: 'password', autocomplete: 'new-password' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const lbl = (id, t) => h('label', { for: id }, h('span', { style: { fontWeight: 700, fontSize: '.92rem' } }, t));
  const form = h('form', { class: 'card form', novalidate: true, style: { maxWidth: '460px' } },
    h('div', { class: 'field' }, lbl('pw-cur', 'Senha atual'), cur),
    h('div', { class: 'field' }, lbl('pw-new', 'Nova senha'), next, h('small', {}, 'Mínimo de 8 caracteres.')),
    h('div', { class: 'field' }, lbl('pw-again', 'Repita a nova senha'), again),
    err, h('div', {}, h('button', { class: 'btn btn--sm btn--grape', type: 'submit' }, 'Trocar senha')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    if (next.value !== again.value) { err.textContent = 'As senhas novas não conferem.'; err.hidden = false; return; }
    try { await api.changePassword(cur.value, next.value); toast('Senha alterada!', { icon: '🔑' }); form.reset(); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  replace(root, h('div', { class: 'page-head' }, h('h1', {}, 'Minha senha')), form);
}
