import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

/** Executa fn dentro de uma transação. */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Converte objetos de protótipo nulo em objetos simples e parseia colunas JSON. */
export function row(r, jsonCols = []) {
  if (!r) return null;
  const o = { ...r };
  for (const c of jsonCols) if (typeof o[c] === 'string') { try { o[c] = JSON.parse(o[c]); } catch { o[c] = null; } }
  return o;
}
export const rows = (list, jsonCols) => list.map((r) => row(r, jsonCols));
