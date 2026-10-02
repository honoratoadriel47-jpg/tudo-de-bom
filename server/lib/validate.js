import { HttpError } from './http.js';

/** Remove caracteres de controle, tags e espaços excedentes. */
export function cleanText(v, max = 200) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Acumula erros de validação por campo e lança tudo de uma vez. */
const cap = (t) => String(t).replace(/^(o|a|seu|sua) /i, '').replace(/^./, (c) => c.toUpperCase());

export class Validator {
  constructor() { this.errors = {}; }
  fail(field, msg) { if (!this.errors[field]) this.errors[field] = msg; return undefined; }
  text(field, v, { required = false, min = 0, max = 200, label = field, multiline = false } = {}) {
    let s = cleanText(v, multiline ? max : max);
    if (!multiline) s = s.replace(/\s+/g, ' ');
    if (!s) return required ? this.fail(field, `Informe ${label}.`) : '';
    if (s.length < min) return this.fail(field, `${cap(label)} precisa de pelo menos ${min} caracteres.`);
    return s;
  }
  int(field, v, { required = false, min = -Infinity, max = Infinity, label = field } = {}) {
    if (v === undefined || v === null || v === '') return required ? this.fail(field, `Informe ${label}.`) : null;
    const n = Number(v);
    if (!Number.isInteger(n)) return this.fail(field, `${cap(label)} deve ser um número inteiro.`);
    if (n < min || n > max) return this.fail(field, `${cap(label)} está fora do limite permitido.`);
    return n;
  }
  oneOf(field, v, options, { label = field, required = true } = {}) {
    if ((v === undefined || v === null || v === '') && !required) return null;
    if (!options.includes(v)) return this.fail(field, `Escolha uma opção válida para ${label}.`);
    return v;
  }
  bool(v) { return v === true || v === 1 || v === '1' || v === 'true'; }
  assert() {
    if (Object.keys(this.errors).length) {
      const first = Object.values(this.errors)[0];
      throw new HttpError(422, first, this.errors);
    }
  }
}

/** Telefone brasileiro → apenas dígitos com DDD (10 ou 11 dígitos). */
export function normalizePhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return /^\d{10,11}$/.test(d) ? d : null;
}

export function formatPhone(d) {
  if (!d) return '';
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
