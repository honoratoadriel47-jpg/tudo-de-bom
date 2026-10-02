export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details || {}; }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Sem conexão. Confira sua internet e tente de novo.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Algo deu errado. Tente novamente.', res.status, data.details);
  return data;
}

export const api = {
  catalog: () => request('GET', '/api/catalog'),
  store: () => request('GET', '/api/store'),
  quote: (payload) => request('POST', '/api/orders/quote', payload),
  createOrder: (payload) => request('POST', '/api/orders', payload),
  order: (token) => request('GET', `/api/orders/${encodeURIComponent(token)}`),
};
