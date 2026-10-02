import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

/** Configuração central do servidor. Tudo que depende de ambiente passa por aqui. */
export const config = Object.freeze({
  root,
  port: Number(env.PORT || 3000),
  isProd: env.NODE_ENV === 'production',
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dbPath: path.resolve(root, env.DB_PATH || './data/tudodebom.db'),
  uploadDir: path.resolve(root, env.UPLOAD_DIR || './data/uploads'),
  publicDir: path.join(root, 'public'),
  admin: { email: env.ADMIN_EMAIL || 'admin@tudodebom.com.br', password: env.ADMIN_PASSWORD || 'troque-esta-senha' },
  staff: { email: env.STAFF_EMAIL || '', password: env.STAFF_PASSWORD || '' },
  sessionTtlMs: Number(env.SESSION_TTL_HOURS || 12) * 3600_000,
  trustProxy: env.TRUST_PROXY === '1',
  webhookUrl: env.ORDER_WEBHOOK_URL || '',
  whatsappCloud: { token: env.WHATSAPP_CLOUD_TOKEN || '', phoneId: env.WHATSAPP_CLOUD_PHONE_ID || '' },
});
