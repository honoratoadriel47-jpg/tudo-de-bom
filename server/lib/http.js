import zlib from 'node:zlib';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Lê o corpo da requisição com limite de tamanho. */
export function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Conteúdo muito grande.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Envie os dados em JSON.');
  const raw = await readBody(req, limit);
  if (!raw.length) return {};
  try {
    const data = JSON.parse(raw.toString('utf8'));
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

export function send(req, res, status, body, headers = {}) {
  let payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  const h = { ...headers };
  if (!h['Content-Type']) h['Content-Type'] = 'application/json; charset=utf-8';
  const accepts = req.headers['accept-encoding'] || '';
  const compressible = /json|text|javascript|svg|xml/.test(h['Content-Type']);
  if (compressible && Buffer.byteLength(payload) > 1024 && accepts.includes('gzip')) {
    payload = zlib.gzipSync(payload);
    h['Content-Encoding'] = 'gzip';
    h['Vary'] = 'Accept-Encoding';
  }
  res.writeHead(status, h);
  res.end(payload);
}

export function sendJson(req, res, status, data, headers = {}) {
  send(req, res, status, data, { 'Cache-Control': 'no-store', ...headers });
}

export function sendError(req, res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[erro]', err);
  sendJson(req, res, status, {
    error: status >= 500 ? 'Erro interno. Tente novamente em instantes.' : err.message,
    details: err.details,
  });
}

export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
