import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, row } from '../db/database.js';
import { HttpError, parseCookies } from '../lib/http.js';

export const COOKIE = 'tdb_session';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function ensureUser({ email, password, name, role }) {
  if (!email || !password) return;
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (!exists) {
    db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email.toLowerCase(), name, hashPassword(password), role);
    console.log(`[auth] usuário ${role} criado: ${email}`);
  }
}

export function login(email, password) {
  const user = row(db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email || '').toLowerCase().trim()));
  // Sempre executa o hash para não revelar se o e-mail existe pelo tempo de resposta
  const ok = user ? verifyPassword(password, user.password_hash) : (verifyPassword(password, hashPassword('x')), false);
  if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), user.id, Date.now() + config.sessionTtlMs);
  return { token, user: publicUser(user) };
}

export function logout(req) {
  const t = parseCookies(req)[COOKIE];
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
}

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function sessionUser(req) {
  const t = parseCookies(req)[COOKIE];
  if (!t) return null;
  const r = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sha(t), Date.now());
  return r ? publicUser(r) : null;
}

export function sessionCookie(token, maxAgeMs) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${config.isProd ? '; Secure' : ''}`;
}

/** Middleware: exige login (e papel, se informado) + cabeçalho anti-CSRF nas escritas. */
export function requireAuth(...roles) {
  return (ctx) => {
    const user = sessionUser(ctx.req);
    if (!user) throw new HttpError(401, 'Faça login para continuar.');
    if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'Você não tem permissão para esta ação.');
    if (ctx.req.method !== 'GET' && ctx.req.headers['x-tdb-request'] !== '1') throw new HttpError(403, 'Requisição bloqueada.');
    ctx.user = user;
  };
}

/* ── Gestão de usuários do painel ── */
const MIN_PASS = 8;
export function listUsers() {
  return db.prepare('SELECT id, email, name, role, active FROM users ORDER BY id').all();
}

export function createUser({ email, name, password, role }) {
  const e = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(422, 'Informe um e-mail válido.', { email: 'Informe um e-mail válido.' });
  if (String(password || '').length < MIN_PASS) throw new HttpError(422, `A senha precisa de pelo menos ${MIN_PASS} caracteres.`, { password: 'Senha muito curta.' });
  if (!['admin', 'staff'].includes(role)) throw new HttpError(422, 'Perfil inválido.');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(e)) throw new HttpError(409, 'Já existe um usuário com esse e-mail.', { email: 'E-mail já cadastrado.' });
  const nm = String(name || '').replace(/[<>]/g, '').trim().slice(0, 60) || e.split('@')[0];
  const info = db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(e, nm, hashPassword(password), role);
  return db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?').get(info.lastInsertRowid);
}

export function updateUser(id, input, actor) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
  if (!u) throw new HttpError(404, 'Usuário não encontrado.');
  if (u.id === actor.id && (input.active === false || (input.role && input.role !== u.role))) throw new HttpError(422, 'Você não pode desativar ou rebaixar a própria conta.');
  if ('role' in input && !['admin', 'staff'].includes(input.role)) throw new HttpError(422, 'Perfil inválido.');
  if ('password' in input && String(input.password).length < MIN_PASS) throw new HttpError(422, `A senha precisa de pelo menos ${MIN_PASS} caracteres.`);
  const name = 'name' in input ? String(input.name || '').replace(/[<>]/g, '').trim().slice(0, 60) || u.name : u.name;
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(name, input.role ?? u.role, 'active' in input ? (input.active ? 1 : 0) : u.active, u.id);
  if (input.password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(input.password)), u.id);
    if (u.id !== actor.id) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  if ('active' in input && !input.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  return db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?').get(u.id);
}

export function changeOwnPassword(user, current, next) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!verifyPassword(current, u.password_hash)) throw new HttpError(422, 'A senha atual está incorreta.', { current: 'Senha atual incorreta.' });
  if (String(next || '').length < MIN_PASS) throw new HttpError(422, `A nova senha precisa de pelo menos ${MIN_PASS} caracteres.`, { next: 'Senha muito curta.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(next)), u.id);
}
