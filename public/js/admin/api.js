/** Cliente da API do painel. Envia o cabeçalho anti-CSRF exigido pelo servidor. */
export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details || {}; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, url, body, { raw = false, contentType } = {}) {
  const headers = { 'X-TDB-Request': '1' };
  if (body !== undefined) headers['Content-Type'] = contentType || 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.endsWith('/login')) onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || 'Algo deu errado.', res.status, data.details);
  return data;
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();

export const api = {
  login: (email, password) => request('POST', '/api/admin/login', { email, password }),
  logout: () => request('POST', '/api/admin/logout', {}),
  me: () => request('GET', '/api/admin/me'),
  orders: (filters = {}) => request('GET', `/api/admin/orders?${qs(filters)}`),
  order: (id) => request('GET', `/api/admin/orders/${id}`),
  setStatus: (id, status) => request('PATCH', `/api/admin/orders/${id}/status`, { status }),
  settings: () => request('GET', '/api/admin/settings'),
  saveSettings: (data) => request('PUT', '/api/admin/settings', data),
  schema: () => request('GET', '/api/admin/schema'),
  list: (res) => request('GET', `/api/admin/r/${res}`),
  create: (res, data) => request('POST', `/api/admin/r/${res}`, data),
  update: (res, id, data) => request('PUT', `/api/admin/r/${res}/${id}`, data),
  remove: (res, id) => request('DELETE', `/api/admin/r/${res}/${id}`),
  upload: (file) => request('POST', '/api/admin/uploads', file, { raw: true, contentType: file.type }),
  users: () => request('GET', '/api/admin/users'),
  createUser: (data) => request('POST', '/api/admin/users', data),
  updateUser: (id, data) => request('PATCH', `/api/admin/users/${id}`, data),
  changePassword: (current, next) => request('POST', '/api/admin/password', { current, next }),
};
