import { HttpError } from './http.js';

/** Limitador em memória por chave (IP). Suficiente para uma única instância. */
export function rateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    h.count++;
    if (h.count > max) throw new HttpError(429, message || 'Muitas tentativas. Aguarde um pouco e tente de novo.');
  };
}
