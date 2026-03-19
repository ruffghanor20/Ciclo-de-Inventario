import { db, uuid } from './database';
import { markItemAsCounted } from './itemsDB';
import { todayIsoDate } from '../utils/countSchedule';

export interface CountEntry {
  id: string;
  session_id: string;
  item_id: string | null;
  codigo: string;
  descricao: string;
  saldo_sistema: number;
  quantidade_contada: number;
  diferenca: number;
  localizacao: string;
  observacao: string;
  escaneado: number;
  created_at: string;
}

export function getCountsBySession(sessionId: string): CountEntry[] {
  return db.getAllSync<CountEntry>(
    `SELECT * FROM count_entries WHERE session_id = ? ORDER BY created_at DESC`,
    [sessionId]
  );
}

export function getCountByCodigo(sessionId: string, codigo: string): CountEntry | null {
  return db.getFirstSync<CountEntry>(
    `SELECT * FROM count_entries WHERE session_id = ? AND codigo = ? ORDER BY created_at DESC`,
    [sessionId, codigo]
  ) ?? null;
}

export function saveCount(data: {
  session_id: string;
  item_id?: string | null;
  codigo: string;
  descricao: string;
  saldo_sistema: number;
  quantidade_contada: number;
  localizacao?: string;
  observacao?: string;
  escaneado?: boolean;
}): CountEntry {
  const now = new Date().toISOString();
  const diferenca = data.quantidade_contada - data.saldo_sistema;

  // Check if count already exists for this session+codigo
  const existing = getCountByCodigo(data.session_id, data.codigo);
  if (existing) {
    db.runSync(
      `UPDATE count_entries SET quantidade_contada=?, diferenca=?, observacao=?, escaneado=? WHERE id=?`,
      [data.quantidade_contada, diferenca, data.observacao ?? '', data.escaneado ? 1 : 0, existing.id]
    );
    markItemAsCounted(data.codigo, todayIsoDate());
    return getCountByCodigo(data.session_id, data.codigo)!;
  }

  const id = uuid();
  db.runSync(
    `INSERT INTO count_entries 
     (id, session_id, item_id, codigo, descricao, saldo_sistema, quantidade_contada, diferenca, localizacao, observacao, escaneado, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.session_id, data.item_id ?? null, data.codigo, data.descricao,
      data.saldo_sistema, data.quantidade_contada, diferenca,
      data.localizacao ?? '', data.observacao ?? '', data.escaneado ? 1 : 0, now]
  );
  markItemAsCounted(data.codigo, todayIsoDate());
  return getCountByCodigo(data.session_id, data.codigo)!;
}

export function getDivergences(sessionId: string): CountEntry[] {
  return db.getAllSync<CountEntry>(
    `SELECT * FROM count_entries WHERE session_id = ? AND diferenca != 0 ORDER BY ABS(diferenca) DESC`,
    [sessionId]
  );
}

export function getSessionStats(sessionId: string): {
  total: number;
  ok: number;
  falta: number;
  diferenca: number;
} {
  const total = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) as c FROM count_entries WHERE session_id = ?`, [sessionId]
  )?.c ?? 0;
  const ok = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) as c FROM count_entries WHERE session_id = ? AND diferenca = 0`, [sessionId]
  )?.c ?? 0;
  const falta = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) as c FROM count_entries WHERE session_id = ? AND diferenca < 0`, [sessionId]
  )?.c ?? 0;
  const diferenca = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) as c FROM count_entries WHERE session_id = ? AND diferenca > 0`, [sessionId]
  )?.c ?? 0;
  return { total, ok, falta, diferenca };
}

export function deleteCount(id: string): void {
  db.runSync(`DELETE FROM count_entries WHERE id = ?`, [id]);
}
